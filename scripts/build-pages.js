'use strict';
/**
 * 生成 GitHub Pages 静态目录 docs/
 * 用法：node scripts/build-pages.js
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'docs');
const DATA = path.join(ROOT, 'data', 'courses.json');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 1) 静态资源
fs.cpSync(SRC, OUT, { recursive: true });

// 2) 数据快照（Pages 上没有服务端，改为读取这个文件）
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
fs.copyFileSync(DATA, path.join(OUT, 'data', 'courses.json'));

// 3) 关掉 Jekyll，避免以下划线开头的文件被忽略
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

// 4) 给 css/js 加内容哈希，绕过 GitHub Pages 的 max-age=600 缓存
const ASSETS = ['styles.css', 'app.js', 'docx-client.js'];
const hash = crypto.createHash('md5');
ASSETS.forEach((f) => hash.update(fs.readFileSync(path.join(OUT, f))));
const v = hash.digest('hex').slice(0, 8);

const indexPath = path.join(OUT, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
ASSETS.forEach((f) => {
  html = html.split(`./${f}"`).join(`./${f}?v=${v}"`);
});
fs.writeFileSync(indexPath, html);

const d = JSON.parse(fs.readFileSync(DATA, 'utf8'));
console.log(
  `docs/ 已生成：${d.sessions.length} 节课，资源版本 v=${v}，数据源 ${path.basename(d.meta?.source || 'courses.json')}`
);
