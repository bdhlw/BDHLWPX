'use strict';
/**
 * 课程看板本地服务（零依赖）
 * - 静态托管 public/
 * - GET  /api/data    读取课程数据
 * - POST /api/data    保存课程数据（课程编辑入口）
 * - POST /api/upload  上传 docx / csv / json，解析后覆盖课程数据（文档上传入口）
 * - GET  /api/export  导出当前数据 JSON
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { extractDocx } = require('./lib/parse-docx');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_FILE = path.join(ROOT, 'data', 'courses.json');
const BACKUP_DIR = path.join(ROOT, 'data', 'backup');
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(d) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(DATA_FILE, path.join(BACKUP_DIR, `courses-${stamp}.json`));
    // 只保留最近 20 份
    const files = fs.readdirSync(BACKUP_DIR).sort();
    while (files.length > 20) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), 'utf8');
  // 同步一份到 public/data，作为直接双击打开 index.html 时的只读兜底
  const mirror = path.join(PUBLIC, 'data');
  fs.mkdirSync(mirror, { recursive: true });
  fs.writeFileSync(path.join(mirror, 'courses.json'), JSON.stringify(d, null, 2), 'utf8');
}

function sendJSON(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req, limit = 40 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('文件过大（上限 40MB）'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* ---------- CSV 解析（支持引号包裹） ---------- */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else q = false;
      } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c === '\r') { /* skip */ }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
}

function csvToData(text, filename) {
  const rows = parseCSV(text);
  const { extractDocx: _x } = require('./lib/parse-docx');
  const { detectTrack, detectKind } = require('./lib/parse-docx');
  const sessions = [];
  rows.forEach((r, i) => {
    const joined = r.join(' ');
    const m = /(\d{4})\s*[-/年]\s*(\d{1,2})\s*[-/月]\s*(\d{1,2})/.exec(joined);
    if (!m) return;
    const date = `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
    const t = /(\d{1,2}):(\d{2})\s*[-–~至]\s*(\d{1,2}):(\d{2})/.exec(joined);
    const rest = r.filter((x) => String(x).trim() !== '').filter((x) => !/^\d{4}\s*[-/年]/.test(x));
    const title = (rest[0] || '').trim();
    if (!title) return;
    const teacher = (rest[1] || '').trim();
    sessions.push({
      date,
      start: t ? `${String(+t[1]).padStart(2, '0')}:${t[2]}` : '',
      end: t ? `${String(+t[3]).padStart(2, '0')}:${t[4]}` : '',
      title,
      teacher,
      expected: (rest[2] || '').trim(),
      track: detectTrack(title, teacher),
      kind: detectKind(title),
    });
  });
  if (!sessions.length) throw new Error('CSV 中未识别到课程行');
  sessions.sort((a, b) => (a.date === b.date ? (a.start || '99').localeCompare(b.start || '99') : a.date.localeCompare(b.date)));
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = decodeURIComponent(url.pathname);

  try {
    if (p === '/api/data' && req.method === 'GET') {
      return sendJSON(res, 200, readData());
    }

    if (p === '/api/data' && req.method === 'POST') {
      const body = await readBody(req);
      const incoming = JSON.parse(body.toString('utf8'));
      if (!incoming || !Array.isArray(incoming.sessions)) throw new Error('数据格式不正确');
      incoming.meta = incoming.meta || {};
      incoming.meta.total = incoming.sessions.length;
      incoming.meta.updatedAt = new Date().toISOString();
      writeData(incoming);
      return sendJSON(res, 200, { ok: true, total: incoming.sessions.length });
    }

    if (p === '/api/upload' && req.method === 'POST') {
      const filename = url.searchParams.get('filename') || 'upload';
      const body = await readBody(req);
      const ext = path.extname(filename).toLowerCase();
      let data;
      if (ext === '.docx') {
        const tmp = path.join(ROOT, 'data', `.upload-${Date.now()}${ext}`);
        fs.writeFileSync(tmp, body);
        try {
          data = extractDocx(tmp);
        } finally {
          fs.unlinkSync(tmp);
        }
        data.meta.source = filename;
      } else if (ext === '.json') {
        data = JSON.parse(body.toString('utf8'));
        data.meta = data.meta || {};
        data.meta.source = filename;
      } else if (ext === '.csv' || ext === '.txt') {
        data = csvToData(body.toString('utf8'), filename);
      } else {
        return sendJSON(res, 400, {
          ok: false,
          error: `暂不支持 ${ext || '该'} 格式，请上传 .docx / .csv / .json`,
        });
      }
      if (!data || !Array.isArray(data.sessions)) throw new Error('解析结果为空');
      data.meta.total = data.sessions.length;
      data.meta.updatedAt = new Date().toISOString();
      writeData(data);
      return sendJSON(res, 200, { ok: true, total: data.sessions.length, source: filename });
    }

    if (p === '/api/export' && req.method === 'GET') {
      const d = readData();
      const body = Buffer.from(JSON.stringify(d, null, 2), 'utf8');
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': 'attachment; filename="courses.json"',
        'Content-Length': body.length,
      });
      return res.end(body);
    }

    // 静态文件
    let filePath = path.join(PUBLIC, p === '/' ? 'index.html' : p);
    if (!filePath.startsWith(PUBLIC)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404).end('Not Found');
      return;
    }
    const body = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch (err) {
    sendJSON(res, 500, { ok: false, error: err.message || String(err) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`课程看板已启动: http://127.0.0.1:${PORT}`);
});
