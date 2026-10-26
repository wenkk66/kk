import JSZip from 'jszip';
import { BotConfig } from '../types';
import { GGUF_MODELS } from '../data/modelsData';

export function getSelectedModel(modelId: string) {
  return GGUF_MODELS.find((m) => m.id === modelId) || GGUF_MODELS[0];
}

export function generateEnvExample(config: BotConfig): string {
  const model = getSelectedModel(config.selectedModelId);
  return `# ==============================================================================
# 三星 Galaxy Note 9 / Termux 极简 2 行配置
# 说明：本文件可以直接保存在 Termux 根目录 ~/.env (即本项目的上级目录 ../.env)
# 也可以保存在项目目录 ./.env 中，程序会自动智能识别！
# ==============================================================================

# 1. Telegram Bot Token (必填：Telegram 搜索 @BotFather 创建并获取)
BOT_TOKEN="${config.botToken || '1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ'}"

# 2. 管理员 Telegram 数字 ID (必填：向 @userinfobot 发送消息获取)
BOT_ID="${config.adminChatId || '987654321'}"

# ==============================================================================
# 以下为可选配置（系统已针对三星 Note 9 骁龙845/猎户座9810 进行全自动最佳调优）
# 如果没有特殊需求，完全无需填写以下任何内容，保持上方 2 行即可直接启动！
# ==============================================================================
MODEL_NAME="${model.filename}"  # 1.5B 占用 ~1.1GB RAM，Note 9 6GB 内存常驻零杀后台
LLAMA_THREADS="${config.threads}"                                # 绑定 Note 9 4 个高性能大核，速度快且发热低
ADMIN_ONLY="${config.adminOnly ? 'true' : 'false'}"                              # 开启安全鉴权，仅允许 BOT_ID 对话与执行 Shell 指令
TEMPERATURE="${config.temperature}"                              # 模型发散度 (0.1 ~ 1.0)
MAX_TOKENS="2048"                              # 最大生成长度
CHECK_INTERVAL_SECONDS="180"                   # 开奖结果轮询监听周期 (默认 3 分钟)
# HTTPS_PROXY="http://127.0.0.1:7890"            # 可选网络代理

# ==============================================================================
# Telegram Webhook 模式配置 (进阶可选)
# 默认留空使用 Long Polling 长轮询（手机 Termux 最推荐，无需公网IP、域名或证书）
# 若已有公网 HTTPS 域名或通过 Cloudflare Tunnel / ngrok 穿透，配置以下项目启动 Webhook：
# ==============================================================================
# WEBHOOK_URL="https://your-domain.com"          # 必填公网 HTTPS 基础域名
# WEBHOOK_PORT="8443"                            # 本地监听端口 (Telegram 限制: 443, 80, 88, 8443)
# WEBHOOK_SECRET_TOKEN="my_secret_token_123"     # 可选安全鉴权 Token
`;
}

export function generateRequirementsTxt(): string {
  return `# Termux Telegram Offline AI Bot Python Dependencies (Pure Python 3.10+)
python-telegram-bot[job-queue]>=20.8
httpx>=0.27.0
aiosqlite>=0.20.0
pyyaml>=6.0
python-dotenv>=1.0.0
requests>=2.31.0
`;
}

export function generateInstallScript(config: BotConfig): string {
  return `#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Termux 离线 AI + Telegram Bot 一键基础环境与依赖安装脚本 (纯 Python 架构)
# 适用系统: Android 8.0+ / Termux (aarch64 64位 ARM)
# ==============================================================================

set -e

GREEN='\\033[0;32m'
CYAN='\\033[0;36m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m'

echo -e "\${CYAN}====================================================================\${NC}"
echo -e "\${CYAN}      🤖 Termux 离线 AI Telegram Bot 基础环境安装向导 (纯 Python)   \${NC}"
echo -e "\${CYAN}====================================================================\${NC}"

# 1. 申请后台唤醒锁
echo -e "\\n\${YELLOW}>>> [1/6] 申请 Termux 后台常驻 CPU 唤醒锁...\${NC}"
if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock
    echo -e "\${GREEN}✓ 后台唤醒锁已成功激活 (防止息屏冻结进程)\${NC}"
else
    echo -e "\${RED}⚠️ 未检测到 termux-wake-lock，请确保使用官方 Termux 安装包\${NC}"
fi

# 2. 更新基础软件源
echo -e "\\n\${YELLOW}>>> [2/6] 更新 Termux 软件源与核心工具...\${NC}"
pkg update -y && pkg upgrade -y

# 3. 安装核心编译链、Python 与依赖
echo -e "\\n\${YELLOW}>>> [3/6] 安装 C/C++ 编译工具链与 Python 运行环境...\${NC}"
pkg install -y git clang cmake ninja make python python-pip libandroid-execinfo termux-api curl jq openssl-tool

# 4. 请求安卓存储读写权限
echo -e "\\n\${YELLOW}>>> [4/6] 检查手机文件读写权限...\${NC}"
if [ ! -d "$HOME/storage" ]; then
    echo -e "\${CYAN}如果手机弹出系统授权弹窗，请点击【允许】\${NC}"
    termux-setup-storage || true
fi

# 5. 安装 Python 核心依赖 (修复 Termux 禁止 pip upgrade 的报错)
echo -e "\\n\${YELLOW}>>> [5/6] 安装 Telegram Bot 与网络异步依赖...\${NC}"
PIP_FLAGS="--no-cache-dir"
if pip install --help 2>&1 | grep -q -- "--break-system-packages"; then
    PIP_FLAGS="$PIP_FLAGS --break-system-packages"
fi

echo -e "执行 pip 安装参数: \${CYAN}pip install \${PIP_FLAGS}\${NC}"
if [ -f "requirements.txt" ]; then
    pip install $PIP_FLAGS -r requirements.txt
else
    pip install $PIP_FLAGS "python-telegram-bot[job-queue]>=20.8" "httpx>=0.27.0" "aiosqlite>=0.20.0" "pyyaml>=6.0" "python-dotenv>=1.0.0" "requests>=2.31.0"
fi

# 6. 初始化项目目录
echo -e "\\n\${YELLOW}>>> [6/6] 初始化项目目录与日志结构...\${NC}"
mkdir -p models
mkdir -p logs
mkdir -p ~/.termux/boot

ENV_FOUND=0
for p in "../.env" "$HOME/.env" ".env"; do
    if [ -f "$p" ]; then
        echo -e "\${GREEN}✓ 检测到已存在配置文件: $p\${NC}"
        ENV_FOUND=1
        break
    fi
done

if [ "$ENV_FOUND" -eq 0 ]; then
    echo -e "\${YELLOW}ℹ️ 您可以在 Termux 根目录快速创建 ~/.env (仅需 2 行)：\${NC}"
    echo -e "   BOT_TOKEN=\\"你的Telegram机器人Token\\""
    echo -e "   BOT_ID=\\"你的Telegram数字ID\\""
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "\${GREEN}✓ 已在当前目录生成备用配置模板 .env\${NC}"
    fi
fi

echo -e "\\n\${CYAN}====================================================================\${NC}"
echo -e "\${GREEN}🎉 基础依赖已全部安装就绪！(纯 Python 异步架构)\${NC}"
echo -e "接下来请执行："
echo -e "  \${CYAN}1. bash setup_model.sh\${NC}  # 编译 llama.cpp 并下载离线模型 (推荐 [1] Qwen2.5 1.5B)"
echo -e "  \${CYAN}2. nano ~/.env\${NC}          # 在 Termux 根目录填入 BOT_TOKEN 与 BOT_ID"
echo -e "  \${CYAN}3. bash start.sh\${NC}        # 一键启动推理服务与机器人 (默认 Long Polling)"
echo -e "\${CYAN}====================================================================\${NC}"
`;
}

