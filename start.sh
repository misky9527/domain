#!/bin/bash
# DomainKeeper v2 - 一键启动脚本（screen 持久化）
# Usage: bash start.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo "  DomainKeeper v2 - 启动中..."
echo "========================================"

# Kill existing processes on ports
for port in 3001 5173; do
  lsof -ti:$port 2>/dev/null | xargs -r kill -9 2>/dev/null || true
done

sleep 1

# Start backend
echo "[1/2] 启动后端服务 (port 3001)..."
screen -dmS dk2server bash -c "cd $SCRIPT_DIR/server && node dist/index.js"
sleep 2
echo "  后端 PID: $(lsof -ti:3001 2>/dev/null)"

# Start frontend
echo "[2/2] 启动前端服务 (port 5173)..."
screen -dmS dk2front bash -c "cd $SCRIPT_DIR/client && npx vite --host 0.0.0.0"
sleep 2
echo "  前端 PID: $(lsof -ti:5173 2>/dev/null)"

echo ""
echo "========================================"
echo "  ✅ 启动完成"
echo "  后端: http://localhost:3001"
echo "  前端: http://43.165.183.130:5173"
echo "  screen -ls 查看进程"
echo "========================================"
