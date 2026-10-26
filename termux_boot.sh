#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Termux 开机自启脚本 (适用于三星 Note 9)
# 安装方式:
#   mkdir -p ~/.termux/boot
#   cp termux_boot.sh ~/.termux/boot/start_offline_ai.sh
#   chmod +x ~/.termux/boot/start_offline_ai.sh
# 前提条件: 手机端安装 Termux:Boot 并设置允许自启
# ==============================================================================

# 1. 申请 CPU 唤醒锁，防止息屏后 CPU 休眠
if command -v termux-wake-lock >/dev/null 2>&1; then
    termux-wake-lock
fi

# 2. 等待安卓系统网络 (WiFi 或移动网络) 就绪
sleep 15

# 3. 自动探测项目目录
PROJECT_DIR=""
if [ -f "start.sh" ]; then
    PROJECT_DIR="$(pwd)"
else
    # 在家目录下自动查找包含 start.sh 与 bot.py 的项目根目录
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