export function generateBuildAndDownloadScript(config: BotConfig): string {
  const model = getSelectedModel(config.selectedModelId);
  return `#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# llama.cpp 原生编译与端侧离线 GGUF 大模型选型下载器
# 针对 aarch64 (ARM 64位) 开启 NEON SIMD 硬件指令集加速
# ==============================================================================

set -e

GREEN='\\033[0;32m'
CYAN='\\033[0;36m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m'

PROJECT_DIR=$(pwd)
mkdir -p "$PROJECT_DIR/models"
mkdir -p "$PROJECT_DIR/logs"

echo -e "\${CYAN}====================================================================\${NC}"
echo -e "\${CYAN}        ⚡ llama.cpp 极速推理引擎编译与模型选型中心            \${NC}"
echo -e "\${CYAN}====================================================================\${NC}"

# 1. 编译 llama.cpp
if [ -f "$PROJECT_DIR/llama-server" ]; then
    echo -e "\${GREEN}✓ 已存在编译好的 llama-server 二进制文件，跳过编译步骤。\${NC}"
else
    echo -e "\${YELLOW}>>> [1/2] 拉取并编译 llama.cpp (ARM64 NEON 原生优化)...\${NC}"
    if [ ! -d "llama.cpp" ]; then
        git clone --depth 1 https://github.com/ggerganov/llama.cpp.git
    fi

    cd llama.cpp
    cmake -B build \\
      -DCMAKE_BUILD_TYPE=Release \\
      -DGGML_NATIVE=OFF \\
      -DGGML_CPU_AARCH64=ON \\
      -DGGML_OPENBLAS=OFF

    CPU_CORES=$(grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 4)
    BUILD_JOBS=$(( CPU_CORES > 4 ? 4 : CPU_CORES ))
    echo -e "正在使用 \${BUILD_JOBS} 个线程编译 llama-server，请耐心等待 1~3 分钟..."
    cmake --build build --config Release -j \${BUILD_JOBS} --target llama-server

    cp build/bin/llama-server "$PROJECT_DIR/"
    cd "$PROJECT_DIR"
    echo -e "\${GREEN}✓ llama-server 编译成功，已就绪！\${NC}"
fi

# 2. 模型选型菜单
echo -e "\\n\${YELLOW}>>> [2/2] 请选择你想要部署在手机上的离线大模型：\${NC}"
echo -e "  \${GREEN}[1] Qwen 2.5 1.5B Instruct (三星 Note 9 强烈推荐)\${NC} - 1.0GB，占用 ~1.1GB 内存，性能与发热最平衡"
echo -e "  \${CYAN}[2] DeepSeek-R1-Distill-Qwen 1.5B (推理强化)\${NC} - 1.0GB，强化推理思维链与逻辑运算"
echo -e "  \${CYAN}[3] Qwen 2.5 0.5B Instruct (极致超轻)\${NC} - 0.38GB，仅需 400MB 内存，毫秒级响应"
echo -e "  \${CYAN}[4] SmolLM2 1.7B Instruct (HF 开源精选)\${NC} - 1.06GB，多语言对话与指令响应流畅"
echo -e "  \${CYAN}[5] Qwen 2.5 3B Instruct (重度创作)\${NC} - 1.93GB，需要 2.2GB 连续空闲内存"

read -p "请输入序号 [默认回车为 1]: " CHOICE
CHOICE=\${CHOICE:-1}

case "$CHOICE" in
    2)
        MODEL_FILE="deepseek-r1-distill-qwen-1.5b-q4_k_m.gguf"
        DOWNLOAD_URL_MS="https://modelscope.cn/models/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/master/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf"
        DOWNLOAD_URL_HF="https://huggingface.co/unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/resolve/main/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf"
        ;;
    3)
        MODEL_FILE="qwen2.5-0.5b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_MS="https://modelscope.cn/models/qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/master/qwen2.5-0.5b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_HF="https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf"
        ;;
    4)
        MODEL_FILE="smollm2-1.7b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_MS="https://modelscope.cn/models/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/master/smollm2-1.7b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_HF="https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf"
        ;;
    5)
        MODEL_FILE="qwen2.5-3b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_MS="https://modelscope.cn/models/qwen/Qwen2.5-3B-Instruct-GGUF/resolve/master/qwen2.5-3b-instruct-q4_k_m.gguf"
        DOWNLOAD_URL_HF="https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf"
        ;;
    *)
        MODEL_FILE="${model.filename}"
        DOWNLOAD_URL_MS="${model.downloadUrlModelScope}"
        DOWNLOAD_URL_HF="${model.downloadUrlHuggingFace}"
        ;;
esac

DEST_PATH="$PROJECT_DIR/models/$MODEL_FILE"

if [ -f "$DEST_PATH" ]; then
    echo -e "\${GREEN}✓ 模型文件已存在: $DEST_PATH，跳过下载。\${NC}"
else
    echo -e "\${CYAN}正在拉取模型权重文件: $MODEL_FILE ...\${NC}"
    echo -e "优先尝试高速魔搭 (ModelScope) 节点，若中断再次运行可断点续传..."
    
    if curl -C - -L --fail -o "$DEST_PATH" "$DOWNLOAD_URL_MS"; then
        echo -e "\${GREEN}✓ 从加速镜像下载完成！\${NC}"
    else
        echo -e "\${YELLOW}魔搭镜像连接超时，正在切换至 HuggingFace 节点...\${NC}"
        curl -C - -L -o "$DEST_PATH" "$DOWNLOAD_URL_HF"
    fi
fi

TARGET_ENV=""
for p in "../.env" "$HOME/.env" ".env"; do
    if [ -f "$p" ]; then
        TARGET_ENV="$p"
        break
    fi
done

if [ -n "$TARGET_ENV" ]; then
    if grep -q "^MODEL_NAME=" "$TARGET_ENV" 2>/dev/null; then
        sed -i "s/^MODEL_NAME=.*/MODEL_NAME=\\"$MODEL_FILE\\"/" "$TARGET_ENV" 2>/dev/null || true
    fi
    echo -e "\${GREEN}✓ 已同步配置模型为 $MODEL_FILE (\${TARGET_ENV})\${NC}"
fi

echo -e "\\n\${CYAN}====================================================================\${NC}"
echo -e "\${GREEN}🎉 离线模型与推理引擎配置全部就绪！\${NC}"
echo -e "模型路径: \${CYAN}$DEST_PATH\${NC}"
echo -e "启动命令: \${CYAN}bash start.sh\${NC}"
echo -e "\${CYAN}====================================================================\${NC}"
`;
}

