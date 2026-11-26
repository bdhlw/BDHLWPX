#!/bin/bash
# 双击启动「编导拍播培训 · 课程看板」（本机 + 局域网都能访问）
cd "$(dirname "$0")" || exit 1

PORT=${PORT:-8088}

# 端口上是不是已经有一个健康的看板在跑（返回的 JSON 里带 sessions）
health() {
  curl -s --max-time 2 "http://127.0.0.1:$1/api/data" 2>/dev/null | grep -q '"sessions"'
}

# 1) 已经在跑 → 直接开浏览器，不重复启动
if health "$PORT"; then
  echo "看板已经在运行：http://127.0.0.1:$PORT"
  open "http://127.0.0.1:$PORT" >/dev/null 2>&1
  exit 0
fi

# 2) 端口被残留进程占着（不响应或半死）→ 清掉它，让地址固定
if lsof -ti :"$PORT" >/dev/null 2>&1; then
  echo "发现端口 $PORT 上有残留进程，正在清理…"
  lsof -ti :"$PORT" | xargs kill -9 2>/dev/null
  sleep 1
fi

# 3) 仍被占（别的程序）→ 依次往后找空闲端口
while lsof -i :"$PORT" >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

LAN=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
echo "课程看板启动中…"
echo "  本机   http://127.0.0.1:$PORT"
[ -n "$LAN" ] && echo "  局域网 http://$LAN:$PORT"
echo "（关闭此终端窗口即停止服务。以后打不开就再双击一次本文件）"
echo ""

sleep 0.8
open "http://127.0.0.1:$PORT" >/dev/null 2>&1

PORT=$PORT HOST=0.0.0.0 node server.js
