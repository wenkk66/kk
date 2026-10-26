#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Termux 定时内容生成与 Telegram 自动广播脚本 (纯 Python 驱动)
# 用法:
#   bash cron_jobs.sh "每日科技早报" "以专业科技主编口吻生成今日行业精选动态"
# ==============================================================================

set -e
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
mkdir -p logs

# 智能在多个候选路径查找并加载 .env 配置文件
for p in "../.env" "$HOME/.env" "/data/data/com.termux/files/home/.env" ".env"; do
    if [ -f "$p" ]; then
        set -a
        source "$p"
        set +a
        break
    fi
done

TASK_TITLE="${1:-今日科技精选简报}"
TASK_PROMPT="${2:-请撰写一份排版优雅的 Telegram 简讯，包含核心进展与实用洞察。}"

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

    if "彩票" in TITLE or "六合彩" in TITLE or "lottery" in TITLE.lower() or "18" in TITLE:
        draws = fetch_lottery_history("2026")
        if not draws:
            draws = fetch_lottery_history("2025")
        if draws:
            try:
                from pattern_engine import generate_persistent_prediction, sync_draw_history
                sync_draw_history("2026")
                pred = generate_persistent_prediction(200, 18)
                content = pred["full_report"]
            except Exception as e:
                stats = compute_statistics(draws, 30)
                llm_prompt = build_prediction_prompt(stats)
                content = await call_offline_llm(llm_prompt)
        else:
            content = "拉取彩票数据失败，请检查网络连接。"
    else:
        content = await call_offline_llm(f"请针对主题进行创作：{TITLE}\n要求：{PROMPT}")

    message_text = f"📢 *【自动定时推送 · {TITLE}】*\n\n{content}"

    # 调用 Telegram API 推送
    async with httpx.AsyncClient(timeout=40.0, proxy=PROXY) as client:
        # 分段发送，防止超过 4096 字符
        for i in range(0, len(message_text), 3800):
            chunk = message_text[i:i + 3800]
            try:
                resp = await client.post(
                    f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                    json={"chat_id": CHAT_ID, "text": chunk, "parse_mode": "Markdown"}
                )
                if resp.status_code != 200:
                    # 降级纯文本
                    await client.post(
                        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
                        json={"chat_id": CHAT_ID, "text": chunk}
                    )
            except Exception as e:
                print(f"推送消息失败: {e}")

    print("推送完成！")

asyncio.run(run_cron_push())
EOF
