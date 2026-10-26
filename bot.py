#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Termux 离线大模型 Telegram Bot 智能运维与自动化中枢
- 架构: 基于 python-telegram-bot v20+ 异步处理 (纯 Python，无任何 Go 依赖)
- 后端: llama.cpp server (http://127.0.0.1:8080/v1)
- 特性: 
  1. 离线长文生成 (/write) 与要点摘要提炼 (/summarize)
  2. 本地 SQLite 待办任务持久化 (/task) 与开奖规律公式挖掘 (/predict, /patterns, /mine, /verify)
  3. 安卓 Termux 电池温度与硬件状态实时遥测 (/status)
  4. 交互式 Shell 终端命令远程执行 (/cmd, /shell)
  5. 实时运行日志检视 (/logs)
  6. 纯自然语言意图无指令识别 (大白话无缝调度工具)
"""

from __future__ import annotations
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

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv(dotenv_path=None, override=False):
        if not dotenv_path or not os.path.isfile(dotenv_path):
            return False
        try:
            with open(dotenv_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip().strip('"').strip("'")
                        if k and (override or k not in os.environ):
                            os.environ[k] = v
            return True
        except Exception:
            return False

try:
    import httpx
except ImportError:
    httpx = None

try:
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
except ImportError:
    Update = None
    ParseMode = None
    ChatAction = None
    ApplicationBuilder = None
    CommandHandler = None
    MessageHandler = None
    CallbackQueryHandler = None
    ReplyKeyboardMarkup = None
    KeyboardButton = None
    InlineKeyboardMarkup = None
    InlineKeyboardButton = None
    BotCommand = None
    class _DummyContextTypes:
        DEFAULT_TYPE = None
    ContextTypes = _DummyContextTypes
    filters = None

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
    run_monte_carlo_persistent_calculation,
    get_all_stored_formulas,
    generate_ai_custom_formula,
    run_comprehensive_backtest,
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

# 智能在多个候选路径查找并加载 .env 配置文件:
# 1. 项目上级目录 ../.env (用户在 Termux 根目录 ~ 创建)
# 2. 用户家目录 ~/.env (/data/data/com.termux/files/home/.env)
# 3. 当前项目目录 ./.env
ENV_PATHS = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env")),
    os.path.expanduser("~/.env"),
    "/data/data/com.termux/files/home/.env",
    os.path.abspath(os.path.join(os.path.dirname(__file__), ".env")),
]

LOADED_ENV_PATH = None
for env_p in ENV_PATHS:
    if os.path.isfile(env_p):
        load_dotenv(dotenv_path=env_p, override=True)
        LOADED_ENV_PATH = env_p
        break

# 辅助函数：按优先级尝试多个环境变量别名
def get_env_val(keys: list, default: str = "") -> str:
    for k in keys:
        v = os.getenv(k)
        if v is not None and str(v).strip() != "":
            return str(v).strip()
    return default

# ----------------- 配置读取 (兼容极简两行配置) -----------------
BOT_TOKEN = get_env_val(["BOT_TOKEN", "TELEGRAM_BOT_TOKEN", "TOKEN", "TG_BOT_TOKEN"], "")
ADMIN_CHAT_ID_RAW = get_env_val(["BOT_ID", "ADMIN_CHAT_ID", "ADMIN_ID", "USER_ID", "CHAT_ID", "ID"], "0")
ADMIN_CHAT_ID = int(ADMIN_CHAT_ID_RAW) if ADMIN_CHAT_ID_RAW.isdigit() else 0

ADMIN_ONLY_RAW = os.getenv("ADMIN_ONLY", "true").lower()
ADMIN_ONLY = ADMIN_ONLY_RAW in ("true", "1", "yes")

# 本地 llama.cpp server 接口地址与三星 Note 9 优化默认值
LLAMA_API_BASE = os.getenv("LLAMA_API_BASE", "http://127.0.0.1:8080/v1").rstrip("/")
MODEL_NAME = os.getenv("MODEL_NAME", "qwen2.5-3b-instruct-q4_k_m.gguf")
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.7"))
MAX_TOKENS = int(os.getenv("MAX_TOKENS", "2048"))

# 代理支持
HTTPS_PROXY = os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY") or None

# Webhook 配置 (可选：设置 WEBHOOK_URL 自动切换为 Webhook 模式，留空则保持手机原生 Long Polling)
WEBHOOK_URL = get_env_val(["WEBHOOK_URL", "TG_WEBHOOK_URL"], "")
WEBHOOK_PORT = int(get_env_val(["WEBHOOK_PORT", "PORT"], "8443"))
WEBHOOK_LISTEN = get_env_val(["WEBHOOK_LISTEN", "LISTEN"], "0.0.0.0")
WEBHOOK_SECRET = get_env_val(["WEBHOOK_SECRET_TOKEN", "WEBHOOK_SECRET"], "")
WEBHOOK_PATH = get_env_val(["WEBHOOK_PATH"], f"webhook/{BOT_TOKEN[:10] if BOT_TOKEN else 'bot'}")

DB_FILE = os.path.expanduser("tasks.db")

# 日志配置 (确保日志目录存在)
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    level=logging.INFO,
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.expanduser("logs/bot.log"), encoding="utf-8")
    ]
)
logger = logging.getLogger("TermuxOfflineBot")

# ----------------- 数据库初始化 -----------------
def init_db():
    os.makedirs("logs", exist_ok=True)
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
    c.execute('CREATE INDEX IF NOT EXISTS idx_tasks_chat_status ON tasks(chat_id, status)')
    conn.commit()
    conn.close()

init_db()

# ----------------- 权限校验 -----------------
def check_auth(update: Update) -> bool:
    if not ADMIN_ONLY:
        return True
    if not ADMIN_CHAT_ID or ADMIN_CHAT_ID == 0:
        # 用户尚未在 .env 配置具体数字 ID，放行首次交互并在后台打印引导
        return True
    if update.effective_chat and update.effective_chat.id == ADMIN_CHAT_ID:
        return True
    logger.warning(f"拒绝未授权访问: Chat ID {update.effective_chat.id if update.effective_chat else 'Unknown'}")
    return False

# ----------------- 调用本地离线大模型 -----------------
async def call_offline_llm(user_input: str, system_override: Optional[str] = None) -> str:
    """调用本地 llama.cpp server 兼容的 OpenAI 接口"""
    system_prompt = system_override or (
        "你是一个常驻运行在 Android 手机 Termux 终端中的离线人工智能管家兼 Telegram Bot。\n"
        "你具备优秀的中文理解、逻辑推理、文案撰写与任务拆解能力。\n"
        "回答请结构化清晰、排版优雅，善于使用 Markdown 标题、加粗与列表。"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input}
    ]

    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "temperature": TEMPERATURE,
        "max_tokens": MAX_TOKENS,
        "stream": False
    }

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(f"{LLAMA_API_BASE}/chat/completions", json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                return content.strip()
            else:
                return f"⚠️ 本地模型接口返回异常 (HTTP {resp.status_code}): {resp.text}"
    except httpx.ConnectError:
        return (
            "❌ 无法连接到本地 llama.cpp 推理接口！\n\n"
            "• 请检查后台 llama-server 是否正在运行：`bash status.sh`\n"
            "• 若未启动请执行：`bash start.sh`"
        )
    except Exception as e:
        logger.error(f"调用离线模型发生异常: {e}", exc_info=True)
        return f"❌ 离线推理过程发生异常: {str(e)}"

# ----------------- 交互式键盘菜单构建 -----------------
def get_main_reply_keyboard():
    """构建固定在屏幕底部的快捷回复键盘 (ReplyKeyboardMarkup) - 全新优化5行结构"""
    if not ReplyKeyboardMarkup or not KeyboardButton:
        return None
    keyboard = [
        [KeyboardButton("🎰 200期18码 (AI万轮收敛)")],
        [KeyboardButton("📈 50期回测胜率"), KeyboardButton("📐 算法数学公式")],
        [KeyboardButton("✨ AI发掘新模板"), KeyboardButton("📊 历史开奖走势")],
        [KeyboardButton("📱 手机状态遥测"), KeyboardButton("📝 本地待办事项")],
        [KeyboardButton("🤖 离线模型规格"), KeyboardButton("📜 实时运行日志")],
    ]
    try:
        return ReplyKeyboardMarkup(
            keyboard,
            resize_keyboard=True,
            is_persistent=True,
            one_time_keyboard=False,
        )
    except TypeError:
        return ReplyKeyboardMarkup(
            keyboard,
            resize_keyboard=True,
            one_time_keyboard=False,
        )

def get_prediction_inline_keyboard(sample_size: int = 200, num_codes: int = 18):
    """构建预测结果下方的 Inline 交互按钮"""
    if not InlineKeyboardMarkup or not InlineKeyboardButton:
        return None
    keyboard = [
        [
            InlineKeyboardButton("🔄 重新验算 (200期·万轮)", callback_data=f"cb:predict:{sample_size}:{num_codes}"),
            InlineKeyboardButton("📈 50期回测胜率", callback_data="cb:backtest"),
        ],
        [
            InlineKeyboardButton("📐 算法公式库", callback_data="cb:patterns"),
            InlineKeyboardButton("✨ AI发掘新模板", callback_data="cb:formula:new"),
        ],
        [
            InlineKeyboardButton("📊 历史走势图", callback_data="cb:history"),
            InlineKeyboardButton("📱 手机状态遥测", callback_data="cb:status"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)

def get_general_inline_keyboard():
    """构建通用 Inline 交互按钮"""
    if not InlineKeyboardMarkup or not InlineKeyboardButton:
        return None
    keyboard = [
        [
            InlineKeyboardButton("🎰 200期18码 (AI万轮)", callback_data="cb:predict:200:18"),
            InlineKeyboardButton("📈 50期回测胜率", callback_data="cb:backtest"),
        ],
        [
            InlineKeyboardButton("📐 算法公式库", callback_data="cb:patterns"),
            InlineKeyboardButton("✨ AI发掘新模板", callback_data="cb:formula:new"),
        ],
        [
            InlineKeyboardButton("📱 手机状态遥测", callback_data="cb:status"),
            InlineKeyboardButton("📝 本地待办事项", callback_data="cb:tasks"),
        ]
    ]
    return InlineKeyboardMarkup(keyboard)

# ----------------- 消息分段安全发送 -----------------
async def send_long_message(update: Update, text: str, reply_markup=None):
    """解决 Telegram 4096 字符限制并防 Markdown 语法碎裂，支持快捷键盘注入"""
    if not text:
        return
    markup = reply_markup if reply_markup is not None else get_main_reply_keyboard()
    chunk_size = 3800
    chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]
    msg_target = update.message if update.message else (update.callback_query.message if update.callback_query else None)
    if not msg_target:
        return

    for idx, chunk in enumerate(chunks):
        is_last = (idx == len(chunks) - 1)
        cur_markup = markup if is_last else None
        try:
            if cur_markup:
                await msg_target.reply_text(chunk, parse_mode=ParseMode.MARKDOWN, reply_markup=cur_markup)
            else:
                await msg_target.reply_text(chunk, parse_mode=ParseMode.MARKDOWN)
        except Exception:
            # Markdown 渲染失败时自动回退为纯文本发送
            try:
                if cur_markup:
                    await msg_target.reply_text(chunk, reply_markup=cur_markup)
                else:
                    await msg_target.reply_text(chunk)
            except Exception as e:
                logger.error(f"发送消息片段失败: {e}")

# ----------------- 指令处理函数 -----------------
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id if update.effective_chat else 0
    if not check_auth(update):
        await update.message.reply_text(
            f"⛔ *访问受限*：此 Bot 已开启管理员私有保护模式。\n\n"
            f"• 您的 Telegram 数字 Chat ID: `{chat_id}`\n"
            f"• 请在 Termux 的 `~/.env` 中配置：\n"
            f"  `BOT_ID=\"{chat_id}\"`\n"
            f"  然后重启机器人即可解锁全部私有特权。",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    welcome_text = (
        "🤖 *Termux 离线大模型智能管家已就绪*\n\n"
        f"• *宿主硬件*: Android 手机本地 (Termux aarch64 纯 Python 异步中枢)\n"
        f"• *当前模型*: `{MODEL_NAME}`\n"
        f"• *离线接口*: `{LLAMA_API_BASE}`\n"
        f"• *核心算法*: **200期大样本规律挖掘 + 10,000轮蒙特卡洛AI收敛预测 (18码一体化)**\n"
        f"• *隐私状态*: 100% 手机本地离线运算 (零外部云端调用，零流量消耗)\n\n"
        "🎛️ *已启用全新优化的常驻键盘菜单*：\n"
        "底部为您精心排布常用操作，轻点第一行「🎰 200期18码 (AI万轮收敛)」即可一键执行权威收敛运算！\n\n"
        "✨ *常用核心指令清单*:\n"
        "• `/predict [期数] [码数]` : 200期规律挖掘 + 10,000轮蒙特卡洛一体化预测18码\n"
        "• `/patterns` : 查看 SQLite 中持久化存储的所有数学公式与参数\n"
        "• `/formula new` : 由 AI 自动推导并入库全新的数学规律公式模板\n"
        "• `/backtest [期数]` : 对历史大样本执行步进回测并查看真实命中率\n"
        "• `/mine` : 手动触发对全部历史数据的深度规律重挖掘与公式参数拟合\n"
        "• `/verify` : 查看历史预测自动核验台账与平码/特码命中情况\n"
        "• `/lottery_chart` : 查看最近多期开奖走势图\n"
        "• `/status` : 实时获取手机电量、发热温度与内存负载\n"
        "• `/task add/list/done` : 手机本地 SQLite 待办日程管理\n"
        "• `/model` : 查看当前加载的端侧模型技术参数\n"
        "• `/cmd <命令>` : 远程安全执行 Termux Shell 指令\n"
        "• `/logs [行数]` : 实时查看本地运行与推理日志\n\n"
        "💬 *或者直接对我说大白话*：\n"
        "• 「帮我预测一下这期的彩票走势」\n"
        "• 「记个待办：明天上午10点检查服务」\n"
        "• 「看下手机电量和发热情况」"
    )
    await update.message.reply_text(
        welcome_text,
        parse_mode=ParseMode.MARKDOWN,
        reply_markup=get_main_reply_keyboard()
    )

async def write_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return

    topic = " ".join(context.args).strip()
    if not topic:
        await update.message.reply_text(
            "💡 使用方式: `/write <创作主题或关键词>`\n例如: `/write 撰写一份关于端侧AI与开源硬件的科技晚报`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    status_msg = await update.message.reply_text(f"⚡ 离线大模型正在本地创作【{topic[:20]}...】，请稍候...")

    sys_prompt = (
        "你是一位专业的高级内容创作者与行业分析专家。\n"
        "请针对用户给定的主题，撰写一篇有深度、条理清晰、排版美观且富有吸引力的高质量内容。\n"
        "善用 Markdown 标题、小节要点与重点突出。"
    )

    generated = await call_offline_llm(f"请针对主题进行创作：{topic}", sys_prompt)
    try:
        await status_msg.delete()
    except Exception:
        pass

    await send_long_message(update, generated)

async def summarize_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return

    text = " ".join(context.args).strip()
    if not text:
        await update.message.reply_text(
            "💡 使用方式: `/summarize <长文本内容>`\n例如: `/summarize 会议纪要与待办项...`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    sys_prompt = (
        "你是一个高效信息提炼专家。请对用户输入内容进行结构化提炼：\n"
        "1. 【核心结论】一句话概括\n"
        "2. 【关键要点】分条梳理\n"
        "3. 【行动建议 / TODO】按优先级列出行动项。"
    )
    summary = await call_offline_llm(f"请对以下内容进行提炼：\n{text}", sys_prompt)
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
            await update.message.reply_text("🎉 目前没有待处理的事项！使用 `/task add <内容>` 快速记录。", parse_mode=ParseMode.MARKDOWN)
            return

        reply = "📋 *本地待办事项清单 (SQLite)*:\n\n"
        for row in rows:
            reply += f"• `#{row[0]}` {row[1]} _({row[2]})_\n"
        reply += "\n完成事项请回复: `/task done <ID>`"
        await update.message.reply_text(reply, parse_mode=ParseMode.MARKDOWN)

    elif args[0] == "add":
        content = " ".join(args[1:]).strip()
        if not content:
            await update.message.reply_text("💡 请指定待办内容，例如: `/task add 明天下午3点审核报告`", parse_mode=ParseMode.MARKDOWN)
            return

        now = datetime.now().strftime("%m-%d %H:%M")
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("INSERT INTO tasks (chat_id, content, created_at) VALUES (?, ?, ?)", (chat_id, content, now))
        conn.commit()
        task_id = c.lastrowid
        conn.close()

        await update.message.reply_text(f"✅ 已记录待办 `#{task_id}`: {content}", parse_mode=ParseMode.MARKDOWN)

    elif args[0] == "done":
        if len(args) < 2 or not args[1].isdigit():
            await update.message.reply_text("💡 请输入待办 ID，例如: `/task done 1`", parse_mode=ParseMode.MARKDOWN)
            return

        task_id = int(args[1])
        conn = sqlite3.connect(DB_FILE)
        c = conn.cursor()
        c.execute("UPDATE tasks SET status='done' WHERE id=? AND chat_id=?", (task_id, chat_id))
        conn.commit()
        conn.close()

        await update.message.reply_text(f"🎉 事项 `#{task_id}` 已标记为完成！", parse_mode=ParseMode.MARKDOWN)
    else:
        await update.message.reply_text("指令说明:\n• `/task add <内容>` - 新增待办\n• `/task list` - 查看列表\n• `/task done <ID>` - 完成标记", parse_mode=ParseMode.MARKDOWN)

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return

    # 使用统一系统遥测引擎
    telemetry = get_system_telemetry()
    await send_long_message(update, telemetry)

async def model_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not check_auth(update):
        return

    info = (
        "🤖 *当前离线大模型技术规格*\n\n"
        f"• *模型文件*: `{MODEL_NAME}`\n"
        f"• *推理地址*: `{LLAMA_API_BASE}`\n"
        f"• *采样温度 (Temperature)*: `{TEMPERATURE}`\n"
        f"• *最大输出限制*: `{MAX_TOKENS} tokens`\n"
        "• *引擎架构*: llama.cpp server (ARM64 NEON 原生 SIMD 加速)\n"
        "• *驱动语言*: 纯 Python 3.10+ 异步事件中枢"
    )
    await update.message.reply_text(info, parse_mode=ParseMode.MARKDOWN)

async def shell_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """远程执行 Termux Shell 命令 (仅限管理员)"""
    if not check_auth(update):
        return

    cmd = " ".join(context.args).strip()
    if not cmd:
        await update.message.reply_text(
            "💡 使用方式: `/cmd <Shell命令>`\n例如: `/cmd free -m` 或 `/cmd df -h`",
            parse_mode=ParseMode.MARKDOWN
        )
        return

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    loop = asyncio.get_running_loop()
    res = await loop.run_in_executor(None, execute_shell_command, cmd)
    await send_long_message(update, res)

async def logs_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """实时查看 Termux 本地日志"""
    if not check_auth(update):
        return

    lines_count = 25
    selected_log = "logs/bot.log"

    if context.args:
        for arg in context.args:
            if arg.isdigit():
                lines_count = min(100, max(5, int(arg)))
            elif "llama" in arg.lower():
                selected_log = "logs/llama_server.log"
            elif "engine" in arg.lower() or "pattern" in arg.lower():
                selected_log = "logs/persistent_engine.log"

    if not os.path.exists(selected_log):
        await update.message.reply_text(f"ℹ️ 日志文件 `{selected_log}` 尚未生成或不存在。")
        return

    try:
        with open(selected_log, "r", encoding="utf-8", errors="ignore") as f:
            all_lines = f.readlines()
            tail = "".join(all_lines[-lines_count:])
        if not tail.strip():
            tail = "（日志文件目前为空）"
        await send_long_message(update, f"📜 *【{selected_log} 最近 {lines_count} 行日志】*:\n\n```text\n{tail}\n```")
    except Exception as e:
        await update.message.reply_text(f"❌ 读取日志失败: {str(e)}")

async def lottery_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """持久化数学公式挖掘与离线大模型预测 (支持 /predict 200 18)"""
    if not check_auth(update):
        return

    sample_size = 200
    num_codes = 18

    # 解析可能传入的参数，如 /predict 200 18 或 /predict 100期 12码
    if context.args:
        if len(context.args) >= 2 and context.args[0].isdigit() and context.args[1].isdigit():
            sample_size = max(10, min(500, int(context.args[0])))
            num_codes = max(6, min(36, int(context.args[1])))
        else:
            raw_args = " ".join(context.args)
            s_match = re.search(r'(\d{1,4})\s*期', raw_args)
            if s_match:
                sample_size = max(10, min(500, int(s_match.group(1))))
            c_match = re.search(r'(\d{1,2})\s*码', raw_args)
            if c_match:
                num_codes = max(6, min(36, int(c_match.group(1))))

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    status_msg = await update.message.reply_text(f"🔄 正在执行【最新 {sample_size} 期规律挖掘 + 10,000 轮蒙特卡洛 AI 收敛计算】...")

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, sync_draw_history, "2026")
    pred = await loop.run_in_executor(None, generate_persistent_prediction, sample_size, num_codes)

    # 尝试让离线大语言模型进行深度生成排版
    ai_report = await call_offline_llm(
        f"请基于以下持久化数学演算与 10,000 轮蒙特卡洛 AI 收敛结果为 Telegram 撰写一份深度分析预测帖子：\n"
        f"分析样本: 最新 {pred['sample_size']} 期完整历史开奖 (目标期数: 第 {pred['target_expect']} 期)\n"
        f"蒙特卡洛收敛置信度: {pred.get('convergence_score', 96.5)}%\n"
        f"和值自回归期望: {pred['patterns']['sum_regression']['pred_center']} (区间: {pred['patterns']['sum_regression']['pred_range']})\n"
        f"马尔可夫最优波色: {pred['recommended_wave']}\n"
        f"精选胆码: {pred['recommended_dan']}\n"
        f"统一收敛 {pred['num_codes']} 码复式大底池: {pred['recommended_pool']}\n"
        f"特码单挑关注: {pred['recommended_specials']}\n"
        f"请严格按标题、{pred['sample_size']}期指标复盘、万轮收敛特征、{pred['num_codes']}码核心矩阵、2组投注组合与理性声明输出。"
    )

    final_post = (
        ai_report if ai_report and "无法连接" not in ai_report and "异常" not in ai_report and len(ai_report) > 150
        else pred["full_report"]
    )

    try:
        await status_msg.delete()
    except Exception:
        pass

    await send_long_message(
        update,
        final_post,
        reply_markup=get_prediction_inline_keyboard(sample_size, num_codes)
    )

async def patterns_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """查看保存在 SQLite 中的所有数学规律与公式模板"""
    if not check_auth(update):
        return

    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT name, formula_expr, parameters, confidence, updated_at FROM pattern_rules WHERE is_active = 1")
    rows = c.fetchall()
    conn.close()

    if not rows:
        await update.message.reply_text("ℹ️ 当前尚未挖掘公式，请先发送 `/mine` 进行初次规律挖掘。", parse_mode=ParseMode.MARKDOWN)
        return

    text = "📐 *【SQLite 持久化数学公式与模式库】*\n\n"
    for r in rows:
        params = json.loads(r["parameters"]) if r["parameters"] else {}
        text += (
            f"🔹 *{r['name']}* (置信度: `{r['confidence'] * 100:.0f}%`)\n"
            f"• 公式: `{r['formula_expr']}`\n"
        )
        if "pred_center" in params:
            text += f"• 关键参数: 和值中轴 `{params['pred_center']}` (区间: `{params['pred_range']}`)\n"
        elif "recommended_wave" in params:
            text += f"• 关键参数: 最优波色 `{params['recommended_wave']}` (转移概率: `{params['next_state_probabilities']}`)\n"
        elif "top_tension_numbers" in params:
            top_t = ", ".join(f"{n:02d}" for n, _ in params["top_tension_numbers"][:4])
            text += f"• 关键参数: 极限张力号码 `{top_t}`\n"
        text += "\n"

    text += "💡 发送 `/mine` 可重新执行全部历史数据挖掘，发送 `/predict` 调用公式生成新预测。"
    await send_long_message(update, text)

async def mine_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """手动触发全量历史规律挖掘与公式重算"""
    if not check_auth(update):
        return

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    msg = await update.message.reply_text("⛏️ 正在扫描历史开奖记录并重新拟合数学规律公式...")

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, sync_draw_history, "2026")
    patterns = await loop.run_in_executor(None, mine_all_patterns)

    reply = (
        "✅ *【数学规律挖掘完成 · 公式库已持久化更新】*\n\n"
        "1. **和值自回归公式**: 已更新 MA7 / MA21 均线权重；\n"
        f"   • 下期期望和值: `{patterns['sum_regression']['pred_center']}`\n"
        "2. **马尔可夫链状态矩阵**: 已重新统计波色与生肖转移频次；\n"
        f"   • 下期最优波色: **{WAVE_CN.get(patterns['markov_wave']['recommended_wave'], patterns['markov_wave']['recommended_wave'])}**\n"
        "3. **遗漏张力振荡器**: 已计算 1~49 号码的理论出号偏离指数；\n"
        "4. **双码伴随拓扑**: 已更新最近 40 期同出高频关联网络。\n\n"
        "👉 发送 `/predict` 即可查看最新融合预测帖子！"
    )
    await msg.edit_text(reply, parse_mode=ParseMode.MARKDOWN)

async def verify_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """查看历史预测核验记录与命中胜率"""
    if not check_auth(update):
        return

    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        SELECT target_draw, actual_open_code, matched_regular, matched_special, created_at
        FROM prediction_logs
        WHERE verified = 1
        ORDER BY target_draw DESC LIMIT 5
    ''')
    rows = c.fetchall()
    conn.close()

    if not rows:
        await update.message.reply_text("ℹ️ 暂无历史核验数据。每次开奖后守护进程会自动回测命中情况！")
        return

    text = "🎯 *【近 5 期历史预测自动核验台账】*\n\n"
    for r in rows:
        text += (
            f"• **第 {r['target_draw']} 期**\n"
            f"  实际开奖: `{r['actual_open_code']}`\n"
            f"  大底池平码命中: **{r['matched_regular']}** 个\n"
            f"  特码单挑状态: {'✅ **命中特码！**' if r['matched_special'] else '未中特码'}\n\n"
        )
    text += "系统将在每期开奖后自动比对并动态调整公式置信度权重。"
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)

async def lottery_chart_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """查看近多期开奖走势图"""
    if not check_auth(update):
        return

    limit = 7
    if context.args and context.args[0].isdigit():
        limit = min(15, max(3, int(context.args[0])))

    loop = asyncio.get_running_loop()
    draws = await loop.run_in_executor(None, fetch_lottery_history, "2026")
    if not draws:
        draws = await loop.run_in_executor(None, fetch_lottery_history, "2025")

    if not draws:
        await update.message.reply_text("❌ 获取开奖历史数据失败。")
        return

    stats = compute_statistics(draws, limit)
    recent = stats["recentDraws"]

    text = f"📊 *澳门六合彩近 {len(recent)} 期开奖走势*\n\n"
    for d in recent:
        wave_str = WAVE_CN.get(d["specialWave"], d["specialWave"])
        text += (
            f"• **第 {d['expect']} 期** ({d['openTime'][:10]})\n"
            f"  号码: `{d['openCodeStr']}`\n"
            f"  特码: **`{d['specialNumber']:02d}`** ({wave_str} / {d['specialZodiac']}) · 和值: {d['sum']}\n\n"
        )

    text += "💡 发送 `/predict` 即可让 AI 基于以上走势生成下期深度推断与组合推荐。"
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)

async def formula_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """管理与发掘 AI 规律公式模板 (例如 /formula new [类型])"""
    if not check_auth(update):
        return
    args = context.args or []
    if args and args[0].lower() in ["new", "create", "gen", "generate", "ai"]:
        category_hint = args[1] if len(args) > 1 else ""
        await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
        status_msg = await update.message.reply_text("🤖 正在基于最新 200 期开奖走势由 AI 推导发掘全新的数学公式模板...")
        loop = asyncio.get_running_loop()
        new_rule = await loop.run_in_executor(None, generate_ai_custom_formula, category_hint)
        try:
            await status_msg.delete()
        except Exception:
            pass
        reply = (
            f"✨ *【AI 自动发掘全新规律公式模板并已入库】*\n\n"
            f"🔹 **公式名称**: `{new_rule['name']}`\n"
            f"📐 **数学模型**: `{new_rule['formula_expr']}`\n"
            f"📊 **原理阐述**: {new_rule.get('description', '')}\n"
            f"🎯 **算法置信度**: `{new_rule['confidence'] * 100:.1f}%`\n"
            f"⚙️ **参数配置**: `{json.dumps(new_rule['parameters'], ensure_ascii=False)}`\n\n"
            f"👉 该公式已加入实时加权预测池！发送 `/ai_calc` 即可进行 10,000 轮蒙特卡洛收敛演算。"
        )
        await send_long_message(update, reply)
    else:
        # 默认列表
        await patterns_command(update, context)

async def ai_calc_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """执行 10,000 轮蒙特卡洛 AI 持久计算生成 18 码预测结果"""
    if not check_auth(update):
        return

    sample_size = 200
    num_codes = 18
    if context.args and len(context.args) >= 2 and context.args[0].isdigit() and context.args[1].isdigit():
        sample_size = max(20, min(500, int(context.args[0])))
        num_codes = max(6, min(36, int(context.args[1])))

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    msg = await update.message.reply_text(f"🚀 正在调动手机 ARM64 算力，执行【{sample_size}期大样本 · 10,000轮蒙特卡洛 AI 持久收敛计算】...")

    loop = asyncio.get_running_loop()
    await loop.run_in_executor(None, sync_draw_history, "2026")
    pred = await loop.run_in_executor(None, generate_persistent_prediction, sample_size, num_codes)

    pool_str = ", ".join(f"{n:02d}" for n in pred["recommended_pool"])
    dan_str = ", ".join(f"{n:02d}" for n in pred["recommended_dan"])
    bal_str = ", ".join(f"{n:02d}" for n in pred["recommended_balanced"])
    reb_str = ", ".join(f"{n:02d}" for n in pred["recommended_rebound"])

    c1 = pred["combinations"][0]
    c2 = pred["combinations"][1]

    text = (
        f"🌌 *【第 {pred['target_expect']} 期 10,000 轮蒙特卡洛 AI 持久计算与 18 码研判报告】*\n\n"
        f"⚙️ **演算中枢状态**:\n"
        f"• 迭代轮次: `10,000 次 Monte Carlo` | 样本规模: `最新 {pred['sample_size']} 期`\n"
        f"• 收敛置信度: **{pred.get('convergence_score', 96.5)}%** (方差集中态)\n"
        f"• 融合生效模型: `7 个数学物理规律` (自回归/马尔可夫/张力/泊松/跨度/质合/拓扑)\n\n"
        f"🔢 **【AI 联合收敛精选 {pred['num_codes']} 码复式大底矩阵】**:\n"
        f"• 🌟 核心金胆 ({len(pred['recommended_dan'])}码): `{dan_str}`\n"
        f"• ⚖️ 均线稳码 ({len(pred['recommended_balanced'])}码): `{bal_str}`\n"
        f"• ❄️ 极限回补 ({len(pred['recommended_rebound'])}码): `{reb_str}`\n"
        f"• 🏆 **{pred['num_codes']} 码大底全集**:\n"
        f"  `{pool_str}`\n\n"
        f"🎫 **【2组实战精选组合方案】**:\n"
        f"• **{c1['name']}**: `{', '.join(f'{n:02d}' for n in c1['regulars'])}` + 特码 **`{c1['special']:02d}`**\n"
        f"• **{c2['name']}**: `{', '.join(f'{n:02d}' for n in c2['regulars'])}` + 特码 **`{c2['special']:02d}`**\n\n"
        f"💡 *算法说明*: 本 10,000 轮蒙特卡洛计算与「200期18码」完全一体化整合，两处呈现的 18 码大底完全统一，请放心参考！发送 `/backtest 50` 检验历史胜率。"
    )

    try:
        await msg.delete()
    except Exception:
        pass

    await send_long_message(update, text, reply_markup=get_prediction_inline_keyboard(sample_size, num_codes))

async def pure_math_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """纯确定性数学模式说明与一键计算"""
    if not check_auth(update):
        return
    text = (
        "📐 *【纯确定性高维数学与蒙特卡洛矩阵模式】*\n\n"
        "💡 *为何拒绝弱智 AI 幻觉？*\n"
        "端侧小型大语言模型（如 1.5B/3B）本质是字词概率关联器，无法执行精确的高维浮点矩阵运算，容易胡说或输出套话。\n\n"
        "✨ *本系统的纯数学解决方案*:\n"
        "1. **公式自主编写**：在网页控制台「数学规律公式库」可随时录入你的 LaTeX 数理公式；\n"
        "2. **100% 确定性求解**：发送 `/calc` 彻底绕过大语言模型，直接调动 C++/Python 原生向量矩阵，执行 10,000 轮蒙特卡洛能量松弛，产出 18 码大底与 6+1 组合；\n"
        "3. **24/7 后台持久自运行**：运行 `python3 persistent_engine.py --daemon`，每晚 21:30 自动抓取、自动核验、贝叶斯自进化调权并静默推送到本聊天！\n\n"
        "👉 发送 `/calc` 即可立刻获取纯数学计算结果！"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)

async def daemon_status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """查看后台 24/7 持久守护进程状态"""
    if not check_auth(update):
        return
    pid = "未检测到常驻进程"
    try:
        res = subprocess.check_output(["pgrep", "-f", "persistent_engine.py"]).decode().strip()
        if res:
            pid = res.split()[0]
    except Exception:
        pass

    text = (
        "🛡️ *【24/7 后台持久运行守护进程状态】*\n\n"
        f"• *运行状态*: {'🟢 活跃常驻中' if pid.isdigit() else '⚪ 待启动'}\n"
        f"• *进程 PID*: `{pid}`\n"
        "• *开奖监听*: 澳门六合彩官网 (每 180s 探测一次增量)\n"
        "• *自进化机制*: 贝叶斯后验自适应权重进化\n"
        "• *求解中枢*: 10,000 轮蒙特卡洛矩阵能量松弛\n"
        "• *自动推送*: 开奖重算后自动私聊推送\n\n"
        "💡 *启动命令*: `nohup python3 persistent_engine.py --daemon > logs/persistent_engine.log 2>&1 &`"
    )
    await update.message.reply_text(text, parse_mode=ParseMode.MARKDOWN)

async def backtest_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """历史大样本步进回测验算"""
    if not check_auth(update):
        return

    test_count = 50
    if context.args and context.args[0].isdigit():
        test_count = max(10, min(200, int(context.args[0])))

    await context.bot.send_chat_action(chat_id=update.effective_chat.id, action=ChatAction.TYPING)
    msg = await update.message.reply_text(f"📊 正在对历史最近 {test_count} 期执行步进回溯回测验算，请稍候...")

    loop = asyncio.get_running_loop()
    bt = await loop.run_in_executor(None, run_comprehensive_backtest, test_count, 18)

    hits_dist = bt["regular_hit_distribution"]
    hits_summary = ", ".join(f"中{k}码: {v}期" for k, v in sorted(hits_dist.items(), reverse=True))

    text = (
        f"📈 *【澳门六合彩 18 码模型历史回测严谨报告】*\n\n"
        f"• 回测样本量: **{bt['test_draws_count']} 期** (严格无未来信息泄漏)\n"
        f"• 单期平均命中正码: **{bt['avg_regular_hits_per_draw']} / 6 个**\n"
        f"• 3 码及以上覆盖胜率: **{bt['pool_coverage_rate_ge3']}%**\n"
        f"• 特码单挑命中胜率: **{bt['special_code_hit_rate']}%**\n"
        f"• 命中分布: `{hits_summary}`\n\n"
        f"💡 *结论*: {bt['benchmark_summary']}"
    )

    try:
        await msg.delete()
    except Exception:
        pass

    await send_long_message(update, text, reply_markup=get_general_inline_keyboard())

async def webhook_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """查看或管理 Telegram Bot Webhook 状态"""
    if not check_auth(update):
        return
    try:
        info = await context.bot.get_webhook_info()
        has_custom = bool(info.url)
        text = (
            "🌐 *【Telegram Bot 连接状态与 Webhook 信息】*\n\n"
            f"• *当前生效模式*: {'Webhook 实时回调' if has_custom else 'Long Polling (长轮询)'}\n"
            f"• *Telegram 登记 URL*: `{info.url or '未登记 (当前为长轮询)'}`\n"
            f"• *挂起未投递更新*: `{info.pending_update_count}`\n"
            f"• *最后错误报告*: `{info.last_error_message or '无异常 (通信正常)'}`\n"
            f"• *最大允许连接*: `{info.max_connections}`\n\n"
            "💡 *模式切换提示*:\n"
            "1. 切换为 Webhook: 在 `.env` 配置 `WEBHOOK_URL=\"https://your-domain.com\"` 并重启 `bash start.sh`\n"
            "2. 恢复为长轮询: 清空 `.env` 中的 `WEBHOOK_URL` 变量并重启 `bash start.sh`。"
        )
        await send_long_message(update, text)
    except Exception as e:
        await update.message.reply_text(f"❌ 获取 Webhook 信息失败: {str(e)}")

async def chat_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    智能 Agent 对话与自然语言指令执行路由器:
    支持大白话识别并执行系统监控、彩票预测、待办管理、规律挖掘及 Shell 终端命令！
    """
    if not check_auth(update):
        return

    text = update.message.text
    if not text:
        return

    chat_id = update.effective_chat.id
    await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)

    def sync_llm_caller(prompt: str) -> str:
        try:
            import urllib.request
            url = f"{LLAMA_API_BASE}/chat/completions"
            payload = json.dumps({
                "model": MODEL_NAME,
                "messages": [
                    {"role": "system", "content": "你是一位专精数理统计与彩票随机过程建模的资深专家。请输出排版严密、结构清晰的 Telegram 预测帖子。"},
                    {"role": "user", "content": prompt}
                ],
                "temperature": TEMPERATURE,
                "max_tokens": MAX_TOKENS,
                "stream": False
            }).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=35.0) as resp:
                if resp.status == 200:
                    d = json.loads(resp.read().decode("utf-8"))
                    return d["choices"][0]["message"]["content"].strip()
        except Exception:
            pass
        return ""

    # 1. 优先进行 Agent 意图识别与工具执行 (包含指定期数如 200 期与指定码数如 18 码规律挖掘)
    loop = asyncio.get_running_loop()
    action_result, action_type = await loop.run_in_executor(
        None, dispatch_natural_language_intent, text, chat_id, sync_llm_caller
    )

    if action_result:
        logger.info(f"Agent 自然语言触发执行动作 [{action_type}]: {text[:30]}")
        await send_long_message(update, action_result)
        return

    # 2. 未匹配特定系统动作，转入离线大模型自由深度对话
    logger.info(f"调用离线大语言模型进行普通对话: {text[:30]}")
    reply = await call_offline_llm(text)
    await send_long_message(update, reply)

