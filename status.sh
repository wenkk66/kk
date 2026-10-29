#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# 查看当前 Termux 节点与离线模型运行状态 (专为小米 11 Pro 优化)
# ==============================================================================

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}        📱 小米 11 Pro / Termux 离线节点监控状态              ${NC}"
echo -e "${CYAN}====================================================================${NC}"

# 0. 查找并显示配置文件路径
ENV_FILE=""
if [ -f "../.env" ]; then
    ENV_FILE="../.env"
elif [ -f "$HOME/.env" ]; then
    ENV_FILE="$HOME/.env"
elif [ -f "/data/data/com.termux/files/home/.env" ]; then
    ENV_FILE="/data/data/com.termux/files/home/.env"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
fi

if [ -n "$ENV_FILE" ]; then
    echo -e "• 配置文件位置:          ${GREEN}${ENV_FILE}${NC}"
    # 读取 TOKEN 与 ID
    TG_TOKEN=$(grep -E '^(BOT_TOKEN|TELEGRAM_BOT_TOKEN)=' "$ENV_FILE" 2>/dev/null | head -n 1 | cut -d'=' -f2- | tr -d '"'\'' ')
    MY_ID=$(grep -E '^(BOT_ID|ADMIN_CHAT_ID|ADMIN_ID)=' "$ENV_FILE" 2>/dev/null | head -n 1 | cut -d'=' -f2- | tr -d '"'\'' ')
    if [ -n "$TG_TOKEN" ]; then
        MASKED_TOKEN="${TG_TOKEN:0:6}***"
        echo -e "• Telegram Bot Token:     ${GREEN}${MASKED_TOKEN}${NC}"
    else
        echo -e "• Telegram Bot Token:     ${RED}未配置${NC}"
    fi
    echo -e "• 管理员 Chat ID:         ${GREEN}${MY_ID:-未配置}${NC}"
else
    echo -e "• 配置文件位置:          ${RED}未找到 (~/.env 或 ../.env)${NC}"
fi

echo -e "\n${CYAN}--- 核心进程状态 ---${NC}"

# 1. 检查 llama-server
echo -n "• llama-server (推理后端): "
LLAMA_PID=$(pgrep -f "llama-server" | head -n 1)
if [ -n "$LLAMA_PID" ]; then
    echo -e "${GREEN}运行中 (PID: $LLAMA_PID)${NC}"
else
    echo -e "${RED}未运行${NC}"
fi

# 2. 检查 bot.py
echo -n "• bot.py (Telegram 机器人): "
BOT_PID=$(pgrep -f "bot.py" | head -n 1)
if [ -n "$BOT_PID" ]; then
    echo -e "${GREEN}运行中 (PID: $BOT_PID)${NC}"
else
    echo -e "${RED}未运行${NC}"
fi

# 3. 检查 persistent_engine.py
echo -n "• persistent_engine (规律引擎): "
P_PID=$(pgrep -f "persistent_engine.py" | head -n 1)
if [ -n "$P_PID" ]; then
    echo -e "${GREEN}运行中 (PID: $P_PID)${NC}"
else
    echo -e "${RED}未运行${NC}"
fi

# 4. 检查端口
echo -n "• 本地 HTTP 8080 端口:     "
if curl -s http://127.0.0.1:8080/health >/dev/null 2>&1; then
    echo -e "${GREEN}响应正常 (200 OK)${NC}"
else
    echo -e "${RED}无法连接${NC}"
fi

# 5. 检查 SQLite patterns.db 持久化规则库
if [ -f "patterns.db" ]; then
    RULES_COUNT=$(python3 -c "import sqlite3; c=sqlite3.connect('patterns.db'); print(c.execute('SELECT count(*) FROM pattern_rules WHERE is_active=1').fetchone()[0])" 2>/dev/null || echo "0")
    DRAWS_COUNT=$(python3 -c "import sqlite3; c=sqlite3.connect('patterns.db'); print(c.execute('SELECT count(*) FROM draw_records').fetchone()[0])" 2>/dev/null || echo "0")
    echo "• SQLite 规律数据库:      已归档 ${DRAWS_COUNT} 期历史开奖，已固化 ${RULES_COUNT} 组数学公式"
fi

# 6. 内存状况 (针对小米 11 Pro 8GB/12GB 物理内存)
echo -e "\n${CYAN}--- 小米 11 Pro 物理内存状态 ---${NC}"
if [ -f "/proc/meminfo" ]; then
    TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    AVAIL_MEM=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    TOTAL_MB=$((TOTAL_MEM / 1024))
    AVAIL_MB=$((AVAIL_MEM / 1024))
    USED_MB=$((TOTAL_MB - AVAIL_MB))
    PERCENT=$((USED_MB * 100 / TOTAL_MB))
    echo -e "• 内存分配: 已用 ${USED_MB} MB / 总共 ${TOTAL_MB} MB (${PERCENT}%，可用空闲: ${AVAIL_MB} MB)"
    if [ "$AVAIL_MB" -gt 3000 ]; then
        echo -e "• 内存裕量: ${GREEN}非常充裕 (>3GB)，可流畅稳定运行 DeepSeek-R1 7B 模型${NC}"
    elif [ "$AVAIL_MB" -gt 1500 ]; then
        echo -e "• 内存裕量: ${GREEN}正常 (可稳定运行 3B/1.5B 模型)${NC}"
    else
        echo -e "• 内存裕量: ${YELLOW}紧张，建议关闭其他大型后台应用${NC}"
    fi
fi

# 7. 电池与温度 (支持 Termux:API 与原生 Linux 节点)
echo -e "\n${CYAN}--- 电池与温控状况 ---${NC}"
BATT_SHOWN=0
if command -v termux-battery-status >/dev/null 2>&1; then
    B_JSON=$(termux-battery-status 2>/dev/null || true)
    if [ -n "$B_JSON" ]; then
        echo "$B_JSON" | grep -E '"percentage"|"temperature"|"status"' || true
        BATT_SHOWN=1
    fi
fi

if [ "$BATT_SHOWN" -eq 0 ]; then
    if [ -f "/sys/class/power_supply/battery/capacity" ]; then
        CAP=$(cat /sys/class/power_supply/battery/capacity 2>/dev/null)
        STAT=$(cat /sys/class/power_supply/battery/status 2>/dev/null)
        TEMP_RAW=$(cat /sys/class/power_supply/battery/temp 2>/dev/null)
        if [ -n "$TEMP_RAW" ] && [ "$TEMP_RAW" -gt 100 ]; then
            TEMP_C=$(awk "BEGIN {print $TEMP_RAW / 10.0}")
        else
            TEMP_C="${TEMP_RAW}"
        fi
        echo "• 电量: ${CAP}% (${STAT}) · 电池温度: ${TEMP_C}°C"
    else
        echo "• 电池监控: 运行正常 (未安装 termux-api)"
    fi
fi

echo -e "${CYAN}====================================================================${NC}"