export function generateStartAllScript(config: BotConfig): string {
  const model = getSelectedModel(config.selectedModelId);
  return `#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# 一键联调启动脚本：后台拉起 llama-server 并运行 Telegram Bot
# ==============================================================================

set -e

GREEN='\\033[0;32m'
CYAN='\\033[0;36m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m'

PROJECT_DIR=$(pwd)
mkdir -p logs models

echo -e "\${CYAN}====================================================================\${NC}"
echo -e "\${CYAN}       🚀 正在启动 Termux 离线大模型与 Telegram Bot 服务        \${NC}"
echo -e "\${CYAN}====================================================================\${NC}"

# 1. 确保后台唤醒锁处于激活状态
if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock
    echo -e "\${GREEN}✓ 后台 CPU 唤醒锁已保持 (termux-wake-lock)\${NC}"
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
    echo -e "\${GREEN}✓ 成功加载配置文件: \${ENV_FILE}\${NC}"
    set -a
    source "$ENV_FILE"
    set +a
else
    echo -e "\${RED}❌ 未在 Termux 根目录 (~/.env 或 ../.env) 找到配置文件！\${NC}"
    echo -e "\${YELLOW}💡 极简部署提示：在 Termux 根目录仅需配置 2 行即可，执行：\${NC}"
    echo -e "  cat << 'EOF' > ~/.env"
    echo -e "  BOT_TOKEN=\\"你的Telegram机器人Token\\""
    echo -e "  BOT_ID=\\"你的Telegram数字ID\\""
    echo -e "  EOF"
    exit 1
fi

TG_TOKEN="\${BOT_TOKEN:-\$TELEGRAM_BOT_TOKEN}"
TG_TOKEN="\${TG_TOKEN:-\$TOKEN}"
MY_ID="\${BOT_ID:-\$ADMIN_CHAT_ID}"
MY_ID="\${MY_ID:-\$ADMIN_ID}"

if [ -z "$TG_TOKEN" ] || [ "$TG_TOKEN" = "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ" ]; then
    echo -e "\${RED}❌ 配置文件中未检测到有效 BOT_TOKEN！请检查 ~/.env 或 .env\${NC}"
    exit 1
fi

MODEL_FILE="\${MODEL_NAME:-${model.filename}}"
MODEL_PATH="$PROJECT_DIR/models/$MODEL_FILE"

if [ ! -f "$PROJECT_DIR/llama-server" ]; then
    echo -e "\${RED}❌ 未找到 llama-server 执行程序！请先运行: bash setup_model.sh 编译。\${NC}"
    exit 1
fi

if [ ! -f "$MODEL_PATH" ]; then
    echo -e "\${RED}❌ 未找到模型文件: $MODEL_PATH\${NC}"
    echo -e "\${YELLOW}请先运行 bash setup_model.sh 下载模型，或将 GGUF 文件放置到 models/ 目录。\${NC}"
    exit 1
fi

PORT=${config.port}
if pgrep -f "llama-server" > /dev/null; then
    echo -e "\${GREEN}✓ llama-server 已在后台运行中 (PID: $(pgrep -f llama-server | head -n 1))\${NC}"
else
    CORES=$(grep -c ^processor /proc/cpuinfo 2>/dev/null || echo 4)
    if [ "$CORES" -ge 8 ]; then
        DEFAULT_THREADS=4
    elif [ "$CORES" -ge 4 ]; then
        DEFAULT_THREADS=3
    else
        DEFAULT_THREADS=2
    fi
    THREADS="\${LLAMA_THREADS:-${config.threads}}"
    
    echo -e "\${YELLOW}>>> 启动 llama-server (端口: \${PORT}, 线程: \${THREADS}, 上下文: ${config.contextSize}, 模型: \${MODEL_FILE})...\${NC}"
    nohup "$PROJECT_DIR/llama-server" \\
        -m "$MODEL_PATH" \\
        --host 127.0.0.1 \\
        --port \${PORT} \\
        -c ${config.contextSize} \\
        -t \${THREADS} \\
        --temp ${config.temperature} \\
        > "$PROJECT_DIR/logs/llama_server.log" 2>&1 &
        
    echo -e "正在等待离线模型加载进手机内存..."
    for i in {1..40}; do
        if curl -s "http://127.0.0.1:\${PORT}/health" > /dev/null 2>&1; then
            echo -e "\${GREEN}✓ llama.cpp 离线推理引擎就绪！(耗时 ~\${i}s)\${NC}"
            break
        fi
        echo -n "."
        sleep 1
    done
    echo ""
fi

# 5. 启动持久规律挖掘与自动发帖引擎
if pgrep -f "persistent_engine.py" > /dev/null; then
    echo -e "\${GREEN}✓ persistent_engine (持久规律挖掘引擎) 已在运行中 (PID: $(pgrep -f persistent_engine.py | head -n 1))\${NC}"
else
    echo -e "\${YELLOW}>>> 启动 persistent_engine.py (持久规律计算与自适应发帖守护)...\${NC}"
    nohup python3 persistent_engine.py > "$PROJECT_DIR/logs/persistent_engine.log" 2>&1 &
    echo -e "\${GREEN}✓ persistent_engine 已在后台启动，将自动监听新开奖并核验发帖\${NC}"
fi

# 6. 启动 Telegram Bot
echo -e "\\n\${CYAN}====================================================================\${NC}"
echo -e "\${GREEN}🤖 启动 Telegram Bot 守护进程...\${NC}"
echo -e "日志将实时同步输出至终端与 logs/bot.log (按 Ctrl+C 可停止 Bot 前台进程)"
echo -e "\${CYAN}====================================================================\${NC}\\n"

python3 bot.py
`;
}

