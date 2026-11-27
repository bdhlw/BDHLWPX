# 交接说明（给在这台机器上继续的助手看）

> 这份文件是给 AI 助手看的"当前状态交接"。人类用户看 `README.txt` 就够。
> 最后更新：2026-11-27，来源机器：Mac 10.10.11.117（项目原开发机）。

## 一、这是什么

邦德产学研中心的「互联网"编导拍播"培训 · 课程看板」。零依赖 Node.js 静态服务 + 原生 HTML/CSS/JS 单页应用，没有构建步骤、没有 npm 依赖。

- 入口：`server.js`（HTTP 服务，端口 **8088**，绑定 **0.0.0.0**，可用 `PORT` / `HOST` 环境变量覆盖）
- 前端：`public/`（index.html / app.js / styles.css / docx-client.js / assets/logo.png）
- 数据：`data/courses.json`（38 节课），每次保存前自动备份到 `data/backup/`（保留 20 份）
- 解析器：`lib/parse-docx.js`（Node 端，零依赖手写 ZIP + WordprocessingML 正则）；浏览器端同规则实现在 `public/docx-client.js`
- 静态发布版：`docs/`（GitHub Pages 用，由 `node scripts/build-pages.js` 生成，勿手改）

## 二、这台机器（Windows）上的启动方式

双击 `start.bat`。首次会弹 Windows 防火墙，必须勾「专用网络」并允许，否则局域网打不开。

- 本机访问：http://127.0.0.1:8088
- 局域网访问：http://10.10.2.92:8088 （这是本次部署目标地址）
- 黑窗口关掉＝服务停。需要常驻就让它开着窗口。

**不要装开机自启**（用户 2026-11-26 明确要求过）。不要写 launchd / 登录项 / 计划任务。

## 三、当前业务状态（重要，别改错）

- 总课程 38 节：公共课 4 + "自媒体IP" 7 + "邦德膳食" 13 + "邦德自媒体骨干工作坊" 6 + "直播运营" 8（其中 7 节待排期，`date:""`）
- 膳食编号：1,2,4,5,7,8,9,10,11,12,13,14,15 —— **缺第三节、第六节是原始 Word 文档本身就跳号，不是 bug，不要"修正"成连续编号**
- 11/26（周四）的膳食第八节已按要求暂停并删除，后续节数已整体减一
- 直播运营·首节宣讲课：2026-11-30 16:40（从 11/26 改期）
- 「已上/待上」判定：`date < 今天` 算已上（按本机日期，今天当天算待上）；页面每分钟对一次日期，跨零点自动刷新
- 节数显示规则：Word 里的 ①②③ 已统一转成「第 N 节」，与课名之间一个空格（`normalizeTitle()`，三处同源）

## 四、功能入口

- 右上角：上传课程表（.docx/.csv/.json）、编辑课程（表格弹窗）
- 视图栏：周视图 / 月视图 / 年视图 + 「拖动编辑」开关
  - 开启后可把课程块拖到其它日期（只改日期不改时间）；拖完底部出现「保存到本机 / 撤销」
  - 保存时按日期重排受影响方向的节数（沿用原编号集合，不新增不删号）
- 「推送上线」按钮：仅编辑模式下出现，把 `data/courses.json` + `docs/data/courses.json` 提交到 GitHub，约 1 分钟生效

## 五、线上发布

- 仓库：https://github.com/bdhlw/BDHLWPX （public，main 分支，Pages 源 = main 分支 `/docs` 目录）
- 线上：https://bdhlw.github.io/BDHLWPX/
- 发布版是只读的（构建时注入 `window.__BUILD__={readonly:true}`，隐藏上传/编辑/拖动/推送）；维护者访问 `?edit=1` 才出现管理入口
- `scripts/build-pages.js` 会给 css/js 加内容哈希 `?v=`，绕开 Pages 的 10 分钟缓存

## 六、待办 / 已知坑

1. **GitHub 令牌**：推送需要 fine-grained token，只授权该仓库 `Contents: Read and write`。令牌只存在浏览器 localStorage（`course-board:gh`），**绝不写进仓库或代码**。用户此前在对话里贴过一个 classic token，已建议作废。
2. **Word 与看板不同步**：`2026-2027学年度编拍播导培训课程安排_261112_2.docx` 里没有「直播运营」8 节（这部分是看板上手工加的）。用户 2026-11-26 明确说"暂时不要处理"。**但每次用户要重新上传 Word 时，必须提醒：会覆盖掉直播 8 节。**
3. 网络：这台 Mac 上 `git push` 到 github.com 经常被代理拦（Empty reply / CONNECT 502）。可用 GitHub Git Data API 提交（blobs → tree → commit → refs PATCH），或重试几次。
4. 本地服务如果是 AI 在会话里后台起的，会话结束会被回收；用户自己的 `start.bat` / `start.command` 才持久。
5. 局域网版**没有写入权限控制**：同一网段任何人都能编辑/上传。如需限制，另加口令。

## 七、部署到这台机器之后要做的收尾

1. 双击 `start.bat`，确认 http://127.0.0.1:8088 能打开、数据是 38 节
2. 在另一台机器（同网段）浏览器访问 http://10.10.2.92:8088 验证
3. 若要在这台机器推送线上，需在 `?edit=1` 里重新填一次令牌（localStorage 不跨机器）
4. 检查防火墙规则是否已放行 Node.js（专用网络）
