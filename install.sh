#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Termux 离线 AI + Telegram Bot 一键基础环境与依赖安装脚本 (纯 Python 架构)
# 适用系统: Android 8.0+ / Termux (aarch64 64位 ARM)
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}      🤖 Termux 离线 AI Telegram Bot 基础环境安装向导 (纯 Python)   ${NC}"
echo -e "${CYAN}====================================================================${NC}"

# 1. 申请后台唤醒锁
echo -e "\n${YELLOW}>>> [1/6] 申请 Termux 后台常驻 CPU 唤醒锁...${NC}"
if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock
    echo -e "${GREEN}✓ 后台唤醒锁已成功激活 (防止息屏冻结进程)${NC}"
else
    echo -e "${RED}⚠️ 未检测到 termux-wake-lock，请确保使用官方 Termux 安装包${NC}"
fi

# 2. 更新基础软件源
echo -e "\n${YELLOW}>>> [2/6] 更新 Termux 软件源与核心工具...${NC}"
pkg update -y && pkg upgrade -y

# 3. 安装核心编译链、Python 与依赖 (包含 python-pip，避免 Termux pip 冲突)
echo -e "\n${YELLOW}>>> [3/6] 安装 C/C++ 编译工具链与 Python 运行环境...${NC}"
pkg install -y git clang cmake ninja make python python-pip libandroid-execinfo termux-api curl jq openssl-tool

# 4. 请求安卓存储读写权限
echo -e "\n${YELLOW}>>> [4/6] 检查手机文件读写权限...${NC}"
if [ ! -d "$HOME/storage" ]; then
    echo -e "${CYAN}如果手机弹出系统授权弹窗，请点击【允许】${NC}"
    termux-setup-storage || true
fi

# 5. 安装 Python 核心依赖 (修复 Termux 禁止 pip upgrade 的报错)
echo -e "\n${YELLOW}>>> [5/6] 安装 Telegram Bot 与网络异步依赖...${NC}"
# 注意: Termux 官方严格禁止 pip install --upgrade pip，由 pkg 统一维护
PIP_FLAGS="--no-cache-dir"
if pip install --help 2>&1 | grep -q -- "--break-system-packages"; then
    PIP_FLAGS="$PIP_FLAGS --break-system-packages"
fi

echo -e "执行 pip 安装参数: ${CYAN}pip install ${PIP_FLAGS}${NC}"
if [ -f "requirements.txt" ]; then
    pip install $PIP_FLAGS -r requirements.txt
else
    pip install $PIP_FLAGS "python-telegram-bot[job-queue]>=20.8" "httpx>=0.27.0" "aiosqlite>=0.20.0" "pyyaml>=6.0" "python-dotenv>=1.0.0" "requests>=2.31.0"
fi

# 6. 初始化项目目录
echo -e "\n${YELLOW}>>> [6/6] 初始化项目目录与日志结构...${NC}"
mkdir -p models
mkdir -p logs
mkdir -p ~/.termux/boot

# 检查 .env 配置文件是否存在
ENV_FOUND=0
for p in "../.env" "$HOME/.env" ".env"; do
    if [ -f "$p" ]; then
        echo -e "${GREEN}✓ 检测到已存在配置文件: $p${NC}"
        ENV_FOUND=1
        break
    fi
done

if [ "$ENV_FOUND" -eq 0 ]; then
    echo -e "${YELLOW}ℹ️ 您可以在 Termux 根目录快速创建 ~/.env (仅需 2 行)：${NC}"
    echo -e "   BOT_TOKEN=\"你的Telegram机器人Token\""
    echo -e "   BOT_ID=\"你的Telegram数字ID\""
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ 已在当前目录生成备用配置模板 .env${NC}"
    fi
fi

echo -e "\n${CYAN}====================================================================${NC}"
echo -e "${GREEN}🎉 基础依赖已全部安装就绪！(纯 Python 异步架构)${NC}"
echo -e "接下来请执行："
echo -e "  ${CYAN}1. bash setup_model.sh${NC}  # 编译 llama.cpp 并下载离线模型 (推荐 [1] Qwen2.5 1.5B)"
echo -e "  ${CYAN}2. nano ~/.env${NC}          # 在 Termux 根目录填入 BOT_TOKEN 与 BOT_ID"
echo -e "  ${CYAN}3. bash start.sh${NC}        # 一键启动推理服务与机器人 (默认 Long Polling)"
echo -e "  ${CYAN}💡 Webhook 模式配置请参考 README.md 或执行 bash setup_webhook.sh${NC}"
echo -e "${CYAN}====================================================================${NC}"