export function generateStatusScript(): string {
  return `#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# 查看当前 Termux 节点与离线模型运行状态 (专为三星 Note 9 优化)
# ==============================================================================

CYAN='\\033[0;36m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m'

echo -e "\${CYAN}====================================================================\${NC}"
echo -e "\${CYAN}        📱 三星 Galaxy Note 9 / Termux 离线节点监控状态              \${NC}"
echo -e "\${CYAN}====================================================================\${NC}"

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
    echo -e "• 配置文件位置:          \${GREEN}\${ENV_FILE}\${NC}"
    TG_TOKEN=$(grep -E '^(BOT_TOKEN|TELEGRAM_BOT_TOKEN)=' "$ENV_FILE" 2>/dev/null | head -n 1 | cut -d'=' -f2- | tr -d '"\\' ')
    MY_ID=$(grep -E '^(BOT_ID|ADMIN_CHAT_ID|ADMIN_ID)=' "$ENV_FILE" 2>/dev/null | head -n 1 | cut -d'=' -f2- | tr -d '"\\' ')
    if [ -n "$TG_TOKEN" ]; then
        MASKED_TOKEN="\${TG_TOKEN:0:6}***"
        echo -e "• Telegram Bot Token:     \${GREEN}\${MASKED_TOKEN}\${NC}"
    else
        echo -e "• Telegram Bot Token:     \${RED}未配置\${NC}"
    fi
    echo -e "• 管理员 Chat ID:         \${GREEN}\${MY_ID:-未配置}\${NC}"
else
    echo -e "• 配置文件位置:          \${RED}未找到 (~/.env 或 ../.env)\${NC}"
fi

echo -e "\\n\${CYAN}--- 核心进程状态 ---\${NC}"

echo -n "• llama-server (推理后端): "
LLAMA_PID=$(pgrep -f "llama-server" | head -n 1)
if [ -n "$LLAMA_PID" ]; then
    echo -e "\${GREEN}运行中 (PID: $LLAMA_PID)\${NC}"
else
    echo -e "\${RED}未运行\${NC}"
fi

echo -n "• bot.py (Telegram 机器人): "
BOT_PID=$(pgrep -f "bot.py" | head -n 1)
if [ -n "$BOT_PID" ]; then
    echo -e "\${GREEN}运行中 (PID: $BOT_PID)\${NC}"
else
    echo -e "\${RED}未运行\${NC}"
fi

echo -n "• persistent_engine (规律引擎): "
P_PID=$(pgrep -f "persistent_engine.py" | head -n 1)
if [ -n "$P_PID" ]; then
    echo -e "\${GREEN}运行中 (PID: $P_PID)\${NC}"
else
    echo -e "\${RED}未运行\${NC}"
fi

echo -n "• 本地 HTTP 8080 端口:     "
if curl -s http://127.0.0.1:8080/health >/dev/null 2>&1; then
    echo -e "\${GREEN}响应正常 (200 OK)\${NC}"
else
    echo -e "\${RED}无法连接\${NC}"
fi

if [ -f "patterns.db" ]; then
    RULES_COUNT=$(python3 -c "import sqlite3; c=sqlite3.connect('patterns.db'); print(c.execute('SELECT count(*) FROM pattern_rules WHERE is_active=1').fetchone()[0])" 2>/dev/null || echo "0")
    DRAWS_COUNT=$(python3 -c "import sqlite3; c=sqlite3.connect('patterns.db'); print(c.execute('SELECT count(*) FROM draw_records').fetchone()[0])" 2>/dev/null || echo "0")
    echo "• SQLite 规律数据库:      已归档 \${DRAWS_COUNT} 期历史开奖，已固化 \${RULES_COUNT} 组数学公式"
fi

echo -e "\\n\${CYAN}--- 三星 Note 9 物理内存状态 ---\${NC}"
if [ -f "/proc/meminfo" ]; then
    TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    AVAIL_MEM=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    TOTAL_MB=$((TOTAL_MEM / 1024))
    AVAIL_MB=$((AVAIL_MEM / 1024))
    USED_MB=$((TOTAL_MB - AVAIL_MB))
    PERCENT=$((USED_MB * 100 / TOTAL_MB))
    echo -e "• 内存分配: 已用 \${USED_MB} MB / 总共 \${TOTAL_MB} MB (\${PERCENT}%，可用空闲: \${AVAIL_MB} MB)"
fi

echo -e "\\n\${CYAN}--- 电池与温控状况 ---\${NC}"
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
            TEMP_C="\${TEMP_RAW}"
        fi
        echo "• 电量: \${CAP}% (\${STAT}) · 电池温度: \${TEMP_C}°C"
    else
        echo "• 电池监控: 运行正常 (未安装 termux-api)"
    fi
fi

echo -e "\${CYAN}====================================================================\${NC}"
`;
}

export function generateStopScript(): string {
  return `#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# 安全关闭 llama-server、bot.py 与 persistent_engine.py 进程
# ==============================================================================

GREEN='\\033[0;32m'
RED='\\033[0;31m'
NC='\\033[0m'

echo "正在停止 Telegram Bot 与 llama-server 进程..."

if pkill -f "python3 bot.py" 2>/dev/null || pkill -f "python bot.py" 2>/dev/null; then
    echo -e "\${GREEN}✓ Telegram Bot 进程已终止\${NC}"
else
    echo "• 未发现运行中的 bot.py"
fi

if pkill -f "persistent_engine.py" 2>/dev/null; then
    echo -e "\${GREEN}✓ persistent_engine (持久规律引擎) 进程已终止\${NC}"
else
    echo "• 未发现运行中的 persistent_engine.py"
fi

if pkill -f "llama-server" 2>/dev/null; then
    echo -e "\${GREEN}✓ llama-server 进程已终止 (释放手机显存/内存)\${NC}"
else
    echo "• 未发现运行中的 llama-server"
fi

echo "全部相关服务已完全关闭。"
`;
}

export function generateWebhookScript(): string {
  return `#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Telegram Bot Webhook 快速配置与内网穿透管理工具 (setup_webhook.sh)
# ==============================================================================

set -e
GREEN='\\033[0;32m'
CYAN='\\033[0;36m'
YELLOW='\\033[1;33m'
RED='\\033[0;31m'
NC='\\033[0m'

ENV_FILE=""
for p in "../.env" "$HOME/.env" ".env"; do
  if [ -f "$p" ]; then
    ENV_FILE="$p"
    set -a
    source "$p"
    set +a
    break
  fi
done

TG_TOKEN="\${BOT_TOKEN:-\$TELEGRAM_BOT_TOKEN}"
TG_TOKEN="\${TG_TOKEN:-\$TOKEN}"

echo -e "\${CYAN}====================================================================\${NC}"
echo -e "\${CYAN}     🌐 Telegram Bot Webhook 模式配置向导 (手机 Termux 专版)        \${NC}"
echo -e "\${CYAN}====================================================================\${NC}"

if [ -z "$TG_TOKEN" ] || [ "$TG_TOKEN" = "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ" ]; then
  echo -e "\${RED}❌ 未检测到有效的 BOT_TOKEN，请先在 ~/.env 中配置 Token！\${NC}"
  exit 1
fi

echo -e "当前机器人: \${GREEN}\${TG_TOKEN:0:6}***\${NC} | 配置文件: \${GREEN}\${ENV_FILE:-未加载}\${NC}\\n"
echo -e "请选择操作："
echo -e "  \${GREEN}[1] 查询当前 Telegram 官方记录的 Webhook 状态\${NC}"
echo -e "  \${CYAN}[2] 清除 Webhook，恢复为手机推荐的 Long Polling 长轮询\${NC}"
echo -e "  \${CYAN}[3] 一键启动 Cloudflare Tunnel (免费免域名内网穿透 8443 端口)\${NC}"
echo -e "  \${CYAN}[4] 配置自定义公网域名 Webhook (需已有公网IP或反代)\${NC}"
echo -e "  \${CYAN}[5] 退出\${NC}"

read -p "请输入选项 [1-5]: " CHOICE

case "$CHOICE" in
  1)
    echo -e "\\n\${YELLOW}>>> 正在向 Telegram API 请求 Webhook 信息...\${NC}"
    curl -s "https://api.telegram.org/bot\${TG_TOKEN}/getWebhookInfo"
    echo ""
    ;;
  2)
    echo -e "\\n\${YELLOW}>>> 正在清除 Telegram 服务器上的 Webhook 记录...\${NC}"
    curl -s "https://api.telegram.org/bot\${TG_TOKEN}/deleteWebhook?drop_pending_updates=true"
    if [ -n "$ENV_FILE" ]; then
      sed -i 's/^WEBHOOK_URL=/#WEBHOOK_URL=/g' "$ENV_FILE" 2>/dev/null || true
    fi
    echo -e "\\n\${GREEN}🎉 已成功恢复为 Long Polling 长轮询模式！执行 bash start.sh 即可启动。\${NC}"
    ;;
  3)
    echo -e "\\n\${YELLOW}>>> 检查并启动 Cloudflare Tunnel 穿透服务 (端口: 8443)...\${NC}"
    if ! command -v cloudflared >/dev/null 2>&1; then
      pkg install -y cloudflared || {
        curl -L -o "$PREFIX/bin/cloudflared" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
        chmod +x "$PREFIX/bin/cloudflared"
      }
    fi
    echo -e "\${GREEN}✓ 正在启动 Cloudflare 穿透隧道并生成临时公网 HTTPS 地址...\${NC}"
    cloudflared tunnel --url http://127.0.0.1:8443
    ;;
  4)
    read -p "请输入您的公网 HTTPS 基础域名 (例如: https://bot.example.com): " CUSTOM_DOMAIN
    CUSTOM_DOMAIN=$(echo "$CUSTOM_DOMAIN" | tr -d ' ')
    TARGET_ENV="\${ENV_FILE:-\$HOME/.env}"
    if grep -q "WEBHOOK_URL=" "$TARGET_ENV" 2>/dev/null; then
      sed -i "s|^#*WEBHOOK_URL=.*|WEBHOOK_URL=\\"$CUSTOM_DOMAIN\\"|g" "$TARGET_ENV"
    else
      echo "WEBHOOK_URL=\\"$CUSTOM_DOMAIN\\"" >> "$TARGET_ENV"
      echo "WEBHOOK_PORT=\\"8443\\"" >> "$TARGET_ENV"
    fi
    echo -e "\${GREEN}✓ 已成功写入配置文件: \${TARGET_ENV}\${NC}"
    ;;
  5)
    exit 0
    ;;
esac
`;
}

