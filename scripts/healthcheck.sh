#!/bin/bash
# DomainManage 健康检查脚本
# 每5分钟执行一次，检测服务是否正常，异常时发送 Telegram 通知

# === 配置（从 .env.secret 读取） ===
CONFIG_DIR="/home/ubuntu/domain"
TOKEN_FILE="$CONFIG_DIR/.env.secret"
API_URL="http://localhost/api"
ADMIN_USER="admin"
ADMIN_PASS="admin123456"

# Telegram 通知（从数据库读取配置）
send_alert() {
  local msg="$1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERT: $msg"
  
  # 尝试发送 Telegram 通知
  if [ -f "$TOKEN_FILE" ]; then
    BOT_TOKEN=$(grep TELEGRAM_BOT "$TOKEN_FILE" 2>/dev/null | cut -d= -f2)
    CHAT_ID=$(grep TELEGRAM_CHAT "$TOKEN_FILE" 2>/dev/null | cut -d= -f2)
    if [ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ]; then
      curl -s -o /dev/null "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
        -d "chat_id=${CHAT_ID}&text=${msg}&parse_mode=HTML" 2>/dev/null
    fi
  fi
}

# === 检查项 ===

# 1. 容器是否都在运行
CONTAINERS=$(cd $CONFIG_DIR && docker compose ps --format '{{.Name}} {{.Status}}' 2>/dev/null)
DOWN_CONTAINERS=$(echo "$CONTAINERS" | grep -v "Up" || true)
if [ -n "$DOWN_CONTAINERS" ]; then
  send_alert "❌ DomainManage 容器异常：$DOWN_CONTAINERS"
  exit 1
fi

# 2. API 是否正常
LOGIN_RESP=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" 2>/dev/null)

if echo "$LOGIN_RESP" | grep -q "token"; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ 服务正常"
else
  ERROR_MSG=$(echo "$LOGIN_RESP" | grep -oP '"error":"[^"]*"' | head -1 | cut -d'"' -f4)
  send_alert "⚠️ DomainManage API异常: ${ERROR_MSG:-登录失败}"
  exit 1
fi

# 3. 数据库文件大小检查
DB_FILE="$CONFIG_DIR/server/data/domain-keeper.db"
if [ -f "$DB_FILE" ]; then
  DB_SIZE=$(stat -c%s "$DB_FILE" 2>/dev/null || stat -f%z "$DB_FILE" 2>/dev/null)
  if [ "$DB_SIZE" -gt 10485760 ]; then
    send_alert "📊 DomainManage 数据库已达 ${DB_SIZE} 字节，建议检查空间"
  fi
fi

exit 0
