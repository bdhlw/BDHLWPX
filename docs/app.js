'use strict';

/* ============================ 基础常量 ============================ */

const TRACK_META = {
  ip:       { key: 'ip',       name: '“自媒体IP”方向',   short: 'IP 培训',   hex: '#e04a32', soft: '#fdeeeb', desc: '试听课 · 系统课 · 中级课程' },
  meal:     { key: 'meal',     name: '“邦德膳食”方向',   short: '膳食培训',  hex: '#2aa25a', soft: '#e8f6ee', desc: '系列实操课 · 每周两次' },
  workshop: { key: 'workshop', name: '“邦德自媒体骨干工作坊”方向', short: '工作坊',    hex: '#d9861f', soft: '#fdf3e4', desc: '骨干培养 · 例会 · 结营' },
  live:     { key: 'live',     name: '“直播运营”方向',   short: '直播运营',  hex: '#36485a', soft: '#e9eef3', desc: '计划 8 节 · 首节宣讲已排期' },
  common:   { key: 'common',   name: '公共课程',       short: '公共课程',  hex: '#8b8681', soft: '#f0ede9', desc: '试听 · 动员 · 宣讲，仅计入总数' },
  other:    { key: 'other',    name: '其他方向',       short: '其他',      hex: '#a8a29b', soft: '#f2efeb', desc: '未归类课程' },
};
// 只有这些是「方向」，参与方向进度统计
const TRACK_ORDER = ['ip', 'meal', 'workshop', 'live'];
// 公共课程：计入总课程数，但不计入任何方向的进度
const COMMON = ['common'];

const KIND_LABEL = {
  lesson: '常规课',
  trial: '试听',
  public: '项目活动',
  milestone: '节点',
};

const DOW = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/* ============================ 工具函数 ============================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseISO(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d) {
  const x = startOfDay(d);
  const diff = (x.getDay() + 6) % 7; // 周一为一周开始
  return addDays(x, -diff);
}

/* ============================ 当前时间 / 学期周次 ============================ */

/** 学期首周的周一 + 总周数；换学期或校历调整时只改这两行 */
const SEMESTER = { start: '2026-09-04', weeks: 20 };

const WEEKDAY_FULL = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/** 按「开学首周周一」推算当前是第几周（第 1 周 = 起始日起的那一周） */
function semesterInfo(now = new Date()) {
  const start = startOfWeek(parseISO(SEMESTER.start)); // 归到所在周的周一
  const days = Math.floor((startOfDay(now) - start) / 86400000);
  const week = Math.floor(days / 7) + 1;
  return { week, total: SEMESTER.weeks, days };
}