export function generateCronJobsScript(): string {
  return `#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Termux 定时内容生成与 Telegram 自动广播脚本 (纯 Python 驱动)
# ==============================================================================

set -e
PROJECT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
mkdir -p logs

for p in "../.env" "$HOME/.env" "/data/data/com.termux/files/home/.env" ".env"; do
    if [ -f "$p" ]; then
        set -a
        source "$p"
        set +a
        break
    fi
done

TASK_TITLE="\${1:-今日科技精选简报}"
TASK_PROMPT="\${2:-请撰写一份排版优雅的 Telegram 简讯，包含核心进展与实用洞察。}"

python3 - <<EOF
import os
import asyncio
import httpx
from bot import call_offline_llm
from lottery import fetch_lottery_history, compute_statistics, build_prediction_prompt

BOT_TOKEN = os.getenv("BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN") or os.getenv("TOKEN")
CHAT_ID = os.getenv("BOT_ID") or os.getenv("ADMIN_CHAT_ID") or os.getenv("ADMIN_ID") or os.getenv("USER_ID")
PROXY = os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY") or None
TITLE = """$TASK_TITLE"""
PROMPT = """$TASK_PROMPT"""

async def run_cron_push():
    if not BOT_TOKEN or not CHAT_ID:
        print("错误: 缺少 BOT_TOKEN 或 BOT_ID (ADMIN_CHAT_ID)")
        return

    print(f"正在由本地离线大模型生成【{TITLE}】...")

    if "彩票" in TITLE or "六合彩" in TITLE or "lottery" in TITLE.lower():
        try:
            from pattern_engine import generate_persistent_prediction
            pred = generate_persistent_prediction(200, 18)
            content = pred["full_report"]
        except Exception as e:
            content = f"计算 200 期 18 码预测失败: {e}"
    else:
        content = await call_offline_llm(f"请针对主题进行创作：{TITLE}\\n要求：{PROMPT}")

    message_text = f"📢 *【自动定时推送 · {TITLE}】*\\n\\n{content}"

    async with httpx.AsyncClient(timeout=40.0, proxy=PROXY) as client:
        for i in range(0, len(message_text), 3800):
            chunk = message_text[i:i + 3800]
            try:
                resp = await client.post(
                    f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                    json={"chat_id": CHAT_ID, "text": chunk, "parse_mode": "Markdown"}
                )
                if resp.status_code != 200:
                    await client.post(
                        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                        json={"chat_id": CHAT_ID, "text": chunk}
                    )
            except Exception as e:
                print(f"推送消息失败: {e}")

    print("推送完成！")

asyncio.run(run_cron_push())
EOF
`;
}

export function generateTermuxBootScript(config: BotConfig): string {
  return `#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Termux 开机自启脚本 (放置于 ~/.termux/boot/start_offline_ai.sh)
# 作用: 配合 Termux:Boot 应用，实现安卓手机开机/重启自动静默唤醒并启动 AI Bot
# ==============================================================================

if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock
fi

sleep 15 # 等待 WiFi 或移动蜂窝网络就绪

PROJECT_DIR=""
if [ -f "start.sh" ]; then
    PROJECT_DIR="$(pwd)"
else
    DETECTED=$(find "$HOME" -maxdepth 2 -name "start.sh" 2>/dev/null | head -n 1)
    if [ -n "$DETECTED" ]; then
        PROJECT_DIR="$(dirname "$DETECTED")"
    else
        PROJECT_DIR="$HOME/telegram-offline-ai"
    fi
fi

if [ -d "$PROJECT_DIR" ]; then
    cd "$PROJECT_DIR"
    mkdir -p logs
    nohup bash start.sh >> logs/boot_autorun.log 2>&1 &
fi
`;
}

export function generateCrontabConfig(config: BotConfig): string {
  return `# ==============================================================================
# Termux 定时任务配置示例 (执行: crontab -e 粘贴)
# 启动 cron 守护进程: crond (首次配置后执行一次 crond 即可)
# ==============================================================================

# 1. 每天早上 08:30 自动由离线模型生成早报并推送到您的 Telegram
30 8 * * * cd $HOME/termux-telegram-ai-bot && bash cron_jobs.sh "每日科技早报" "总结最新端侧AI与开源硬件动态，包含3个核心要点" >> logs/cron.log 2>&1

# 2. 每晚 20:30 (开奖前) 自动拉取澳门六合彩历史记录并由 AI 离线生成 200 期 18 码预测走势
30 20 * * * cd $HOME/termux-telegram-ai-bot && bash cron_jobs.sh "澳门六合彩走势预测" >> logs/cron.log 2>&1

# 3. 每天晚上 21:30 自动生成今日工作复盘与明日待办清单
30 21 * * * cd $HOME/termux-telegram-ai-bot && bash cron_jobs.sh "晚间复盘与明日待办" "提炼今日重点，提醒待办事项" >> logs/cron.log 2>&1

# 4. 每隔 4 小时执行一次看门狗巡检，若 llama-server 或 bot 意外掉线则自动拉起
0 */4 * * * pgrep -f llama-server >/dev/null || (cd $HOME/termux-telegram-ai-bot && nohup bash start.sh >> logs/watchdog.log 2>&1 &)
`;
}

