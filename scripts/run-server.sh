#!/bin/bash
# 由 launchd 调用：确保用哪个 node 都能把看板服务拉起来
cd "$(dirname "$0")/.." || exit 1

if ! command -v node >/dev/null 2>&1; then
  # 找不到 node 时，退回 WorkBuddy 自带的最新版
  NODE_BIN=$(ls -1 "$HOME/.workbuddy/binaries/node/versions"/*/bin/node 2>/dev/null | sort -V | tail -1)
  if [ -n "$NODE_BIN" ]; then
    PATH="$(dirname "$NODE_BIN"):$PATH"
    export PATH
  fi
fi

exec node server.js