function renderNowbar() {
  const el = $('#nowbar');
  if (!el) return;
  const now = new Date();

  $('#now-date').textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  $('#now-weekday').textContent = WEEKDAY_FULL[now.getDay()];
  $('#now-time').textContent =
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const { week, total } = semesterInfo(now);
  const bar = $('#sem-bar');
  const num = $('#sem-week');
  const foot = $('#sem-foot');
  bar.style.setProperty('--sem-total', total);

  if (week < 1) {
    num.textContent = '—';
    num.style.color = 'var(--muted)';
    $('#sem-bar-fill').style.width = '0%';
    foot.textContent = `距开学还有 ${1 - week} 周`;
  } else if (week > total) {
    num.textContent = total;
    num.style.color = 'var(--muted)';
    $('#sem-bar-fill').style.width = '100%';
    foot.textContent = `本学期 ${total} 周已全部结束`;
  } else {
    num.textContent = week;
    num.style.color = '';
    $('#sem-bar-fill').style.width = `${(week / total) * 100}%`;
    const left = total - week;
    foot.textContent = left > 0
      ? `已过 ${week} 周 · 还剩 ${left} 周`
      : '最后一周，学期即将结束';
  }
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function trackOf(key) {
  return TRACK_META[key] || TRACK_META.other;
}
function fmtMD(dateStr) {
  const d = parseISO(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function timeText(s) {
  if (s.start && s.end) return `${s.start}–${s.end}`;
  if (s.start) return s.start;
  return '时间待定';
}

/* 圈标序号 → 「第一节」，与课名之间留一个空格（解析器已处理，这里兜住旧数据） */
const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
function normalizeTitle(raw) {
  let t = String(raw == null ? '' : raw);
  t = t.replace(/[\u2460-\u2473\u3251-\u325F]/g, (ch) => {
    const code = ch.codePointAt(0);
    const n = code <= 0x2473 ? code - 0x2460 + 1 : code - 0x3251 + 21;
    return '第' + (CN_NUM[n] || String(n)) + '节';
  });
  t = t.replace(/(\S)\s*(第[一二三四五六七八九十]+节)/g, '$1 $2');
  return t.replace(/\s{2,}/g, ' ').trim();
}

/* ============================ 状态 ============================ */

const state = {
  data: { meta: {}, sessions: [] },
  view: 'week',
  cursor: startOfDay(new Date()),   // 当前聚焦日期
  filter: 'all',
  today: startOfDay(new Date()),
  editing: [],
  editMode: false,                  // 拖动编辑模式
  savedSnapshot: '',                // 上次保存时的数据快照（判断有没有未保存改动）
  unpushed: false,                  // 本地已保存但还没推送到线上
};

/* 「已上 / 待上」的分界线：按本机日期算，跨到第二天就自动往前挪一档 */
let TODAY_ISO = iso(state.today);

/* ============================ 数据加载 ============================ */

/* 运行模式：server = 本地 Node 服务（可写文件）；static = GitHub Pages / 纯静态 */
const RUNTIME = { mode: 'static', draftKey: 'course-board:draft:v1' };

/* 只读判定：发布到 GitHub Pages 的版本默认只读（隐藏上传/编辑入口）
 * 维护者可在网址后加 ?edit=1 临时打开入口做预览（改动仍只存在本机浏览器） */
const EDIT_PARAM = new URLSearchParams(location.search).get('edit') === '1';
const READONLY = !!(window.__BUILD__ && window.__BUILD__.readonly) && !EDIT_PARAM;

/* ---------------- 维护模式：把改动提交到 GitHub 仓库 ---------------- */
const GH = {
  key: 'course-board:gh',
  defaults: { repo: 'bdhlw/BDHLWPX', branch: 'main', token: '' },
  get() {
    try { return { ...GH.defaults, ...(JSON.parse(localStorage.getItem(GH.key) || '{}') || {}) }; }
    catch (_) { return { ...GH.defaults }; }
  },
  set(cfg) { localStorage.setItem(GH.key, JSON.stringify(cfg)); },
  clear() { localStorage.removeItem(GH.key); },
};

async function ghFetch(cfg, apiPath, opts = {}) {
  const res = await fetch('https://api.github.com' + apiPath, {
    method: opts.method || 'GET',
    headers: {
      Authorization: 'token ' + cfg.token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* 空响应 */ }
  if (!res.ok) {
    const msg = (data && data.message) || 'GitHub API ' + res.status;
    if (res.status === 401) throw new Error('令牌无效或已过期');
    if (res.status === 403) throw new Error('令牌权限不足（需要该仓库的 Contents: Read and write）');
    if (res.status === 404) throw new Error('仓库或分支不存在，或令牌无权访问');
    throw new Error(msg);
  }
  return data;
}

/** 一次提交多个文件（单个 commit） */
async function ghCommitFiles(cfg, files, message) {
  const ref = await ghFetch(cfg, `/repos/${cfg.repo}/git/ref/heads/${cfg.branch}`);
  const parent = ref.object.sha;
  const base = await ghFetch(cfg, `/repos/${cfg.repo}/git/commits/${parent}`);

  const tree = [];
  for (const [filePath, content] of Object.entries(files)) {
    const blob = await ghFetch(cfg, `/repos/${cfg.repo}/git/blobs`, {
      method: 'POST',
      body: { content, encoding: 'utf-8' },
    });
    tree.push({ path: filePath, mode: '100644', type: 'blob', sha: blob.sha });
  }

  const newTree = await ghFetch(cfg, `/repos/${cfg.repo}/git/trees`, {
    method: 'POST',
    body: { base_tree: base.tree.sha, tree },
  });
  const commit = await ghFetch(cfg, `/repos/${cfg.repo}/git/commits`, {
    method: 'POST',
    body: { message, tree: newTree.sha, parents: [parent] },
  });
  await ghFetch(cfg, `/repos/${cfg.repo}/git/refs/heads/${cfg.branch}`, {
    method: 'PATCH',
    body: { sha: commit.sha },
  });
  return commit.sha;
}

async function fetchData() {
  // 1) 有本地服务时优先走服务端
  try {
    const res = await fetch('api/data', { cache: 'no-store' });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      RUNTIME.mode = 'server';
      return await res.json();
    }
  } catch (_) { /* 静态托管下这里会 404，正常的 */ }

  // 2) 静态模式：读仓库里的 data/courses.json，再叠加本机浏览器的草稿
  RUNTIME.mode = 'static';
  const res = await fetch('data/courses.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('读不到 data/courses.json');
  const d = await res.json();
  // 只读模式下不叠加本机草稿，保证所有访客看到同一份数据
  if (!READONLY) {
    try {
      const raw = localStorage.getItem(RUNTIME.draftKey);
      const draft = raw ? JSON.parse(raw) : null;
      if (draft && Array.isArray(draft.sessions) && draft.sessions.length) {
        d.sessions = draft.sessions;
        d.meta = { ...(d.meta || {}), ...(draft.meta || {}), localDraft: true };
      }
    } catch (_) { /* 草稿损坏就忽略 */ }
  }
  return d;
}

async function loadData() {
  try {
    state.data = await fetchData();
  } catch (e) {
    toast('课程数据读取失败：' + e.message);
    return;
  }
  state.data.sessions = (state.data.sessions || []).map((s, i) => ({
    id: s.id || `s${i}`,
    date: s.date,
    start: s.start || '',
    end: s.end || '',
    title: normalizeTitle(s.title || ''),
    teacher: s.teacher || '',
    expected: s.expected || '',
    track: TRACK_META[s.track] ? s.track : 'other',
    kind: s.kind || 'lesson',
  }));
  state.savedSnapshot = snapshotOf();
  applyModeUI();
  renderAll();
  updateDirtyBar();
}

/* 按照运行模式切换文案（静态版没有服务端，改动只存本机浏览器） */
function applyModeUI() {
  const isStatic = RUNTIME.mode === 'static';
  const badge = $('#mode-badge');
  if (badge) {
    if (READONLY) {
      badge.textContent = '只读看板';
      badge.className = 'mode-badge readonly';
      badge.title = '课程内容由维护者更新；如需临时编辑，在网址后加 ?edit=1。';
    } else if (isStatic && EDIT_PARAM) {
      const on = !!GH.get().token;
      badge.textContent = on ? '维护模式 · 已连接' : '维护模式 · 未配置';
      badge.className = 'mode-badge clickable ' + (on ? 'server' : 'static');
      badge.title = on
        ? `点击可修改仓库 / 令牌（当前 ${GH.get().repo} · ${GH.get().branch}）`
        : '点击配置仓库与令牌，之后可在此页直接修改并发布';
    } else {
      badge.textContent = isStatic ? '静态版 · 改动存本机' : '本地服务版';
      badge.className = 'mode-badge ' + (isStatic ? 'static' : 'server');
      badge.title = isStatic
        ? '这是 GitHub Pages 静态版：编辑与上传的结果保存在当前浏览器，可「导出 JSON」覆盖仓库里的 data/courses.json 让所有人看到。'
        : '本地 Node 服务版：编辑与上传会直接写入 data/courses.json，并自动备份。';
    }
  }
  // 只读：藏起维护入口
  document.body.classList.toggle('is-readonly', READONLY);
  ['#btn-edit', '#btn-upload'].forEach((sel) => {
    const el = $(sel);
    if (el) el.hidden = READONLY;
  });
  // 拖动编辑 / 推送上线只在可写模式下出现
  const dragBtn = $('#btn-dragmode');
  if (dragBtn) dragBtn.hidden = READONLY;
  if (READONLY && state.editMode) setEditMode(false);
  syncPushButton();
  const hint = $('#edit-hint');
  if (hint) {
    hint.textContent = isStatic
      ? '改动保存在本机浏览器（可「导出 JSON」后覆盖仓库数据，让其他人也看到）'
      : '修改后保存，看板会立即更新（自动备份上一版）';
  }
  const tip = $('#tip-backup');
  if (tip) {
    tip.innerHTML = isStatic
      ? '静态版没有服务端，上传结果只存在本机浏览器；要同步给别人，请点「导出 JSON」并把文件覆盖回仓库的 <code>data/courses.json</code>。'
      : '上传前的版本会自动备份到 <code>data/backup/</code>，误传可从历史数据恢复。';
  }
}

/* ============================ 统计 ============================ */

function stats() {
  const list = state.data.sessions;
  const total = list.length;
  const done = list.filter((s) => s.date && s.date < TODAY_ISO).length;
  const todo = total - done;
  const dated = list.filter((s) => s.date);
  const dates = dated.map((s) => s.date).sort();
  const commonList = list.filter((s) => COMMON.includes(s.track));
  const commonDone = commonList.filter((s) => s.date && s.date < TODAY_ISO).length;
  return {
    total, done, todo,
    dated: dated.length,
    tbd: total - dated.length,
    first: dates[0] || '',
    last: dates[dates.length - 1] || '',
    pct: total ? Math.round((done / total) * 100) : 0,
    commonTotal: commonList.length,
    commonDone,
  };
}

function trackStats(key) {
  const list = state.data.sessions.filter((s) => s.track === key);
  const done = list.filter((s) => s.date && s.date < TODAY_ISO).length;
  const tbd = list.filter((s) => !s.date).length;
  const next = list
    .filter((s) => s.date && s.date >= TODAY_ISO)
    .sort((a, b) => (a.date + (a.start || '99')).localeCompare(b.date + (b.start || '99')))[0];
  return { total: list.length, done, tbd, todo: list.length - done, next, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
}

/** 三个方向（参与方向进度统计） */
function presentTracks() {
  const set = new Set(state.data.sessions.map((s) => s.track));
  const order = TRACK_ORDER.filter((k) => set.has(k));
  const extra = [...set].filter((k) => !TRACK_ORDER.includes(k) && !COMMON.includes(k) && TRACK_META[k]);
  return [...order, ...extra];
}

/** 日历筛选 / 图例 / 编辑下拉：方向 + 公共课程 */
function allTracks() {
  const set = new Set(state.data.sessions.map((s) => s.track));
  const list = presentTracks();
  COMMON.forEach((k) => { if (set.has(k)) list.push(k); });
  if (set.has('other')) list.push('other');
  return list;
}

/* ============================ 渲染：总览 ============================ */

function renderOverview() {
  const st = stats();
  $('#stat-total').textContent = st.total;
  $('#stat-done').textContent = st.done;
  $('#stat-todo').textContent = st.todo;
  $('#stat-bar').style.width = st.pct + '%';

  if (st.first && st.last) {
    const a = parseISO(st.first), b = parseISO(st.last);
    $('#cycle-pill').textContent = `${a.getFullYear()}.${String(a.getMonth() + 1).padStart(2, '0')} — ${b.getFullYear()}.${String(b.getMonth() + 1).padStart(2, '0')}`;
    const dirTotal = st.total - st.commonTotal;
    $('#stat-foot').innerHTML =
      `<div>首课 ${fmtMD(st.first)} · 末课 ${fmtMD(st.last)} · 已完成 ${st.pct}%</div>` +
      (st.commonTotal
        ? `<div class="foot-note">公共课 ${st.commonTotal} 节不计入方向进度 · 四方向合计 ${dirTotal} 节${st.tbd ? `（含 ${st.tbd} 节待排期）` : ''}</div>`
        : '');
  }

  const meta = state.data.meta || {};
  const src = meta.source ? `数据来源：${meta.source}` : '数据来源：本地课程表';
  const up = meta.updatedAt ? ` · 更新于 ${new Date(meta.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}` : '';
  $('#meta-line').innerHTML =
    `<span class="meta-sub">${esc(meta.subtitle || '2026-2027学年度 · 产学研发展中心')}</span>` +
    `<span class="meta-src">　|　${esc(src)}${esc(up)}</span>`;

  const wrap = $('#track-cards');
  wrap.innerHTML = presentTracks().map((key) => {
    const t = trackOf(key);
    const s = trackStats(key);
    let nextHtml;
    if (s.next) {
      nextHtml = `<div class="track-next"><span class="nx-date">${fmtMD(s.next.date)} ${s.next.start || ''}</span><b>${esc(s.next.title)}</b></div>`;
    } else if (s.tbd) {
      nextHtml = `<div class="track-next"><span class="nx-date">—</span><b>${s.tbd} 节待排期，日期未定</b></div>`;
    } else {
      nextHtml = `<div class="track-next"><span class="nx-date">—</span><b>课程已全部完成</b></div>`;
    }
    return `
      <div class="track-card" style="--tc:${t.hex}">
        <div class="track-head">
          <div class="track-name">${esc(t.name)}</div>
          <div class="track-sub">${esc(s.tbd ? `计划 ${s.total} 节 · ${s.tbd} 节待排期` : t.desc)}</div>
        </div>
        <div class="track-bar"><span style="width:${s.pct}%"></span></div>
        <div class="track-nums">
          <div class="track-meta">
            <span>已上 <b>${s.done}</b> 节</span>
            <span>待上 <b>${s.todo}</b> 节</span>
          </div>
          <div class="track-ratio"><b>${s.pct}</b>%</div>
        </div>
        ${nextHtml}
      </div>`;
  }).join('');
}

/* ============================ 渲染：筛选 ============================ */

function renderFilters() {
  const keys = allTracks();
  const el = $('#filters');
  if (keys.length <= 1) { el.innerHTML = ''; return; }
  el.innerHTML =
    `<button class="chip ${state.filter === 'all' ? 'on' : ''}" data-filter="all">全部</button>` +
    keys.map((k) => {
      const t = trackOf(k);
      return `<button class="chip ${state.filter === k ? 'on' : ''}" data-filter="${k}" style="--cc:${t.hex}"><i class="cdot"></i>${esc(t.short)}</button>`;
    }).join('');
}

/* ============================ 渲染：周视图 ============================ */

function sessionsOn(dateStr) {
  return state.data.sessions
    .filter((s) => s.date === dateStr)
    .filter((s) => state.filter === 'all' || s.track === state.filter)
    .sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
}

function renderWeek() {
  const ws = startOfWeek(state.cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const we = days[6];

  const weekSessions = days.flatMap((d) => sessionsOn(iso(d)));
  $('#view-title').innerHTML =
    `<b>${ws.getFullYear()}年${ws.getMonth() + 1}月${ws.getDate()}日 — ${we.getMonth() + 1}月${we.getDate()}日</b>` +
    `<span>本周 ${weekSessions.length} 节${state.filter !== 'all' ? '（已按方向筛选）' : ''}</span>`;

  $('#panel-week').innerHTML = `<div class="week-grid">${days.map((d) => {
    const key = iso(d);
    const list = sessionsOn(key);
    const isToday = sameDay(d, state.today);
    return `
      <div class="week-col ${isToday ? 'is-today' : ''}" data-date="${key}">
        <div class="week-col-head">
          <span class="dow">${DOW[d.getDay()]}</span>
          <span class="dnum">${d.getDate()}</span>
        </div>
        <div class="week-col-body">
          ${list.length ? list.map(sessionCard).join('') : '<div class="week-empty">—</div>'}
        </div>
      </div>`;
  }).join('')}</div>`;
}

function sessionCard(s) {
  const t = trackOf(s.track);
  const past = s.date < TODAY_ISO;
  return `
    <div class="sess ${past ? 'is-past' : ''}" style="--tc:${t.hex}" data-edit="${esc(s.id)}" title="点击编辑「${esc(s.title)}」">
      <div class="sess-time">${esc(timeText(s))}</div>
      <div class="sess-title">${esc(s.title)}</div>
      <div class="sess-teacher">${esc(s.teacher || '—')}${s.expected ? ' · ' + esc(s.expected) : ''}</div>
    </div>`;
}

/* ============================ 渲染：月视图 ============================ */

function renderMonth() {
  const y = state.cursor.getFullYear();
  const m = state.cursor.getMonth();
  const first = new Date(y, m, 1);
  const gridStart = startOfWeek(first);
  const lastDate = new Date(y, m + 1, 0);
  const rows = Math.ceil((((lastDate - gridStart) / 86400000) + 1) / 7);

  let total = 0;
  const cells = [];
  for (let i = 0; i < rows * 7; i++) {
    const d = addDays(gridStart, i);
    const key = iso(d);
    const list = sessionsOn(key);
    if (d.getMonth() === m) total += list.length;
    const dim = d.getMonth() !== m;
    const isToday = sameDay(d, state.today);
    const shown = list.slice(0, 3);
    cells.push(`
      <div class="month-cell ${dim ? 'dim' : ''} ${isToday ? 'is-today' : ''}" data-date="${key}">
        <div class="mnum"><span>${d.getDate()}</span>${list.length > 1 ? `<span class="mn-count">${list.length} 节</span>` : ''}</div>
        ${shown.map((s) => {
          const t = trackOf(s.track);
          return `<div class="mchip" style="--tc:${t.hex};--tc-soft:${t.soft}" data-edit="${esc(s.id)}" title="${esc(s.title)}｜${esc(timeText(s))}｜${esc(s.teacher || '')}">
            ${s.start ? `<span class="mt">${s.start}</span>` : ''}${esc(s.title)}
          </div>`;
        }).join('')}
        ${list.length > 3 ? `<div class="mmore" data-more="${key}">+${list.length - 3} 节</div>` : ''}
      </div>`);
  }

  $('#view-title').innerHTML = `<b>${y}年${m + 1}月</b><span>本月 ${total} 节${state.filter !== 'all' ? '（已按方向筛选）' : ''}</span>`;
  $('#panel-month').innerHTML = `
    <div class="month-dow">${['一', '二', '三', '四', '五', '六', '日'].map((x) => `<div>周${x}</div>`).join('')}</div>
    <div class="month-grid">${cells.join('')}</div>`;
}

/* ============================ 渲染：年视图 ============================ */

function renderYear() {
  const scope = state.data.sessions.filter((s) => state.filter === 'all' || s.track === state.filter);
  const list = scope.filter((s) => s.date);          // 只有已排期的进月历
  const tbdList = scope.filter((s) => !s.date);      // 待排期单独列在底部
  const all = list.map((s) => s.date).sort();
  if (!all.length) {
    $('#panel-year').innerHTML = '<div style="padding:40px;text-align:center;color:#858b99">暂无已排期课程</div>';
    return;
  }
  const first = parseISO(all[0]);
  const last = parseISO(all[all.length - 1]);

  const months = [];
  let cur = new Date(first.getFullYear(), first.getMonth(), 1);
  const end = new Date(last.getFullYear(), last.getMonth(), 1);
  while (cur <= end) {
    months.push(new Date(cur));
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }

  const byMonth = new Map();
  list.forEach((s) => {
    const d = parseISO(s.date);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(s);
  });

  const cards = months.map((mo) => {
    const y = mo.getFullYear(), m = mo.getMonth();
    const items = byMonth.get(`${y}-${m}`) || [];
    const dayCount = new Map();
    items.forEach((s) => dayCount.set(s.date, (dayCount.get(s.date) || 0) + 1));
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // 周一=0
    const days = new Date(y, m + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push('<div></div>');
    for (let d = 1; d <= days; d++) {
      const key = iso(new Date(y, m, d));
      const n = dayCount.get(key) || 0;
      const sess = items.find((s) => s.date === key);
      const t = sess ? trackOf(sess.track) : null;
      const isToday = key === TODAY_ISO;
      cells.push(`<div class="ym-day ${n ? 'has' : ''} ${isToday ? 'today' : ''}" ${n ? `style="background:${t.hex}"` : ''} title="${m + 1}月${d}日${n ? ` · ${n} 节课` : ''}"></div>`);
    }
    return `
      <div class="year-month" data-month="${y}-${m}">
        <div class="ym-head">
          <div class="ym-name">${m + 1}月<span>${y}</span></div>
          <div class="ym-count">${items.length ? `<b>${items.length}</b> 节` : '—'}</div>
        </div>
        <div class="ym-days">${cells.join('')}</div>
      </div>`;
  });

  const total = list.length;
  $('#view-title').innerHTML = `<b>${first.getFullYear()}年${first.getMonth() + 1}月 — ${last.getFullYear()}年${last.getMonth() + 1}月</b><span>已排期 ${total} 节 · 覆盖 ${months.length} 个月${tbdList.length ? ` · 另有 ${tbdList.length} 节待排期` : ''}</span>`;

  const legend = allTracks().map((k) => {
    const t = trackOf(k);
    return `<span><i style="background:${t.hex}"></i>${esc(t.name)}</span>`;
  }).join('') + '<span style="margin-left:auto">点击月份可查看当月课表</span>';

  const tbdByTrack = {};
  tbdList.forEach((s) => { tbdByTrack[s.track] = (tbdByTrack[s.track] || 0) + 1; });
  const tbdRow = tbdList.length
    ? `<div class="tbd-row"><span class="tbd-label">待排期</span>${Object.entries(tbdByTrack).map(([k, n]) => {
        const t = trackOf(k);
        return `<span class="tbd-chip" style="--tc:${t.hex};--tc-soft:${t.soft}">${esc(t.name)}<b>×${n}</b></span>`;
      }).join('')}<span class="tbd-hint">日期未定，排期后会在月历中出现</span></div>`
    : '';

  $('#panel-year').innerHTML = `<div class="year-grid">${cards.join('')}</div>${tbdRow}<div class="year-legend">${legend}</div>`;
}

/* ============================ 渲染：调度 ============================ */

function renderAll() {
  if (state.filter !== 'all' && !presentTracks().includes(state.filter)) state.filter = 'all';
  renderOverview();
  renderFilters();
  renderView();
  renderSourceBox();
}

function renderView() {
  const nav = $('#nav-group');
  nav.hidden = state.view === 'year';
  $('#panel-week').hidden = state.view !== 'week';
  $('#panel-month').hidden = state.view !== 'month';
  $('#panel-year').hidden = state.view !== 'year';
  $$('#segmented button').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  if (state.view === 'week') renderWeek();
  else if (state.view === 'month') renderMonth();
  else renderYear();
}

/* ============================ 交互：视图导航 ============================ */

$('#segmented').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.view = b.dataset.view;
  history.replaceState(null, '', '#' + state.view);
  renderView();
});

// 支持 #week / #month / #year 直达
function applyHash() {
  const h = (location.hash || '').replace('#', '');
  if (['week', 'month', 'year'].includes(h)) state.view = h;
}

$('#nav-prev').addEventListener('click', () => shift(-1));
$('#nav-next').addEventListener('click', () => shift(1));
$('#nav-today').addEventListener('click', () => {
  state.cursor = startOfDay(new Date());
  renderView();
});

function shift(dir) {
  if (state.view === 'week') state.cursor = addDays(state.cursor, dir * 7);
  else if (state.view === 'month') state.cursor = new Date(state.cursor.getFullYear(), state.cursor.getMonth() + dir, 1);
  renderView();
}

$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  state.filter = b.dataset.filter;
  renderFilters();
  renderView();
});

// 年视图：点击月份进入月视图
$('#panel-year').addEventListener('click', (e) => {
  const mo = e.target.closest('.year-month');
  if (!mo) return;
  const [y, m] = mo.dataset.month.split('-').map(Number);
  state.cursor = new Date(y, m, 1);
  state.view = 'month';
  renderView();
});

// 点击课程 → 打开编辑（拖动刚结束时忽略这一次点击）
document.addEventListener('click', (e) => {
  if (justDragged) { justDragged = false; e.stopPropagation(); return; }
  const el = e.target.closest('[data-edit]');
  if (el) {
    openEdit(el.dataset.edit);
    return;
  }
  const more = e.target.closest('[data-more]');
  if (more) {
    state.cursor = parseISO(more.dataset.more);
    state.view = 'week';
    renderView();
  }
});

/* ============================ 弹窗通用 ============================ */

function openModal(id) {
  $(id).hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  $(id).hidden = true;
  document.body.style.overflow = '';
}
$$('[data-close]').forEach((el) => el.addEventListener('click', () => {
  const modal = el.closest('.modal');
  if (modal) closeModal('#' + modal.id);
}));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') $$('.modal').forEach((m) => { if (!m.hidden) closeModal('#' + m.id); });
});

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

/* ============================ 拖动改期 ============================ */

let justDragged = false;   // 刚拖完，吞掉紧随其后的一次点击
let drag = null;

function snapshotOf() { return JSON.stringify(state.data.sessions); }
function isDirty() { return state.savedSnapshot !== snapshotOf(); }

/** 相对上次保存，哪些课的日期被改过 */
function movedList() {
  let base = [];
  try { base = JSON.parse(state.savedSnapshot || '[]'); } catch (_) { base = []; }
  const map = new Map(base.map((s) => [s.id, s]));
  return state.data.sessions.filter((s) => {
    const b = map.get(s.id);
    return b && b.date !== s.date;
  });
}

function updateDirtyBar() {
  const bar = $('#dirty-bar');
  if (!bar) return;
  const dirty = isDirty() && !READONLY;
  bar.hidden = !dirty;
  document.body.classList.toggle('has-dirty', dirty);
  if (!dirty) return;
  const moved = movedList();
  $('#dirty-text').textContent = moved.length
    ? `已移动 ${moved.length} 节课，尚未保存`
    : '课程表有未保存的改动';
}

function setEditMode(on) {
  state.editMode = !!on && !READONLY;
  document.body.classList.toggle('is-dragmode', state.editMode);
  const btn = $('#btn-dragmode');
  if (btn) {
    btn.classList.toggle('on', state.editMode);
    const lbl = btn.querySelector('.lbl');
    if (lbl) lbl.textContent = state.editMode ? '拖动编辑 · 开' : '拖动编辑';
  }
  const hint = $('#drag-hint');
  if (hint) hint.hidden = !state.editMode;
  syncPushButton();
  if (state.editMode) toast('拖动编辑已开启：按住课程块拖到其它日期');
}

/** 目标日期格（周视图的某一列 / 月视图的某一格） */
function dropCellAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest('.week-col[data-date], .month-cell[data-date]') : null;
}

function beginDrag(e) {
  if (!state.editMode || READONLY) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const card = e.target.closest('.sess, .mchip');
  if (!card) return;
  const sess = state.data.sessions.find((s) => s.id === card.dataset.edit);
  if (!sess || !sess.date) return;
  drag = { id: sess.id, card, from: sess.date, x0: e.clientX, y0: e.clientY, active: false, hot: null, ghost: null };
  window.addEventListener('pointermove', onDragMove, { passive: false });
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
}

function onDragMove(e) {
  if (!drag) return;
  const dx = e.clientX - drag.x0;
  const dy = e.clientY - drag.y0;
  if (!drag.active) {
    if (Math.hypot(dx, dy) < 6) return;      // 抖动阈值，避免误触
    startGhost(e);
  }
  e.preventDefault();
  drag.ghost.style.left = e.clientX - drag.offX + 'px';
  drag.ghost.style.top = e.clientY - drag.offY + 'px';
  const cell = dropCellAt(e.clientX, e.clientY);
  if (cell !== drag.hot) {
    if (drag.hot) drag.hot.classList.remove('drop-hot');
    drag.hot = cell;
    if (cell) cell.classList.add('drop-hot');
  }
}

function startGhost(e) {
  drag.active = true;
  const r = drag.card.getBoundingClientRect();
  const ghost = drag.card.cloneNode(true);
  ghost.classList.add('drag-ghost');
  ghost.style.width = r.width + 'px';
  ghost.style.left = r.left + 'px';
  ghost.style.top = r.top + 'px';
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  drag.offX = e.clientX - r.left;
  drag.offY = e.clientY - r.top;
  drag.card.classList.add('drag-src');
  document.body.classList.add('is-dragging');
}

function endDrag(e) {
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', endDrag);
  window.removeEventListener('pointercancel', endDrag);
  const d = drag;
  drag = null;
  if (!d) return;
  if (d.ghost) d.ghost.remove();
  if (d.card) d.card.classList.remove('drag-src');
  if (d.hot) d.hot.classList.remove('drop-hot');
  document.body.classList.remove('is-dragging');
  if (!d.active) return;                     // 只是点了一下 → 交给点击编辑

  justDragged = true;
  setTimeout(() => { justDragged = false; }, 120);

  const cell = e && e.clientX != null ? dropCellAt(e.clientX, e.clientY) : null;
  const to = cell && cell.dataset.date;
  if (!to || to === d.from) { toast('放回原处，未改动'); return; }
  applyMove(d.id, to);
}

function applyMove(id, to) {
  const s = state.data.sessions.find((x) => x.id === id);
  if (!s) return;
  const from = s.date;
  s.date = to;
  sortSessions();
  renderAll();
  updateDirtyBar();
  toast(`「${s.title}」　${fmtMD(from)} → ${fmtMD(to)}`);
}

function sortSessions() {
  state.data.sessions.sort((a, b) => {
    if (!a.date && b.date) return 1;
    if (a.date && !b.date) return -1;
    if (a.date === b.date) return (a.start || '99').localeCompare(b.start || '99');
    return a.date.localeCompare(b.date);
  });
}

/** 保存时按日期重排受影响方向的节数（沿用原有编号集合，不新增不删号） */
function renumberTracks(keys) {
  let changed = 0;
  keys.forEach((tk) => {
    const rows = state.data.sessions
      .filter((s) => s.track === tk && s.date && /第[一二三四五六七八九十]+节/.test(s.title))
      .sort((a, b) => (a.date === b.date
        ? (a.start || '99').localeCompare(b.start || '99')
        : a.date.localeCompare(b.date)));
    const nums = rows.map((r) => /第([一二三四五六七八九十]+)节/.exec(r.title)[1]);
    const asc = nums.slice().sort((a, b) => CN_NUM.indexOf(a) - CN_NUM.indexOf(b));
    rows.forEach((r, i) => {
      if (nums[i] === asc[i]) return;
      r.title = r.title.replace(/第[一二三四五六七八九十]+节/, `第${asc[i]}节`);
      changed++;
    });
  });
  return changed;
}

/* --- 交互绑定 --- */

document.addEventListener('pointerdown', beginDrag, { passive: true });

$('#btn-dragmode').addEventListener('click', () => setEditMode(!state.editMode));

$('#btn-undo').addEventListener('click', () => {
  try {
    state.data.sessions = JSON.parse(state.savedSnapshot || '[]');
  } catch (_) {
    toast('撤销失败：快照损坏');
    return;
  }
  renderAll();
  updateDirtyBar();
  toast('已撤销未保存的改动');
});

$('#btn-save-drag').addEventListener('click', async () => {
  const btn = $('#btn-save-drag');
  if (btn.disabled) return;
  const moved = movedList();
  const tracks = [...new Set(moved.map((s) => s.track))];
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = '保存中…';
  try {
    const renum = renumberTracks(tracks);
    await persistSessions(state.data.sessions, { github: false });
    state.savedSnapshot = snapshotOf();
    state.unpushed = true;
    renderAll();
    updateDirtyBar();
    syncPushButton();
    toast(
      `已保存到本机${renum ? `，并按日期重排了 ${renum} 处节数` : ''}` +
        (canPush() ? ' · 可点右上角「推送上线」' : '')
    );
  } catch (err) {
    toast('保存失败：' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
});

/* --- 推送上线 --- */

function canPush() { return !READONLY && !!GH.get().token; }

function syncPushButton() {
  const btn = $('#btn-push');
  if (!btn) return;
  btn.hidden = READONLY || !state.editMode;
  btn.classList.toggle('needs-setup', !canPush());
  const dot = $('#push-dot');
  if (dot) dot.hidden = !state.unpushed;
}

$('#btn-push').addEventListener('click', async () => {
  if (READONLY) return;
  if (isDirty()) { toast('还有未保存的改动，先点「保存到本机」'); return; }
  const cfg = GH.get();
  if (!cfg.token) {
    toast('还没配置令牌，先填一下仓库和访问令牌');
    openMaint();
    return;
  }
  const btn = $('#btn-push');
  const lbl = btn.querySelector('.lbl');
  if (btn.disabled) return;
  btn.disabled = true;
  if (lbl) lbl.textContent = '推送中…';
  try {
    const json = JSON.stringify(state.data, null, 2);
    const sha = await ghCommitFiles(
      cfg,
      { 'data/courses.json': json, 'docs/data/courses.json': json },
      `课程表更新：${new Date().toLocaleString('zh-CN')}`
    );
    state.unpushed = false;
    syncPushButton();
    toast(`已推送到 GitHub（${sha.slice(0, 7)}），约 1 分钟后线上生效`);
  } catch (err) {
    toast('推送失败：' + err.message);
  } finally {
    btn.disabled = false;
    if (lbl) lbl.textContent = '推送上线';
  }
});

// 有未保存改动时，离开页面前提醒
window.addEventListener('beforeunload', (e) => {
  if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
});

/* ============================ 维护设置 ============================ */

function openMaint() {
  const cfg = GH.get();
  $('#maint-repo').value = cfg.repo;
  $('#maint-branch').value = cfg.branch;
  $('#maint-token').value = cfg.token;
  $('#maint-status').hidden = true;
  openModal('#modal-maint');
}

$('#mode-badge').addEventListener('click', () => {
  if (EDIT_PARAM && RUNTIME.mode === 'static') openMaint();
});

$('#maint-save').addEventListener('click', async () => {
  const cfg = {
    repo: $('#maint-repo').value.trim(),
    branch: $('#maint-branch').value.trim() || 'main',
    token: $('#maint-token').value.trim(),
  };
  const st = $('#maint-status');
  st.hidden = false;

  if (!/^[^/\s]+\/[^/\s]+$/.test(cfg.repo)) {
    st.className = 'upload-status err';
    st.textContent = '仓库格式应为「用户名/仓库名」，例如 bdhlw/BDHLWPX';
    return;
  }
  if (!cfg.token) {
    st.className = 'upload-status err';
    st.textContent = '请填写访问令牌';
    return;
  }

  st.className = 'upload-status loading';
  st.textContent = '正在验证仓库与令牌…';
  try {
    const repo = await ghFetch(cfg, `/repos/${cfg.repo}`);
    const ref = await ghFetch(cfg, `/repos/${cfg.repo}/git/ref/heads/${cfg.branch}`);
    GH.set(cfg);
    applyModeUI();
    st.className = 'upload-status';
    st.textContent =
      `✓ 已连接 ${repo.full_name}（${cfg.branch}，当前提交 ${ref.object.sha.slice(0, 7)}）。` +
      '现在可以直接编辑或上传，保存后会提交到仓库并自动重新发布。';
    toast('维护模式已就绪');
  } catch (err) {
    st.className = 'upload-status err';
    st.textContent = '验证失败：' + err.message;
  }
});

$('#maint-clear').addEventListener('click', () => {
  GH.clear();
  $('#maint-token').value = '';
  const st = $('#maint-status');
  st.hidden = false;
  st.className = 'upload-status';
  st.textContent = '已清除本机保存的令牌。之后保存只写入本机浏览器，不会发布。';
  applyModeUI();
});

/* ============================ 编辑课程 ============================ */

$('#btn-edit').addEventListener('click', () => openEdit(null));

function openEdit(focusId) {
  if (READONLY) return;
  state.editing = state.data.sessions.map((s) => ({ ...s }));
  renderEditTable();
  openModal('#modal-edit');
  if (focusId) {
    requestAnimationFrame(() => {
      const row = $(`#edit-body tr[data-id="${CSS.escape(focusId)}"]`);
      if (row) {
        row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        row.style.transition = 'background .3s';
        $$('td', row).forEach((td) => (td.style.background = '#fff8e1'));
        setTimeout(() => $$('td', row).forEach((td) => (td.style.background = '')), 1600);
      }
    });
  }
}

function trackOptions(sel) {
  const keys = Array.from(new Set([...TRACK_ORDER, ...allTracks(), 'other']));
  return keys.map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${esc(TRACK_META[k].name)}</option>`).join('');
}

function renderEditTable() {
  const body = $('#edit-body');
  body.innerHTML = state.editing.map((s) => `
    <tr data-id="${esc(s.id)}" class="${s.__new ? 'is-new' : ''}${s.date ? '' : ' is-tbd'}">
      <td><input type="date" data-f="date" value="${esc(s.date)}" /></td>
      <td><input type="time" data-f="start" value="${esc(s.start)}" /></td>
      <td><input type="time" data-f="end" value="${esc(s.end)}" /></td>
      <td><input type="text" data-f="title" value="${esc(s.title)}" placeholder="课程名称" /></td>
      <td><input type="text" data-f="teacher" value="${esc(s.teacher)}" placeholder="授课教师" /></td>
      <td><input type="text" data-f="expected" value="${esc(s.expected)}" placeholder="人数" /></td>
      <td><select data-f="track">${trackOptions(s.track)}</select></td>
      <td><button class="row-del" data-del="${esc(s.id)}" title="删除这节课">✕</button></td>
    </tr>`).join('');
  $('#edit-count').textContent = `共 ${state.editing.length} 节`;
}

$('#edit-body').addEventListener('input', (e) => {
  const el = e.target;
  const f = el.dataset.f;
  if (!f) return;
  const tr = el.closest('tr');
  const item = state.editing.find((s) => s.id === tr.dataset.id);
  if (!item) return;
  item[f] = el.value;
});
$('#edit-body').addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.f === 'track') {
    const tr = el.closest('tr');
    const item = state.editing.find((s) => s.id === tr.dataset.id);
    if (item) item.track = el.value;
  }
});

$('#edit-body').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-del]');
  if (!btn) return;
  const id = btn.dataset.del;
  state.editing = state.editing.filter((s) => s.id !== id);
  renderEditTable();
});

$('#btn-add-row').addEventListener('click', () => {
  const id = 'new-' + Date.now().toString(36);
  state.editing.push({
    id,
    date: TODAY_ISO,
    start: '',
    end: '',
    title: '',
    teacher: '',
    expected: '',
    track: presentTracks()[0] || 'ip',
    kind: 'lesson',
    __new: true,
  });
  renderEditTable();
  const row = $(`#edit-body tr[data-id="${id}"]`);
  if (row) {
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    $('input[data-f="title"]', row).focus();
  }
});

$('#btn-save').addEventListener('click', async () => {
  const clean = state.editing
    .filter((s) => s.title.trim())
    .map((s) => ({
      id: s.id.startsWith('new-') ? 's' + Math.random().toString(36).slice(2, 7) : s.id,
      date: s.date || '',
      start: s.start || '',
      end: s.end || '',
      title: s.title.trim(),
      teacher: (s.teacher || '').trim(),
      expected: (s.expected || '').trim(),
      track: s.track,
      kind: s.kind || 'lesson',
    }))
    .sort((a, b) => {
      if (!a.date && b.date) return 1;          // 待排期的排到最后
      if (a.date && !b.date) return -1;
      if (!a.date && !b.date) return 0;
      return a.date === b.date ? (a.start || '99').localeCompare(b.start || '99') : a.date.localeCompare(b.date);
    });

  if (!clean.length) { toast('至少需要保留一节课'); return; }

  const dropped = state.editing.length - clean.length;
  try {
    const saved = await persistSessions(clean);
    state.data.sessions = clean;
    state.data.meta.total = clean.length;
    state.data.meta.updatedAt = new Date().toISOString();
    if (saved.mode === 'static') state.data.meta.localDraft = true;
    closeModal('#modal-edit');
    applyModeUI();
    renderAll();
    const tail =
      saved.mode === 'github'
        ? ' · 已提交到 GitHub，约 1 分钟全站生效'
        : saved.mode === 'github-error'
        ? ' · 提交 GitHub 失败（' + saved.error + '），已存在本机浏览器'
        : saved.mode === 'static'
        ? ' · 存在本机浏览器'
        : '';
    toast(`已保存 ${clean.length} 节课${dropped ? `（忽略了 ${dropped} 条没有课名的空行）` : ''}${tail}`);
  } catch (err) {
    toast('保存失败：' + err.message);
  }
});

/** 保存课程：本地服务写文件，静态版写 localStorage 草稿
 *  opts.github === false 时即使配了令牌也只写本机（拖动改期走这条，推送是单独一步）
 */
async function persistSessions(list, opts = {}) {
  const allowGithub = opts.github !== false;
  const payload = { ...state.data, sessions: list, meta: { ...(state.data.meta || {}), total: list.length } };
  if (RUNTIME.mode === 'server') {
    const res = await fetch('api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const out = await res.json();
    if (!res.ok || !out.ok) throw new Error(out.error || '保存失败');
    return { mode: 'server' };
  }
  // 先把本机草稿写一份，保证维护者刷新后立刻看到自己的改动
  localStorage.setItem(RUNTIME.draftKey, JSON.stringify(payload));

  const cfg = GH.get();
  if (allowGithub && EDIT_PARAM && cfg.token) {
    const json = JSON.stringify(payload, null, 2);
    try {
      const sha = await ghCommitFiles(
        cfg,
        { 'data/courses.json': json, 'docs/data/courses.json': json },
        `更新课程表：${new Date().toLocaleString('zh-CN')}`
      );
      return { mode: 'github', sha };
    } catch (err) {
      // 提交失败不丢改动：本机草稿已写入，下次刷新仍能看到
      return { mode: 'github-error', error: err.message };
    }
  }
  return { mode: 'static' };
}

function downloadJSON() {
  const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'courses.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#btn-export').addEventListener('click', () => {
  if (RUNTIME.mode === 'server') window.location.href = 'api/export';
  else downloadJSON();
});

/* ============================ 上传课程表 ============================ */

$('#btn-upload').addEventListener('click', () => {
  if (READONLY) return;
  $('#upload-status').hidden = true;
  openModal('#modal-upload');
  renderSourceBox();
});

function renderSourceBox() {
  const meta = state.data.meta || {};
  const box = $('#source-box');
  if (!box) return;
  box.innerHTML = `
    <div>当前数据来源：<b>${esc(meta.source || 'courses.json')}</b>${meta.localDraft ? ' <span style="color:#8a6d3b">（含本机浏览器改动）</span>' : ''}</div>
    <div>课程总数：<b>${state.data.sessions.length}</b> 节${meta.updatedAt ? ` · 更新于 <b>${new Date(meta.updatedAt).toLocaleString('zh-CN')}</b>` : ''}</div>`;
}

const dropzone = $('#dropzone');
const fileInput = $('#file-input');

['dragenter', 'dragover'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.add('drag'); })
);
['dragleave', 'drop'].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => { e.preventDefault(); dropzone.classList.remove('drag'); })
);
dropzone.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0];
  if (f) uploadFile(f);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) uploadFile(fileInput.files[0]);
});