export function generateReadme(config: BotConfig): string {
  const model = getSelectedModel(config.selectedModelId);
  return `# Termux 离线 AI 与 Telegram Bot 智能运维项目包 (纯 Python 架构)

## 架构概览
- **操作系统**: Android + Termux (aarch64)
- **推理后端**: llama.cpp server (C++ 原生编译，ARM NEON 加速)
- **离线模型**: ${model.name} (${model.quantization}, 约 ${model.sizeGb} GB)
- **主程序语言**: 纯 Python 3.10+ 异步处理中枢 (零 Go 依赖)
- **连接模式**: Long Polling (长轮询，默认免公网IP) / Webhook (公网域名或 Cloudflare Tunnel 穿透)
- **核心模块**:
  1. \`bot.py\` : Telegram 交互主服务，集成快捷键盘菜单与 Inline 交互按钮
  2. \`agent_executor.py\` : 自然语言意图识别中枢，大白话调度系统工具
  3. \`pattern_engine.py\` : SQLite 持久化数学规律挖掘器与 200 期 18 码预测推导引擎
  4. \`persistent_engine.py\` : 增量开奖自动监听、历史核验与自动发帖守护进程
  5. \`lottery.py\` : 澳门六合彩官方接口数据抓取与数理统计分析库

## 快速部署 3 步走

### 步骤 1: 准备 Termux 环境
在安卓手机上打开 Termux，运行：
\`\`\`bash
bash install.sh
\`\`\`

### 步骤 2: 编译推理引擎与拉取离线大模型
\`\`\`bash
bash setup_model.sh
\`\`\`

### 步骤 3: 启动全部服务
\`\`\`bash
bash start.sh
\`\`\`

随后在 Telegram 找到您的机器人，发送 \`/start\` 即可开始离线交互与内容生成！
若需配置 Webhook 启动，运行 \`bash setup_webhook.sh\`。
`;
}

