'use strict';
/**
 * 浏览器端 docx 课程表解析（无依赖）
 * 依赖 DecompressionStream('deflate-raw')：Chrome 103+ / Safari 16.4+ / Firefox 113+
 * 与 lib/parse-docx.js 使用同一套识别规则，保证本地服务版与静态版结果一致。
 */
(function () {
  const WEEKDAY = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };

  async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /** 从 zip 中央目录找条目，返回解压后的 Uint8Array */
  async function readEntry(buffer, wanted) {
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    const EOCD = 0x06054b50;
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) {
      if (view.getUint32(i, true) === EOCD) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('文件不是有效的 docx（未找到 ZIP 目录）');

    const count = view.getUint16(eocd + 10, true);
    let off = view.getUint32(eocd + 16, true);
    const dec = new TextDecoder('utf-8');

    for (let n = 0; n < count; n++) {
      if (view.getUint32(off, true) !== 0x02014b50) break;
      const method = view.getUint16(off + 10, true);
      const compSize = view.getUint32(off + 20, true);
      const nameLen = view.getUint16(off + 28, true);
      const extraLen = view.getUint16(off + 30, true);
      const commentLen = view.getUint16(off + 32, true);
      const localOff = view.getUint32(off + 42, true);
      const name = dec.decode(bytes.subarray(off + 46, off + 46 + nameLen));
      if (name === wanted) {
        const lNameLen = view.getUint16(localOff + 26, true);
        const lExtraLen = view.getUint16(localOff + 28, true);
        const start = localOff + 30 + lNameLen + lExtraLen;
        const raw = bytes.subarray(start, start + compSize);
        if (method === 0) return raw;
        if (method === 8) return await inflateRaw(raw);
        throw new Error('不支持的压缩方式：' + method);
      }
      off += 46 + nameLen + extraLen + commentLen;
    }
    return null;
  }

  /* ---------- 规则（与 lib/parse-docx.js 保持一致） ---------- */
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
  function detectKind(title) {
    if (/动员会|宣讲会/.test(title)) return 'public';
    if (/试听/.test(title)) return 'trial';
    if (/开班|结营|开班仪式|例会/.test(title)) return 'milestone';
    return 'lesson';
  }

  function cellText(tc) {
    const paras = [];
    const ps = tc.getElementsByTagName('w:p');
    for (let i = 0; i < ps.length; i++) {
      let text = '';
      const p = ps[i];
      const runs = p.getElementsByTagName('*');
      for (let j = 0; j < runs.length; j++) {
        const el = runs[j];
        const tag = el.tagName;
        if (tag === 'w:t') text += el.textContent;
        else if (tag === 'w:br' || tag === 'w:tab') text += ' ';
      }
      text = text.replace(/[\v\u000b\u00a0]/g, ' ').trim();
      if (text) paras.push(text);
    }
    return paras.join(' ').replace(/\s+/g, ' ').trim();
  }

  async function parseCourseDocx(arrayBuffer, filename) {
    const xmlBytes = await readEntry(arrayBuffer, 'word/document.xml');
    if (!xmlBytes) throw new Error('docx 中找不到 word/document.xml');
    const xml = new TextDecoder('utf-8').decode(xmlBytes);
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('文档 XML 解析失败');

    const tables = doc.getElementsByTagName('w:tbl');
    if (!tables.length) throw new Error('文档里没有表格');

    const sessions = [];
    let headerSeen = false;

    for (let t = 0; t < tables.length; t++) {
      const rows = tables[t].getElementsByTagName('w:tr');
      for (let r = 0; r < rows.length; r++) {
        const tcs = rows[r].getElementsByTagName('w:tc');
        const cells = [];
        for (let c = 0; c < tcs.length; c++) cells.push(cellText(tcs[c]));
        const joined = cells.join(' ');

        if (!headerSeen && /时间/.test(joined) && /(名称|项目|课程)/.test(joined)) {
          headerSeen = true;
          continue;
        }
        const dm = /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(joined);
        if (!dm) continue;
        const date = `${dm[1]}-${String(+dm[2]).padStart(2, '0')}-${String(+dm[3]).padStart(2, '0')}`;

        const tm = /(\d{1,2})\s*[:：]\s*(\d{2})\s*[-–—~至]\s*(\d{1,2})\s*[:：]\s*(\d{2})/.exec(joined);
        const start = tm ? `${String(+tm[1]).padStart(2, '0')}:${tm[2]}` : '';
        const end = tm ? `${String(+tm[3]).padStart(2, '0')}:${tm[4]}` : '';

        let rest = cells.slice(1).filter((x) => x !== '');
        if (rest.length >= 4 && /^\d{1,2}$/.test(rest[0])) rest = rest.slice(1);
        const title = (rest[0] || '').trim();
        const teacher = (rest[1] || '').trim();
        const expected = (rest[2] || '').trim();
        if (!title) continue;

        sessions.push({
          date, start, end, title, teacher, expected,
          track: detectTrack(title, teacher),
          kind: detectKind(title),
        });
      }
    }

    if (!sessions.length) {
      throw new Error('没识别到课程行（表格需要有：时间 / 培训项目名称 / 授课教师 / 参与学生人数）');
    }

    sessions.sort((a, b) =>
      a.date === b.date ? (a.start || '99').localeCompare(b.start || '99') : a.date.localeCompare(b.date)
    );

    return {
      meta: {
        title: '互联网“编导拍播”培训课程安排',
        subtitle: '2026-2027学年度 · 产学研发展中心',
        source: filename,
        updatedAt: new Date().toISOString(),
        total: sessions.length,
      },
      sessions: sessions.map((s, i) => ({ id: `s${String(i + 1).padStart(3, '0')}`, ...s })),
    };
  }

  window.parseCourseDocx = parseCourseDocx;
})();
