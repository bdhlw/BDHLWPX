'use strict';
/**
 * docx 课程表解析器（零依赖）
 * 用途：把「2026-2027学年度编拍播导培训课程安排.docx」这类带表格的课程表，
 * 解析成结构化的课程数据，供看板渲染。
 */

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

/* ---------------- 最小 ZIP 读取（走中央目录，兼容 data descriptor） ---------------- */

function readZipEntries(buf) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  const start = Math.max(0, buf.length - 66000);
  for (let i = buf.length - 22; i >= start; i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 docx（未找到 ZIP 结尾目录）');

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const entries = new Map();

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    entries.set(name, { method, compSize, localOff });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return { buf, entries };
}

function readEntry(zip, name) {
  const e = zip.entries.get(name);
  if (!e) return null;
  const b = zip.buf;
  const lNameLen = b.readUInt16LE(e.localOff + 26);
  const lExtraLen = b.readUInt16LE(e.localOff + 28);
  const dataStart = e.localOff + 30 + lNameLen + lExtraLen;
  const raw = b.subarray(dataStart, dataStart + e.compSize);
  if (e.method === 0) return raw.toString('utf8');
  if (e.method === 8) return zlib.inflateRawSync(raw).toString('utf8');
  throw new Error('不支持的压缩方式: ' + e.method);
}

/* ---------------- WordprocessingML → 行/单元格 ---------------- */

function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&amp;/g, '&');
}

function parseTables(xml) {
  const tables = [];
  const tblRe = /<w:tbl\b[\s\S]*?<\/w:tbl>/g;
  let tm;
  while ((tm = tblRe.exec(xml))) {
    const tblXml = tm[0];
    const rows = [];
    const trRe = /<w:tr\b[\s\S]*?<\/w:tr>/g;
    let rm;
    while ((rm = trRe.exec(tblXml))) {
      const rowXml = rm[0];
      const cells = [];
      const tcRe = /<w:tc\b[\s\S]*?<\/w:tc>/g;
      let cm;
      while ((cm = tcRe.exec(rowXml))) {
        const tcXml = cm[0];
        const vMerge = /<w:vMerge\b/.test(tcXml) && !/<w:vMerge\s+w:val="restart"/.test(tcXml);
        const gridSpan = /<w:gridSpan\s+w:val="(\d+)"/.exec(tcXml);
        // 段落之间用空格连接；段内 <w:br/> / 竖排符 视为空格
        const paras = [];
        const pRe = /<w:p\b[\s\S]*?<\/w:p>/g;
        let pm;
        while ((pm = pRe.exec(tcXml))) {
          const pXml = pm[0];
          let text = '';
          const tRe = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:br\b[^>]*\/>|<w:tab\b[^>]*\/>/g;
          let xm;
          while ((xm = tRe.exec(pXml))) {
            if (xm[1] !== undefined) text += decodeXml(xm[1]);
            else text += ' ';
          }
          text = text.replace(/[\v\u000b]/g, ' ').replace(/\u00a0/g, ' ').trim();
          if (text) paras.push(text);
        }
        cells.push({
          text: paras.join(' ').replace(/\s+/g, ' ').trim(),
          span: gridSpan ? parseInt(gridSpan[1], 10) : 1,
          merged: vMerge,
        });
      }
      rows.push(cells);
    }
    tables.push(rows);
  }
  return tables;
}

/* ---------------- 课程行识别 ---------------- */

const WEEKDAY = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };

function parseDate(text) {
  const m = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(text);
  if (!m) return null;
  return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
}

function parseTime(text) {
  const m = /(\d{1,2})\s*[:：]\s*(\d{2})\s*[-–—~至]\s*(\d{1,2})\s*[:：]\s*(\d{2})/.exec(text);
  if (!m) return { start: '', end: '' };
  return {
    start: `${String(+m[1]).padStart(2, '0')}:${m[2]}`,
    end: `${String(+m[3]).padStart(2, '0')}:${m[4]}`,
  };
}

function parseWeekday(text) {
  const m = /(?:周|星期)\s*([一二三四五六日天])/.exec(text);
  return m ? WEEKDAY[m[1]] : null;
}

/** 方向判定：先看标题关键词，再看授课教师兜底
 *  'common' = 项目公共课（试听/动员会/宣讲会），只计入总课程数，不计入三个方向的进度
 */
function detectTrack(title, teacher) {
  const t = title || '';
  if (/直播运营|直播/.test(t)) return 'live';
  if (/试听|动员会|宣讲会/.test(t)) return 'common';
  if (/膳食/.test(t)) return 'meal';
  if (/工作坊|骨干/.test(t)) return 'workshop';
  if (/自媒体IP|自媒体\s*IP|IP培训|自媒体入门|中级课程/.test(t)) return 'ip';
  if (/周杰|郭楷/.test(teacher || '')) return 'meal';
  return 'ip';
}

/** 项目级公共活动（动员会/宣讲会/开班/结营 之类）单独标记 */
function detectKind(title) {
  if (/动员会|宣讲会/.test(title)) return 'public';
  if (/试听/.test(title)) return 'trial';
  if (/开班|结营|开班仪式|例会/.test(title)) return 'milestone';
  return 'lesson';
}

function extractDocx(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = readZipEntries(buf);
  const xml = readEntry(zip, 'word/document.xml');
  if (!xml) throw new Error('docx 中未找到 word/document.xml');
  const tables = parseTables(xml);

  const sessions = [];
  let headerSeen = false;
  for (const rows of tables) {
    for (const row of rows) {
      const cells = row.map((c) => c.text);
      const joined = cells.join(' ');
      // 表头行：含“时间”且含“名称”
      if (!headerSeen && /时间/.test(joined) && /(名称|项目|课程)/.test(joined)) {
        headerSeen = true;
        continue;
      }
      const date = parseDate(joined);
      if (!date) continue;
      const time = parseTime(joined);

      // 去掉第一列（时间/序号）后，按顺序取：课程名 / 教师 / 人数
      let rest = cells.slice(1).filter((c) => c !== '');
      // 若存在序号列（纯数字），剔除
      if (rest.length >= 4 && /^\d{1,2}$/.test(rest[0])) rest = rest.slice(1);
      const title = (rest[0] || '').trim();
      const teacher = (rest[1] || '').trim();
      const expected = (rest[2] || '').trim();
      if (!title) continue;

      const weekdayHint = parseWeekday(joined);
      sessions.push({
        date,
        start: time.start,
        end: time.end,
        title,
        teacher,
        expected,
        track: detectTrack(title, teacher),
        kind: detectKind(title),
        weekdayHint,
      });
    }
  }

  if (!sessions.length) throw new Error('未在文档表格中识别到课程行（需要“时间 / 培训项目名称 / 授课教师 / 人数”四列）');

  sessions.sort((a, b) =>
    a.date === b.date ? (a.start || '99').localeCompare(b.start || '99') : a.date.localeCompare(b.date)
  );

  return {
    meta: {
      title: '互联网“编导拍播”培训课程安排',
      subtitle: '2026-2027学年度 · 产学研发展中心',
      source: path.basename(filePath),
      updatedAt: new Date().toISOString(),
      total: sessions.length,
    },
    sessions: sessions.map((s, i) => ({ id: `s${String(i + 1).padStart(3, '0')}`, ...s })),
  };
}

module.exports = { extractDocx, parseTables, readZipEntries, readEntry, detectTrack, detectKind };