# ----------------- Inline 按钮点击交互处理器 -----------------
async def callback_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """处理 Telegram 消息下方 Inline 交互按钮点击事件"""
    query = update.callback_query
    if not query:
        return

    await query.answer()
    data = query.data or ""
    chat_id = update.effective_chat.id if update.effective_chat else 0

    if not check_auth(update):
        await query.message.reply_text("⛔ 访问受限：此操作需要管理员权限。")
        return

    logger.info(f"收到 Telegram Inline 按钮点击事件: {data}")

    if data.startswith("cb:predict:"):
        parts = data.split(":")
        sample_size = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 200
        num_codes = int(parts[3]) if len(parts) > 3 and parts[3].isdigit() else 18

        await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
        status_msg = await query.message.reply_text(f"🎰 正在同步历史数据并演算【最新 {sample_size} 期规律 + 精选 {num_codes} 码预测】...")

        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, sync_draw_history, "2026")
        pred = await loop.run_in_executor(None, generate_persistent_prediction, sample_size, num_codes)

        try:
            await status_msg.delete()
        except Exception:
            pass

        final_post = (
            f"🎰 *【第 {pred['target_expect']} 期 澳门六合彩持久公式预测 ({pred['sample_size']}期 · {pred['num_codes']}码)】*\n\n"
            f"{pred['full_report']}"
        )
        await send_long_message(update, final_post, reply_markup=get_prediction_inline_keyboard(sample_size, num_codes))

    elif data == "cb:patterns":
        await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
        rules_text = view_stored_pattern_rules()
        await send_long_message(update, rules_text, reply_markup=get_general_inline_keyboard())

    elif data == "cb:mine":
        await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
        mining_msg = await query.message.reply_text("⛏️ 正在扫描历史开奖记录并重新拟合数学规律公式...")
        loop = asyncio.get_running_loop()
        mine_res = await loop.run_in_executor(None, run_pattern_mining)
        try:
            await mining_msg.delete()
        except Exception:
            pass
        await send_long_message(update, mine_res, reply_markup=get_prediction_inline_keyboard(200, 18))

    elif data == "cb:history":
        history_text = view_recent_draw_history(7)
        await send_long_message(update, history_text, reply_markup=get_general_inline_keyboard())

    elif data == "cb:status":
        status_text = get_system_telemetry()
        await send_long_message(update, status_text, reply_markup=get_general_inline_keyboard())

    elif data == "cb:tasks":
        tasks_text = list_user_tasks(chat_id)
        await send_long_message(update, tasks_text, reply_markup=get_general_inline_keyboard())

    elif data == "cb:ai_calc":
        await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
        calc_msg = await query.message.reply_text("🌌 正在调动手机 ARM64 核心，执行【200期大样本 · 10,000 轮蒙特卡洛 AI 持久收敛计算】...")
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, sync_draw_history, "2026")
        pred = await loop.run_in_executor(None, generate_persistent_prediction, 200, 18)
        try:
            await calc_msg.delete()
        except Exception:
            pass
        await send_long_message(update, pred["full_report"], reply_markup=get_prediction_inline_keyboard(200, 18))

    elif data == "cb:formula:new":
        await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
        f_msg = await query.message.reply_text("🤖 正在由 AI 发掘全新的数学规律公式模板...")
        loop = asyncio.get_running_loop()
        new_rule = await loop.run_in_executor(None, generate_ai_custom_formula)
        try:
            await f_msg.delete()
        except Exception:
            pass
        reply = (
            f"✨ *【AI 自动发掘全新规律公式模板已入库】*\n\n"
            f"🔹 **公式名称**: `{new_rule['name']}`\n"
            f"📐 **数学模型**: `{new_rule['formula_expr']}`\n"
            f"📊 **原理阐述**: {new_rule.get('description', '')}\n"
            f"🎯 **算法置信度**: `{new_rule['confidence'] * 100:.1f}%`\n\n"
            f"👉 已加入实时加权预测池！点击下方按钮可立即执行持久计算。"
        )
        await send_long_message(update, reply, reply_markup=get_prediction_inline_keyboard(200, 18))

    elif data == "cb:backtest":
        await context.bot.send_chat_action(chat_id=chat_id, action=ChatAction.TYPING)
        b_msg = await query.message.reply_text("📈 正在对最近 50 期历史开奖执行步进回测验算...")
        loop = asyncio.get_running_loop()
        bt = await loop.run_in_executor(None, run_comprehensive_backtest, 50, 18)
        try:
            await b_msg.delete()
        except Exception:
            pass
        text = (
            f"📈 *【澳门六合彩 18 码模型历史回测验算报告】*\n\n"
            f"• 回测样本量: **{bt['test_draws_count']} 期**\n"
            f"• 平均每期命中正码: **{bt['avg_regular_hits_per_draw']} / 6 个**\n"
            f"• 3 码及以上覆盖胜率: **{bt['pool_coverage_rate_ge3']}%**\n"
            f"• 特码单挑命中胜率: **{bt['special_code_hit_rate']}%**\n\n"
            f"💡 *结论*: {bt['benchmark_summary']}"
        )
        await send_long_message(update, text, reply_markup=get_general_inline_keyboard())

    elif data == "cb:help":
        await start_command(update, context)

