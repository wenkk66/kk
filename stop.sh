#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# 安全关闭 llama-server 与 bot.py 进程
# ==============================================================================

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "正在停止 Telegram Bot 与 llama-server 进程..."

if pkill -f "python3 bot.py" 2>/dev/null || pkill -f "python bot.py" 2>/dev/null; then
    echo -e "${GREEN}✓ Telegram Bot 进程已终止${NC}"
else
    echo "• 未发现运行中的 bot.py"
fi

if pkill -f "persistent_engine.py" 2>/dev/null; then
    echo -e "${GREEN}✓ persistent_engine (持久规律引擎) 进程已终止${NC}"
else
    echo "• 未发现运行中的 persistent_engine.py"
fi

if pkill -f "llama-server" 2>/dev/null; then
    echo -e "${GREEN}✓ llama-server 进程已终止 (释放手机显存/内存)${NC}"
else
    echo "• 未发现运行中的 llama-server"
fi

echo "全部相关服务已完全关闭。"