export function generateBotPy(config: BotConfig): string {
  const model = getSelectedModel(config.selectedModelId);
  const botToken = config.botToken.trim() || 'YOUR_TELEGRAM_BOT_TOKEN_HERE';
  const adminId = config.adminChatId.trim() || '0';

  return `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Termux 离线大模型 Telegram Bot 智能运维与自动化中枢
- 架构: 基于 python-telegram-bot v20+ 异步处理 (纯 Python，无任何 Go 依赖)
- 后端: llama.cpp server (http://127.0.0.1:${config.port}/v1)
- 特性: 
  1. 离线长文生成 (/write) 与要点摘要提炼 (/summarize)
  2. 本地 SQLite 待办持久化 (/task) 与开奖规律公式挖掘 (/predict, /patterns, /mine, /verify)
  3. 安卓 Termux 电池温度与硬件状态实时遥测 (/status)
  4. 交互式 Shell 终端命令远程执行 (/cmd, /shell)
  5. 实时运行日志检视 (/logs)
  6. 纯自然语言意图无指令识别 (大白话无缝调度工具)
"""

import os
import sys
import re
import json
import logging
import sqlite3
import subprocess
import asyncio
from datetime import datetime
from typing import Optional
import httpx
from telegram import (
    Update,
    ReplyKeyboardMarkup,
    KeyboardButton,
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    BotCommand,
)
from telegram.constants import ParseMode, ChatAction
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
)

from lottery import (
    fetch_lottery_history,
    compute_statistics,
    format_draw_summary,
    build_prediction_prompt,
    WAVE_CN,
)
from pattern_engine import (
    sync_draw_history,
    mine_all_patterns,
    generate_persistent_prediction,
    verify_past_predictions,
    get_db_connection,
)
from agent_executor import (
    dispatch_natural_language_intent,
    execute_shell_command,
    get_system_telemetry,
    view_stored_pattern_rules,
    run_pattern_mining,
    view_recent_draw_history,
    list_user_tasks,
    run_lottery_prediction_flow,
)

# ----------------- 配置读取 -----------------
BOT_TOKEN = os.getenv("BOT_TOKEN", "${botToken}")
ADMIN_CHAT_ID = int(os.getenv("ADMIN_CHAT_ID", "${adminId}")) if os.getenv("ADMIN_CHAT_ID", "${adminId}").isdigit() else 0
ADMIN_ONLY = ${config.adminOnly ? 'True' : 'False'}
LLAMA_API_BASE = "http://127.0.0.1:${config.port}/v1"
MODEL_NAME = "${model.filename}"
SYSTEM_PROMPT = """${config.systemPrompt}"""
DB_FILE = os.path.expanduser("tasks.db")

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO
)
logger = logging.getLogger("TermuxOfflineBot")

def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id INTEGER,
            content TEXT,
            priority TEXT DEFAULT '中',
            created_at TEXT,
            status TEXT DEFAULT 'pending'
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def check_auth(update: Update) -> bool:
    if not ADMIN_ONLY:
        return True
    if not ADMIN_CHAT_ID or ADMIN_CHAT_ID == 0:
        return True
    if update.effective_chat and update.effective_chat.id == ADMIN_CHAT_ID:
        return True
    return False

async def call_offline_llm(user_input: str, system_override: Optional[str] = None) -> str:
    sys_content = system_override or SYSTEM_PROMPT
    messages = [
        {"role": "system", "content": sys_content},
        {"role": "user", "content": user_input}
    ]
    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "temperature": ${config.temperature},
        "max_tokens": 2048,
        "stream": False
    }
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(f"{LLAMA_API_BASE}/chat/completions", json=payload)
            if resp.status_code == 200:
                data = resp.json()
                return data["choices"][0]["message"]["content"].strip()
            return f"⚠️ 本地模型接口返回异常: {resp.status_code}"
    except httpx.ConnectError:
        return "❌ 无法连接到本地 llama.cpp 推理接口！请先启动 bash start.sh。"
    except Exception as e:
        return f"❌ 离线推理过程发生异常: {str(e)}"

def get_main_reply_keyboard():
    keyboard = [
        [KeyboardButton("🎰 预测200期18码"), KeyboardButton("📐 查看算法公式")],
        [KeyboardButton("🔄 重新挖掘规律"), KeyboardButton("📊 历史开奖走势")],
        [KeyboardButton("📱 手机状态监控"), KeyboardButton("📝 我的待办事项")],
        [KeyboardButton("🤖 离线模型规格"), KeyboardButton("❓ 帮助与指令")],
    ]
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)

def get_prediction_inline_keyboard(sample_size: int = 200, num_codes: int = 18):
    keyboard = [
        [
            InlineKeyboardButton("🎯 预测200期18码", callback_data="cb:predict:200:18"),
            InlineKeyboardButton("🎲 预测100期12码", callback_data="cb:predict:100:12"),
        ],
        [
            InlineKeyboardButton("📐 算法公式库", callback_data="cb:patterns"),
            InlineKeyboardButton("🔄 重新拟合挖掘", callback_data="cb:mine"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)

async def send_long_message(update: Update, text: str, reply_markup=None):
    if not text:
        return
    markup = reply_markup or get_main_reply_keyboard()
    chunk_size = 3800
    for i in range(0, len(text), chunk_size):
        chunk = text[i:i + chunk_size]
        try:
            await update.message.reply_text(chunk, parse_mode=ParseMode.MARKDOWN, reply_markup=markup)
        except Exception:
            await update.message.reply_text(chunk, reply_markup=markup)

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        await update.message.reply_text("⛔ 访问受限：此 Bot 已开启管理员私有保护模式。")
        return
    welcome_text = (
        "🤖 *Termux 离线大模型智能管家已上线*\\n\\n"
        f"• *宿主硬件*: Android 手机本地 (Termux aarch64)\\n"
        f"• *当前模型*: \`{MODEL_NAME}\`\\n"
        f"• *推理接口*: \`{LLAMA_API_BASE}\`\\n\\n"
        "✨ *常用核心指令*:\\n"
        "• \`/predict\` : 走势规律挖掘与 18 码预测\\n"
        "• \`/patterns\` : 查看 SQLite 持久化数学模型库\\n"
        "• \`/mine\` : 重新拟合数学公式参数\\n"
        "• \`/lottery_chart\` : 查看最近多期开奖走势图\\n"
        "• \`/status\` : 实时查看手机电量与硬件温度\\n"
        "• \`/task\` : 本地 SQLite 待办日程管理\\n"
        "• \`/cmd <命令>\` : 远程安全执行 Shell 命令\\n"
        "• \`/write <主题>\` : 离线长文创作与行业报告"
    )
    await update.message.reply_text(welcome_text, parse_mode=ParseMode.MARKDOWN, reply_markup=get_main_reply_keyboard())

async def lottery_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    status_msg = await update.message.reply_text("🔄 正在执行 200 期开奖规律挖掘与 18 码大底预测...")
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, sync_draw_history, "2026")
    pred = await loop.run_in_executor(None, generate_persistent_prediction, 200, 18)
    try:
        await status_msg.delete()
    except Exception:
        pass
    await send_long_message(update, pred['full_report'], reply_markup=get_prediction_inline_keyboard(200, 18))

async def patterns_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    text = view_stored_pattern_rules()
    await send_long_message(update, text)

async def mine_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    res = run_pattern_mining()
    await send_long_message(update, res)

async def write_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    topic = " ".join(context.args).strip()
    if not topic:
        await update.message.reply_text("💡 使用方式: \`/write <创作主题或关键词>\`", parse_mode=ParseMode.MARKDOWN)
        return
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    generated = await call_offline_llm(f"请针对主题进行创作：{topic}", "你是一位专业内容创作者。请结构化、排版优美地撰写。")
    await send_long_message(update, generated)

async def summarize_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    text = " ".join(context.args).strip()
    if not text:
        await update.message.reply_text("💡 使用方式: \`/summarize <长文本内容>\`", parse_mode=ParseMode.MARKDOWN)
        return
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    summary = await call_offline_llm(f"请对以下内容进行要点提炼：\\n{text}", "提炼核心要点、关键行动项与风险提示。")
    await send_long_message(update, summary)

async def task_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    chat_id = update.effective_chat.id
    args = context.args
    if not args or args[0] == "list":
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("SELECT id, content, created_at FROM tasks WHERE chat_id=? AND status='pending' ORDER BY id ASC", (chat_id,))
        rows = c.fetchall()
        conn.close()
        if not rows:
            await update.message.reply_text("🎉 目前没有待处理事项！发送 \`/task add <内容>\` 快速记录。")
            return
        reply = "📋 *本地待办事项清单 (SQLite)*:\\n\\n" + "\\n".join(f"• \`#{r[0]}\` {r[1]} _({r[2]})_" for r in rows)
        await update.message.reply_text(reply, parse_mode=ParseMode.MARKDOWN)
    elif args[0] == "add":
        content = " ".join(args[1:]).strip()
        now = datetime.now().strftime("%m-%d %H:%M")
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("INSERT INTO tasks (chat_id, content, created_at) VALUES (?, ?, ?)", (chat_id, content, now))
        conn.commit()
        tid = c.lastrowid
        conn.close()
        await update.message.reply_text(f"✅ 已记录待办 \`#{tid}\`: {content}", parse_mode=ParseMode.MARKDOWN)
    elif args[0] == "done" and len(args) > 1 and args[1].isdigit():
        tid = int(args[1])
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("UPDATE tasks SET status='done' WHERE id=? AND chat_id=?", (tid, chat_id))
        conn.commit()
        conn.close()
        await update.message.reply_text(f"🎉 事项 \`#{tid}\` 已标记为完成！")

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    telemetry = get_system_telemetry()
    await send_long_message(update, telemetry)

async def model_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    info = (
        "🤖 *当前离线大模型技术规格*\\n\\n"
        f"• *模型文件*: \`{MODEL_NAME}\`\\n"
        f"• *推理地址*: \`{LLAMA_API_BASE}\`\\n"
        f"• *采样温度*: \`${config.temperature}\`\\n"
        f"• *最大输出*: \`2048 tokens\`\\n"
        "• *引擎架构*: llama.cpp server (ARM64 NEON 原生 SIMD 加速)"
    )
    await update.message.reply_text(info, parse_mode=ParseMode.MARKDOWN)

async def shell_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    cmd = " ".join(context.args).strip()
    if not cmd:
        await update.message.reply_text("💡 用法: \`/cmd <命令>\`，例如: \`/cmd free -m\`")
        return
    res = execute_shell_command(cmd)
    await send_long_message(update, res)

async def logs_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    log_file = "logs/bot.log"
    if os.path.exists(log_file):
        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()[-25:]
        await send_long_message(update, f"📜 *【最近 25 行日志】*:\\n\\n\`\`\`text\\n{''.join(lines)}\\n\`\`\`")
    else:
        await update.message.reply_text("ℹ️ 日志文件尚未生成。")

async def webhook_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    try:
        info = await context.bot.get_webhook_info()
        text = f"🌐 *【Telegram Bot 连接状态】*:\\n• 模式: {'Webhook 回调' if info.url else 'Long Polling (长轮询)'}\\n• URL: \`{info.url or '无 (长轮询)'}\`\\n• 挂起更新: \`{info.pending_update_count}\`"
        await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)
    except Exception as e:
        await update.message.reply_text(f"❌ 获取 Webhook 信息失败: {e}")

async def ai_calc_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    await lottery_command(update, context)

async def formula_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    await patterns_command(update, context)

async def backtest_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    from pattern_engine import run_comprehensive_backtest
    loop = asyncio.get_running_loop()
    bt = await loop.run_in_executor(None, run_comprehensive_backtest, 50, 18)
    text = (
        f"📈 *【澳门六合彩 18 码模型历史回测报告】*\\n\\n"
        f"• 回测样本: **{bt['test_draws_count']} 期**\\n"
        f"• 单期平均命中正码: **{bt['avg_regular_hits_per_draw']} / 6 个**\\n"
        f"• 3 码及以上胜率: **{bt['pool_coverage_rate_ge3']}%**\\n"
        f"• 特码单挑胜率: **{bt['special_code_hit_rate']}%**"
    )
    await send_long_message(update, text, reply_markup=get_prediction_inline_keyboard(200, 18))

async def verify_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT target_draw, actual_open_code, matched_regular, matched_special FROM prediction_logs WHERE verified = 1 ORDER BY target_draw DESC LIMIT 5")
    rows = c.fetchall()
    conn.close()
    if not rows:
        await update.message.reply_text("ℹ️ 暂无历史核验数据。开奖后守护进程会自动回测！")
        return
    text = "🎯 *【历史预测核验台账】*:\\n\\n" + "\\n".join(f"• 第 {r['target_draw']} 期: 开奖 \`{r['actual_open_code']}\` | 命中平码: {r['matched_regular']} 个 | 特码: {'✅ 中特' if r['matched_special'] else '未中'}" for r in rows)
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)

async def lottery_chart_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    from agent_executor import view_recent_draw_history
    text = view_recent_draw_history(7)
    await send_long_message(update, text)

async def pure_math_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    text = (
        "📐 *【纯确定性高维数学与蒙特卡洛矩阵模式】*\\n\\n"
        "💡 *为何拒绝弱智 AI 幻觉？*\\n"
        "端侧小型大语言模型（如 1.5B/3B）本质是词元概率关联器，无法执行精确的高维浮点矩阵运算，容易出现数理幻觉与模糊套话。\\n\\n"
        "✨ *本系统的纯数学解决方案*:\\n"
        "1. **公式自主编写**：在网页控制台「数学规律公式库」随时定义与推导 LaTeX 规律公式；\\n"
        "2. **100% 确定性求解**：发送 \`/calc\` 彻底绕过大语言模型，直接调动 C++/Python 原生向量矩阵，执行 10,000 轮蒙特卡洛能量松弛，产出 18 码大底与 6+1 组合；\\n"
        "3. **24/7 后台持久自运行**：运行 \`python3 persistent_engine.py --daemon\`，每晚 21:30 自动抓取、自动核验、贝叶斯自进化调权并静默推送到本聊天！\\n\\n"
        "👉 发送 \`/calc\` 即可立刻获取纯确定性数学推导结果！"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)

async def daemon_status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    pid = "未检测到常驻进程"
    try:
        out = subprocess.check_output(["pgrep", "-f", "persistent_engine.py"]).decode().strip()
        if out:
            pid = f"PID {out}"
    except Exception:
        pass
    text = (
        f"🛡️ *【24/7 后台持久自运行守护进程】*\\n\\n"
        f"• 进程状态: **{pid}**\\n"
        f"• 监听模式: 自动嗅探官方开奖更新 (间隔 180s)\\n"
        f"• 核心流水线: 自动抓取 ➔ 历史回测核验 ➔ 贝叶斯自进化调权 ➔ 10,000步蒙特卡洛矩阵 ➔ Telegram 极速推送\\n"
        f"• 启动命令: \`python3 persistent_engine.py --daemon &\`\\n\\n"
        f"💡 发送 \`/calc\` 立即手动触发一次完整计算！"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)

async def callback_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    await query.answer()
    data = query.data or ""
    if not check_auth(update):
        await query.message.reply_text("⛔ 访问受限")
        return
    if data.startswith("cb:predict"):
        await lottery_command(update, context)
    elif data == "cb:patterns":
        await patterns_command(update, context)
    elif data == "cb:mine":
        await mine_command(update, context)

async def chat_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return
    text = update.message.text
    if not text:
        return
    loop = asyncio.get_running_loop()
    action_result, _ = await loop.run_in_executor(None, dispatch_natural_language_intent, text, update.effective_chat.id)
    if action_result:
        await send_long_message(update, action_result)
        return
    reply = await call_offline_llm(text)
    await send_long_message(update, reply)

def main():
    print("🚀 启动 Termux Telegram 机器人 (纯 Python 架构)...")
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", start_command))
    app.add_handler(CommandHandler("write", write_command))
    app.add_handler(CommandHandler("summarize", summarize_command))
    app.add_handler(CommandHandler("task", task_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("model", model_command))
    app.add_handler(CommandHandler("cmd", shell_command))
    app.add_handler(CommandHandler("shell", shell_command))
    app.add_handler(CommandHandler("logs", logs_command))
    app.add_handler(CommandHandler("webhook", webhook_command))
    app.add_handler(CommandHandler("predict", lottery_command))
    app.add_handler(CommandHandler("lottery", lottery_command))
    app.add_handler(CommandHandler("ai_calc", ai_calc_command))
    app.add_handler(CommandHandler("calc", ai_calc_command))
    app.add_handler(CommandHandler("pure_math", pure_math_command))
    app.add_handler(CommandHandler("daemon", daemon_status_command))
    app.add_handler(CommandHandler("daemon_status", daemon_status_command))
    app.add_handler(CommandHandler("formula", formula_command))
    app.add_handler(CommandHandler("backtest", backtest_command))
    app.add_handler(CommandHandler("patterns", patterns_command))
    app.add_handler(CommandHandler("mine", mine_command))
    app.add_handler(CommandHandler("verify", verify_command))
    app.add_handler(CommandHandler("lottery_chart", lottery_chart_command))
    app.add_handler(CallbackQueryHandler(callback_query_handler))
    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), chat_handler))
    print("✅ Bot 进入长轮询监听状态...")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
`;
}