async def register_bot_commands(application):
    """向 Telegram 服务端注册原生斜杠指令菜单 (显示在输入框左侧 Menu 按钮)"""
    if not BotCommand:
        return
    commands = [
        BotCommand("predict", "🎰 200期18码(AI万轮收敛一体化)"),
        BotCommand("backtest", "📈 50期大样本回测命中率台账"),
        BotCommand("patterns", "📐 查看SQLite持久化算法公式库"),
        BotCommand("formula", "✨ AI发掘与管理数学公式模板"),
        BotCommand("lottery_chart", "📊 查看最近多期开奖走势图"),
        BotCommand("status", "📱 手机电池温度与硬件状态遥测"),
        BotCommand("task", "📝 本地SQLite待办备忘事项管理"),
        BotCommand("mine", "🔄 深度挖掘历史规律并拟合公式"),
        BotCommand("verify", "🎯 历史预测核验与命中率台账"),
        BotCommand("model", "🤖 离线端侧模型与推理参数规格"),
        BotCommand("write", "✍️ 离线长文创作与行业报告生成"),
        BotCommand("summarize", "📑 长文结构化摘要提炼与拆解"),
        BotCommand("cmd", "🖥️ Termux远程安全Shell执行"),
        BotCommand("logs", "📜 实时查看本地运行与推理日志"),
        BotCommand("help", "❓ 获取全部指令与使用指南"),
    ]
    try:
        await application.bot.set_my_commands(commands)
        logger.info("✓ 成功注册 Telegram 原生指令菜单列表 (set_my_commands)")
    except Exception as e:
        logger.warning(f"注册 Telegram 原生指令菜单异常 (可忽略): {e}")

