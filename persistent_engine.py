#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Termux 离线 AI 彩票规律持久化守护进程 (Persistent Calculation & Auto-Post Daemon)
- 持续运行于后台:
  1. 周期性监听最新开奖结果 (每隔 3~5 分钟检查一次增量)
  2. 发现新开奖自动入库、自动回测上期预测结果 (核验命中率)
  3. 重新演算数学公式参数并持久化更新至 SQLite
  4. 自动生成下期综合预测帖子，并主动推送到管理员 Telegram 或专属频道
"""

import os
import sys
import time
import json
import logging
import asyncio
from datetime import datetime
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

from pattern_engine import (
    sync_draw_history,
    load_stored_draws,
    mine_all_patterns,
    generate_persistent_prediction,
    verify_past_predictions,
    get_db_connection,
    run_monte_carlo_persistent_calculation,
    get_all_stored_formulas,
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

def get_env_val(keys: list, default: str = "") -> str:
    for k in keys:
        v = os.getenv(k)
        if v is not None and str(v).strip() != "":
            return str(v).strip()
    return default

# 机器人 Token 与管理员 ID (兼容多种简写与完整写法)
BOT_TOKEN = get_env_val(["BOT_TOKEN", "TELEGRAM_BOT_TOKEN", "TOKEN", "TG_BOT_TOKEN"], "")
ADMIN_CHAT_ID = get_env_val(["BOT_ID", "ADMIN_CHAT_ID", "ADMIN_ID", "USER_ID", "CHAT_ID", "ID"], "")
HTTPS_PROXY = os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY") or None
CHECK_INTERVAL_SECONDS = int(os.getenv("CHECK_INTERVAL_SECONDS", "180")) # 默认 3 分钟检查一次增量开奖

os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    format="%(asctime)s [%(levelname)s] [PersistentEngine]: %(message)s",
    level=logging.INFO,
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(os.path.expanduser("logs/persistent_engine.log"), encoding="utf-8")
    ]
)
logger = logging.getLogger("PersistentEngine")

async def send_telegram_post(text: str) -> bool:
    """自动将预测内容推送到 Telegram"""
    if not BOT_TOKEN or not ADMIN_CHAT_ID or ADMIN_CHAT_ID == "0":
        logger.warning("未配置有效的 TELEGRAM_BOT_TOKEN 或 ADMIN_CHAT_ID，跳过自动推送。")
        return False

    api_url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": ADMIN_CHAT_ID,
        "text": text,
        "parse_mode": "Markdown",
        "disable_web_page_preview": True,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0, proxy=HTTPS_PROXY) as client:
            resp = await client.post(api_url, json=payload)
            if resp.status_code == 200:
                logger.info(f"成功将预测帖子推送至 Telegram (Chat ID: {ADMIN_CHAT_ID})")
                return True
            else:
                # 尝试纯文本降级发送
                payload.pop("parse_mode", None)
                fallback_resp = await client.post(api_url, json=payload)
                return fallback_resp.status_code == 200
    except Exception as e:
        logger.error(f"推送 Telegram 帖子失败: {e}")
        return False

async def update_persistent_status_file(mc_result: dict, new_draw_detected: bool = False):
    """持久化记录当前后台计算中枢状态与蒙特卡洛矩阵"""
    status_data = {
        "is_running": True,
        "pid": os.getpid(),
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "target_expect": mc_result.get("target_expect", ""),
        "convergence_score": mc_result.get("convergence_score", 95.0),
        "monte_carlo_iterations": mc_result.get("iterations", 10000),
        "active_rules_count": mc_result.get("active_rules_count", 7),
        "recommended_pool_18": mc_result.get("recommended_pool", []),
        "recommended_dan": mc_result.get("recommended_dan", []),
        "recommended_rebound": mc_result.get("recommended_rebound", []),
        "recommended_balanced": mc_result.get("recommended_balanced", []),
        "combinations": mc_result.get("combinations", []),
        "new_draw_detected": new_draw_detected,
    }
    try:
        with open("logs/persistent_status.json", "w", encoding="utf-8") as f:
            json.dump(status_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.warning(f"写入 persistent_status.json 失败: {e}")

async def run_persistent_cycle(force_calc: bool = False):
    """单次规律演算与监听循环"""
    logger.info("正在检查开奖数据增量更新...")
    new_count = sync_draw_history("2026")

    # 执行 10,000 轮蒙特卡洛集成计算
    mc_result = run_monte_carlo_persistent_calculation(sample_size=200, iterations=10000, num_codes=18)
    await update_persistent_status_file(mc_result, new_draw_detected=(new_count > 0))

    if new_count > 0 or force_calc:
        logger.info(f"🎉 {'发现 ' + str(new_count) + ' 期新开奖' if new_count > 0 else '收到强制演算触发'}！开始自动化核验与公式重算...")

        # 1. 自动核验上一期预测的命中情况
        audits = verify_past_predictions()
        audit_msg = ""
        for a in audits:
            logger.info(f"核验反馈: 第 {a['target_draw']} 期 开出 {a['actual_open']}，命中平码 {a['matched_regular']} 个，特码命中: {a['matched_special']}")
            audit_msg += (
                f"🎯 *【第 {a['target_draw']} 期 历史预测核验报告】*\n"
                f"• 实际开奖: `{a['actual_open']}`\n"
                f"• 大底池命中平码: **{a['matched_regular']}** 个\n"
                f"• 特码命中状态: {'✅ **命中特码！**' if a['matched_special'] else '未中特码'}\n\n"
            )

        if audit_msg:
            await send_telegram_post(audit_msg)

        # 2. 重新挖掘数学规律公式并持久化更新参数
        logger.info("正在更新和值回归模型、马尔可夫转移矩阵及遗漏张力...")
        mine_all_patterns()

        # 3. 产生下期预测报告
        prediction_result = generate_persistent_prediction()
        logger.info(f"第 {prediction_result['target_expect']} 期预测演算完成，准备发布帖子...")

        # 4. 发布带有公式参数的正式 Telegram 帖子
        post_header = "📢 *【AI 离线引擎 · 蒙特卡洛 10,000 轮持久计算结果自动更新】*\n\n"
        full_post = post_header + prediction_result["full_report"]

        await send_telegram_post(full_post)
    else:
        logger.info(f"数据已是最新 (第 {mc_result.get('target_expect')} 期收敛度 {mc_result.get('convergence_score')}%，18码已固化)。")

async def main():
    logger.info("====================================================================")
    logger.info("   🚀 Termux 彩票规律持久化挖掘与 10,000 轮持久计算守护进程已启动    ")
    logger.info(f"   配置文件路径: {LOADED_ENV_PATH or '系统环境变量'}")
    logger.info(f"   目标推送 ID: {ADMIN_CHAT_ID or '未配置(仅本地计算)'}")
    logger.info(f"   监听轮询周期: {CHECK_INTERVAL_SECONDS} 秒")
    logger.info("====================================================================")

    # 首次启动先执行一次全量同步与预测演算
    await run_persistent_cycle(force_calc=("--calc" in sys.argv or "--force" in sys.argv))

    if "--once" in sys.argv:
        logger.info("单次执行模式完成，已安全退出。")
        return

    # 每天晚上 22:00 定时自动拉取开奖并计算预测推送 (开奖时间约 21:33)
    while True:
        try:
            now = datetime.now()
            target_time = now.replace(hour=22, minute=0, second=0, microsecond=0)
            if now >= target_time:
                # 若今天 22:00 已过，则设定为明天 22:00
                from datetime import timedelta
                target_time += timedelta(days=1)
            
            wait_seconds = (target_time - now).total_seconds()
            logger.info(f"⏳ 守护进程已进入 22:00 定时休眠状态，距离下一次自动拉取开奖与计算还有 {int(wait_seconds)} 秒 ({target_time.strftime('%Y-%m-%d %H:%M:%S')})...")
            
            await asyncio.sleep(wait_seconds)
            logger.info("⏰ 北京时间 22:00 已到，开始自动拉取最新开奖记录并执行 10,000 轮蒙特卡洛数理计算...")
            await run_persistent_cycle(force_calc=True)
            
            # 执行完毕后稍微等待 61 秒避免在同一分钟重复触发
            await asyncio.sleep(61)
        except asyncio.CancelledError:
            logger.info("守护进程接收到退出信号，安全终止。")
            break
        except Exception as e:
            logger.error(f"持久循环发生异常: {e}", exc_info=True)
            await asyncio.sleep(300)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n已手动停止持久引擎。")