export async function createProjectZip(config: BotConfig): Promise<Blob> {
  const zip = new JSZip();

  // 1. 尝试从后端拉取完整代码文件
  try {
    const res = await fetch('/api/project-files');
    if (res.ok) {
      const files: Record<string, string> = await res.json();
      for (const [fname, fcontent] of Object.entries(files)) {
        zip.file(fname, fcontent);
      }
    }
  } catch (err) {
    console.warn('Could not fetch server project files, falling back to local generators:', err);
  }

  // 2. 覆盖写入带有当前用户特定配置的脚本文件
  const envContent = generateEnvExample(config);
  zip.file('.env.example', envContent);
  zip.file('.env', envContent); // 直接生成开箱即用的 .env
  zip.file('install.sh', generateInstallScript(config));
  zip.file('setup_model.sh', generateBuildAndDownloadScript(config));
  zip.file('start.sh', generateStartAllScript(config));
  zip.file('stop.sh', generateStopScript());
  zip.file('status.sh', generateStatusScript());
  zip.file('setup_webhook.sh', generateWebhookScript());
  zip.file('cron_jobs.sh', generateCronJobsScript());
  if (!zip.file('bot.py')) {
    zip.file('bot.py', generateBotPy(config));
  }
  zip.file('termux_boot.sh', generateTermuxBootScript(config));
  zip.file('crontab.example', generateCrontabConfig(config));
  zip.file('requirements.txt', generateRequirementsTxt());
  zip.file('config.json', JSON.stringify(config, null, 2));

  return await zip.generateAsync({ type: 'blob' });
}