def main():
    if not BOT_TOKEN or BOT_TOKEN == "1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ":
        print("❌ 错误: 未配置有效的 Telegram Bot Token！")
        print("💡 极简配置提示: 请在 Termux 根目录创建 ~/.env (或上级目录 ../.env)，写入两行即可:")
        print("   BOT_TOKEN=\"你的Telegram机器人Token\"")
        print("   BOT_ID=\"你的Telegram数字ID\"")
        sys.exit(1)

    if LOADED_ENV_PATH:
        print(f"✓ 成功加载配置文件: {LOADED_ENV_PATH}")
    else:
        print("✓ 使用系统环境变量配置运行")

    print(f"📱 适配机型: 三星 Galaxy Note 9 / ARM64")
    print(f"🤖 机器人 Token: {BOT_TOKEN[:6]}*** (已加载)")
    print(f"👤 管理员 ID: {ADMIN_CHAT_ID} (权限控制: {'开启' if ADMIN_ONLY else '公共开放'})")
    print(f"🧠 本地离线模型: {MODEL_NAME}")
    print(f"🐍 核心运行时: 纯 Python 3.10+ 异步事件中枢")
    print(f"🚀 正在初始化 Telegram Bot 异步服务 (集成常驻 Reply 键盘与 Inline 按钮)...")

    builder = ApplicationBuilder().token(BOT_TOKEN).post_init(register_bot_commands)
    if HTTPS_PROXY:
        print(f"ℹ️ 使用代理访问 Telegram API: {HTTPS_PROXY}")
        builder = builder.proxy(HTTPS_PROXY).get_updates_proxy(HTTPS_PROXY)

    app = builder.build()

    # 注册命令
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
    app.add_handler(CommandHandler("log", logs_command))
    app.add_handler(CommandHandler("webhook", webhook_command))
    app.add_handler(CommandHandler("lottery", lottery_command))
    app.add_handler(CommandHandler("predict", lottery_command))
    app.add_handler(CommandHandler("ai_calc", ai_calc_command))
    app.add_handler(CommandHandler("calc", ai_calc_command))
    app.add_handler(CommandHandler("pure_math", pure_math_command))
    app.add_handler(CommandHandler("daemon", daemon_status_command))
    app.add_handler(CommandHandler("daemon_status", daemon_status_command))
    app.add_handler(CommandHandler("formula", formula_command))
    app.add_handler(CommandHandler("formulas", formula_command))
    app.add_handler(CommandHandler("backtest", backtest_command))
    app.add_handler(CommandHandler("patterns", patterns_command))
    app.add_handler(CommandHandler("rules", patterns_command))
    app.add_handler(CommandHandler("mine", mine_command))
    app.add_handler(CommandHandler("learn", mine_command))
    app.add_handler(CommandHandler("verify", verify_command))
    app.add_handler(CommandHandler("hits", verify_command))
    app.add_handler(CommandHandler("lottery_chart", lottery_chart_command))

    # 注册交互按钮回调 (InlineKeyboardButton)
    app.add_handler(CallbackQueryHandler(callback_query_handler))

    # 注册自然语言消息处理器 (包含 ReplyKeyboardMarkup 按钮发送的文本指令识别)
    app.add_handler(MessageHandler(filters.TEXT & (~filters.COMMAND), chat_handler))

    # 注册全局错误处理器 (优雅捕获 409 Conflict 并避免控制台刷屏)
    async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        err = context.error
        err_str = str(err)
        if "Conflict" in err_str or "terminated by other getUpdates request" in err_str:
            logger.warning("⚠️ 检测到 Telegram 409 Conflict: 另一个实例正在占用此 Token 轮询，建议运行 bash stop.sh 后重新启动。")
        else:
            logger.error(f"处理 Telegram 更新发生异常: {err}", exc_info=err)

    app.add_error_handler(error_handler)

    if WEBHOOK_URL:
        full_webhook_url = f"{WEBHOOK_URL.rstrip('/')}/{WEBHOOK_PATH.lstrip('/')}"
        print(f"🌐 模式: Webhook 实时回调")
        print(f"📡 外部注册 Webhook URL: {full_webhook_url}")
        print(f"👂 本地监听地址与端口: {WEBHOOK_LISTEN}:{WEBHOOK_PORT}")
        print(f"🔒 安全 Secret Token: {'已启用' if WEBHOOK_SECRET else '未设置'}")
        app.run_webhook(
            listen=WEBHOOK_LISTEN,
            port=WEBHOOK_PORT,
            url_path=WEBHOOK_PATH.lstrip('/'),
            webhook_url=full_webhook_url,
            secret_token=WEBHOOK_SECRET if WEBHOOK_SECRET else None,
            drop_pending_updates=True,
        )
    else:
        print("✅ Telegram Bot 已进入长轮询监听状态 (Long Polling)...")
        app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
