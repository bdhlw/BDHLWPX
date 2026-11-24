#!/bin/bash
# 双击启动「编导拍播培训 · 课程看板」
cd "$(dirname "$0")" || exit 1

PORT=4173
# 端口被占用时依次往后找
while lsof -i :$PORT >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

echo "课程看板启动中… http://127.0.0.1:$PORT"
echo "（关闭此终端窗口即停止服务）"

sleep 0.8
open "http://127.0.0.1:$PORT" >/dev/null 2>&1

PORT=$PORT node server.js
