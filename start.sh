#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# 一键联调启动脚本：后台拉起 llama-server 并运行 Telegram Bot
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_DIR=$(pwd)
mkdir -p logs models

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}       🚀 正在启动 Termux 离线大模型与 Telegram Bot 服务        ${NC}"
echo -e "${CYAN}====================================================================${NC}"

# 1. 确保后台唤醒锁处于激活状态
if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock
    echo -e "${GREEN}✓ 后台 CPU 唤醒锁已保持 (termux-wake-lock)${NC}"
fi

# 2. 智能在多个候选路径查找并加载 .env 配置文件
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
    echo -e "${GREEN}✓ 成功加载配置文件: ${ENV_FILE}${NC}"
    set -a
    source "$ENV_FILE"
    set +a
else
    echo -e "${RED}❌ 未在 Termux 根目录 (~/.env 或 ../.env) 找到配置文件！${NC}"
    echo -e "${YELLOW}💡 极简部署提示：在 Termux 根目录仅需配置 2 行即可，执行：${NC}"
    echo -e "  cat << 'EOF' > ~/.env"
    echo -e "  BOT_TOKEN=\"你的Telegram机器人Token\""
    echo -e "  BOT_ID=\"你的Telegram数字ID\""
    echo -e "  EOF"
    exit 1
fi

# 兼容别名
TG_TOKEN="${BOT_TOKEN:-$TELEGRAM_BOT_TOKEN}"
TG_TOKEN="${TG_TOKEN:-$TOKEN}"
MY_ID="${BOT_ID:-$ADMIN_CHAT_ID}"
MY_ID="${MY_ID:-$ADMIN_ID}"

if [ -z "$TG_TOKEN" ] || [ "$TG_TOKEN" = "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ" ]; then
    echo -e "${RED}❌ 配置文件中未检测到有效 BOT_TOKEN！请检查 ~/.env 或 .env${NC}"
    exit 1
fi

if [ -n "$MODEL_NAME" ] && [ -f "$PROJECT_DIR/models/$MODEL_NAME" ]; then
    MODEL_FILE="$MODEL_NAME"
else
    # 智能扫描 models/ 目录下的 .gguf 模型文件
    FOUND_GGUF=$(find "$PROJECT_DIR/models" -maxdepth 1 -name "*.gguf" 2>/dev/null | head -n 1)
    if [ -n "$FOUND_GGUF" ]; then
        MODEL_FILE=$(basename "$FOUND_GGUF")
        echo -e "${GREEN}✓ 智能检测到本地模型: $MODEL_FILE${NC}"
    else
        MODEL_FILE="deepseek-r1-distill-qwen-7b-q4_k_m.gguf"
    fi
fi
MODEL_PATH="$PROJECT_DIR/models/$MODEL_FILE"

# 3. 校验必要文件
if [ ! -f "$PROJECT_DIR/llama-server" ]; then
    echo -e "${RED}❌ 未找到 llama-server 执行程序！请先运行: bash setup_model.sh 编译。${NC}"
    exit 1
fi

if [ ! -f "$MODEL_PATH" ]; then
    echo -e "${RED}❌ 未找到模型文件: $MODEL_PATH${NC}"
    echo -e "${YELLOW}请先运行 bash setup_model.sh 下载模型，或将 GGUF 文件放置到 models/ 目录。${NC}"
    exit 1
fi

# 4. 检测并启动 llama-server 后台服务
PORT=8080
if pgrep -f "llama-server" > /dev/null; then
    echo -e "${GREEN}✓ llama-server 已在后台运行中 (PID: $(pgrep -f llama-server | head -n 1))${NC}"
else
    # 小米 11 Pro 硬件调优 (高通骁龙 888 / 8 核心)：
    # 结合 Cortex-X1 超大核与 A78 大核，默认配置 6 线程，兼顾吞吐量与温控
    CORES=$(grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 8)
    if [ "$CORES" -ge 8 ]; then
        DEFAULT_THREADS=6
    elif [ "$CORES" -ge 4 ]; then
        DEFAULT_THREADS=4
    else
        DEFAULT_THREADS=2
    fi
    THREADS="${LLAMA_THREADS:-$DEFAULT_THREADS}"
    
    echo -e "${YELLOW}>>> 启动 llama-server (端口: ${PORT}, 推理线程: ${THREADS}, 模型: ${MODEL_FILE})...${NC}"
    nohup "$PROJECT_DIR/llama-server" \
        -m "$MODEL_PATH" \
        --host 127.0.0.1 \
        --port ${PORT} \
        -c 4096 \
        -t ${THREADS} \
        --temp 0.7 \
        > "$PROJECT_DIR/logs/llama_server.log" 2>&1 &
        
    echo -e "正在等待离线模型加载进手机内存..."
    for i in {1..40}; do
        if curl -s "http://127.0.0.1:${PORT}/health" > /dev/null 2>&1; then
            echo -e "${GREEN}✓ llama.cpp 离线推理引擎就绪！(耗时 ~${i}s)${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
    echo ""
fi

# 5. 启动持久规律挖掘与自动发帖引擎
if pgrep -f "persistent_engine.py" > /dev/null; then
    echo -e "${GREEN}✓ persistent_engine (持久规律挖掘引擎) 已在运行中 (PID: $(pgrep -f persistent_engine.py | head -n 1))${NC}"
else
    echo -e "${YELLOW}>>> 启动 persistent_engine.py (持久规律计算与自适应发帖守护)...${NC}"
    nohup python3 persistent_engine.py > "$PROJECT_DIR/logs/persistent_engine.log" 2>&1 &
    echo -e "${GREEN}✓ persistent_engine 已在后台启动，将自动监听新开奖并核验发帖${NC}"
fi

# 6. 启动 Telegram Bot (启动前先终止旧实例，彻底杜绝 409 Conflict)
echo -e "\n${CYAN}====================================================================${NC}"
echo -e "${GREEN}🤖 清理旧实例并启动 Telegram Bot 守护进程...${NC}"
echo -e "日志将实时同步输出至终端与 logs/bot.log (按 Ctrl+C 可停止 Bot 前台进程)"
echo -e "${CYAN}====================================================================${NC}\n"

pkill -f "python3 bot.py" 2>/dev/null || true
pkill -f "bot.py" 2>/dev/null || true
sleep 1

python3 bot.py

