#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Telegram Bot Webhook 快速配置与内网穿透管理工具
# 支持 Cloudflare Tunnel / ngrok / 自定义公网域名
# ==============================================================================

set -e

GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 查找并加载 .env
ENV_FILE=""
for p in "../.env" "$HOME/.env" "/data/data/com.termux/files/home/.env" ".env"; do
    if [ -f "$p" ]; then
        ENV_FILE="$p"
        set -a
        source "$p"
        set +a
        break
    fi
done

TG_TOKEN="${BOT_TOKEN:-$TELEGRAM_BOT_TOKEN}"
TG_TOKEN="${TG_TOKEN:-$TOKEN}"

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}     🌐 Telegram Bot Webhook 模式配置向导 (手机 Termux 专版)        ${NC}"
echo -e "${CYAN}====================================================================${NC}"

if [ -z "$TG_TOKEN" ] || [ "$TG_TOKEN" = "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ" ]; then
    echo -e "${RED}❌ 未检测到有效的 BOT_TOKEN，请先在 ~/.env 中配置 Telegram 机器人 Token！${NC}"
    exit 1
fi

echo -e "当前机器人: ${GREEN}${TG_TOKEN:0:6}***${NC} | 配置文件: ${GREEN}${ENV_FILE:-未加载}${NC}\n"
echo -e "请选择操作："
echo -e "  ${GREEN}[1] 查询当前 Telegram 官方记录的 Webhook 状态${NC}"
echo -e "  ${CYAN}[2] 清除 Webhook，恢复为手机推荐的 Long Polling 长轮询${NC}"
echo -e "  ${CYAN}[3] 一键启动 Cloudflare Tunnel (免费免域名内网穿透 8443 端口)${NC}"
echo -e "  ${CYAN}[4] 配置自定义公网域名 Webhook (需已有公网IP或反向代理)${NC}"
echo -e "  ${CYAN}[5] 退出${NC}"

read -p "请输入选项 [1-5]: " CHOICE

case "$CHOICE" in
    1)
        echo -e "\n${YELLOW}>>> 正在向 Telegram API 请求 Webhook 信息...${NC}"
        curl -s "https://api.telegram.org/bot${TG_TOKEN}/getWebhookInfo" | jq . || curl -s "https://api.telegram.org/bot${TG_TOKEN}/getWebhookInfo"
        echo ""
        ;;
    2)
        echo -e "\n${YELLOW}>>> 正在清除 Telegram 服务器上的 Webhook 记录并清空挂起消息...${NC}"
        RESULT=$(curl -s "https://api.telegram.org/bot${TG_TOKEN}/deleteWebhook?drop_pending_updates=true")
        echo -e "${GREEN}✓ Telegram API 响应: ${RESULT}${NC}"
        if [ -n "$ENV_FILE" ]; then
            # 注释或清空 .env 中的 WEBHOOK_URL
            sed -i 's/^WEBHOOK_URL=/#WEBHOOK_URL=/g' "$ENV_FILE" 2>/dev/null || true
            echo -e "${GREEN}✓ 已从配置文件中停用 WEBHOOK_URL${NC}"
        fi
        echo -e "${GREEN}🎉 已成功恢复为 Long Polling 长轮询模式！执行 bash start.sh 即可启动。${NC}"
        ;;
    3)
        echo -e "\n${YELLOW}>>> 检查并启动 Cloudflare Tunnel 穿透服务 (端口: 8443)...${NC}"
        if ! command -v cloudflared >/dev/null 2>&1; then
            echo -e "正在安装 cloudflared 工具..."
            pkg install -y cloudflared || {
                echo -e "${YELLOW}如 pkg 无法安装，正在从 GitHub 官方源获取 aarch64 静态二进制...${NC}"
                curl -L -o "$PREFIX/bin/cloudflared" https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
                chmod +x "$PREFIX/bin/cloudflared"
            }
        fi

        echo -e "${GREEN}✓ 正在启动临时 Cloudflare 穿透隧道并生成临时公网 HTTPS 地址...${NC}"
        echo -e "${YELLOW}请复制输出中的 https://xxxx.trycloudflare.com 地址，填入 ~/.env 的 WEBHOOK_URL 中！${NC}"
        echo -e "按 Ctrl+C 可停止穿透。"
        cloudflared tunnel --url http://127.0.0.1:8443
        ;;
    4)
        read -p "请输入您的公网 HTTPS 基础域名 (例如: https://bot.example.com): " CUSTOM_DOMAIN
        CUSTOM_DOMAIN=$(echo "$CUSTOM_DOMAIN" | tr -d ' ')
        if [[ ! "$CUSTOM_DOMAIN" =~ ^https:// ]]; then
            echo -e "${RED}❌ Telegram 规定 Webhook 必须以 https:// 开头并具备有效 SSL 证书！${NC}"
            exit 1
        fi

        TARGET_ENV="${ENV_FILE:-$HOME/.env}"
        # 写入或更新配置
        if grep -q "WEBHOOK_URL=" "$TARGET_ENV" 2>/dev/null; then
            sed -i "s|^#*WEBHOOK_URL=.*|WEBHOOK_URL=\"$CUSTOM_DOMAIN\"|g" "$TARGET_ENV"
        else
            echo "WEBHOOK_URL=\"$CUSTOM_DOMAIN\"" >> "$TARGET_ENV"
            echo "WEBHOOK_PORT=\"8443\"" >> "$TARGET_ENV"
        fi

        echo -e "${GREEN}✓ 已成功写入配置文件: ${TARGET_ENV}${NC}"
        echo -e "目标 Webhook: ${CYAN}${CUSTOM_DOMAIN}${NC}"
        echo -e "请确保您的 Nginx / Caddy 反向代理将请求转发到 Termux 本地 8443 端口。"
        echo -e "现在您可以运行: ${GREEN}bash start.sh${NC} 启动 Webhook 模式！"
        ;;
    5)
        echo "已退出。"
        exit 0
        ;;
    *)
        echo "无效选项。"
        exit 1
        ;;
esac