async function uploadFile(file) {
  const allowed = ['.docx', '.csv', '.json', '.txt'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  const status = $('#upload-status');
  status.hidden = false;
  if (!allowed.includes(ext)) {
    status.className = 'upload-status err';
    status.textContent = `不支持 ${ext} 格式，请上传 .docx（推荐）、.csv 或 .json。`;
    return;
  }
  status.className = 'upload-status loading';
  status.textContent = `正在读取「${file.name}」…`;

  try {
    const buf = await file.arrayBuffer();
    let out;
    let saved = { mode: RUNTIME.mode };

    if (RUNTIME.mode === 'server') {
      const res = await fetch(`api/upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buf,
      });
      out = await res.json();
      if (!res.ok || !out.ok) throw new Error(out.error || '解析失败');
      await loadData();
    } else {
      // 静态版：在浏览器里直接解析
      if (ext === '.json') {
        const parsed = JSON.parse(new TextDecoder().decode(buf));
        if (!parsed || !Array.isArray(parsed.sessions)) throw new Error('JSON 里没有 sessions 数组');
        out = { total: parsed.sessions.length, source: file.name, sessions: parsed.sessions, meta: parsed.meta };
      } else if (ext === '.docx') {
        if (!window.parseCourseDocx) throw new Error('解析器未加载');
        const parsed = await window.parseCourseDocx(buf, file.name);
        out = { total: parsed.sessions.length, source: file.name, sessions: parsed.sessions, meta: parsed.meta };
      } else {
        throw new Error('静态版目前只能解析 .docx 和 .json');
      }
      state.data = {
        meta: { ...(state.data.meta || {}), ...(out.meta || {}), source: out.source, updatedAt: new Date().toISOString(), localDraft: true },
        sessions: out.sessions.map((s) => ({ ...s, title: normalizeTitle(s.title || '') })),
      };
      saved = await persistSessions(out.sessions);
      applyModeUI();
      renderAll();
    }

    const tail =
      RUNTIME.mode === 'static'
        ? saved.mode === 'github'
          ? '已提交到 GitHub，约 1 分钟后全站生效。'
          : saved.mode === 'github-error'
          ? `提交 GitHub 失败（${saved.error}），改动已存在本机浏览器。`
          : '（保存在本机浏览器）'
        : '';
    status.className = saved.mode === 'github-error' ? 'upload-status err' : 'upload-status';
    status.textContent = `✓ 已读取「${out.source}」，共识别 ${out.total} 节课，看板已同步更新。` + tail;
    renderSourceBox();
    toast(`课程表已更新，共 ${out.total} 节课`);
    fileInput.value = '';
    setTimeout(() => closeModal('#modal-upload'), saved.mode === 'github-error' ? 4000 : 1400);
  } catch (err) {
    status.className = 'upload-status err';
    status.textContent = `处理失败：${err.message}\n请确认文档中包含“时间 / 培训项目名称 / 授课教师 / 参与学生人数”四列的表格。`;
  }
}

/* ============================ 日期翻页 ============================ */

/** 视图是否还停在「旧今天」所在的周 / 月 / 年（没被用户翻走） */
function viewingCurrentPeriod(oldToday) {
  if (state.view === 'week') return iso(startOfWeek(state.cursor)) === iso(startOfWeek(oldToday));
  if (state.view === 'month') return iso(state.cursor).slice(0, 7) === iso(oldToday).slice(0, 7);
  return state.cursor.getFullYear() === oldToday.getFullYear();
}

/** 日期跨天后重算进度；页面一直开着也会自己往前走 */
function refreshToday() {
  const nowIso = iso(new Date());
  if (nowIso === TODAY_ISO) return false;
  const oldToday = state.today;
  const follow = viewingCurrentPeriod(oldToday);
  TODAY_ISO = nowIso;
  state.today = startOfDay(new Date());
  if (follow) state.cursor = startOfDay(new Date());
  renderAll();
  return true;
}

/* ============================ 启动 ============================ */

applyHash();
loadData().then(() => {
  const m = new URLSearchParams(location.search).get('modal');
  if (m === 'edit') openEdit(null);
  if (m === 'upload') { $('#upload-status').hidden = true; openModal('#modal-upload'); renderSourceBox(); }

  // 跨零点：每分钟对一次日期（含电脑休眠醒来、标签页切回）
  setInterval(refreshToday, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshToday(); });
  window.addEventListener('focus', refreshToday);
});

/* 时间条不依赖数据加载，立即渲染并自己走 */
renderNowbar();
setInterval(renderNowbar, 20 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) renderNowbar(); });
