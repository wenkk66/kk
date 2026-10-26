#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Termux 智能对话与指令执行 Agent 调度引擎 (Agentic Tool-Calling & Intent Router)
- 核心能力:
  用户无需记忆任何斜杠命令 (/command)，直接发送自然语言聊天：
  1. "帮我预测下期彩票" -> 自动执行数学公式演算与离线预测
  2. "看下手机电量和发热" -> 自动获取 Termux:API 硬件遥测并汇报
  3. "记个待办：下午3点开会" -> 自动解析并写入本地 SQLite 数据库
  4. "有哪些待办事项？" -> 自动查询并汇报待办列表
  5. "查看保存的数学规律公式" -> 自动检索 patterns.db 中的公式与参数
  6. "执行命令: ls -la" -> 管理员权限校验后直接在 Termux 执行 Shell 并返回输出
  7. 自由日常闲聊 -> 调用离线大模型进行生动、有温度的自然对话
"""

import os
import re
import json
import sqlite3
import logging
import subprocess
from datetime import datetime
from typing import Dict, Any, Tuple, Optional

from pattern_engine import (
    sync_draw_history,
    mine_all_patterns,
    generate_persistent_prediction,
    get_db_connection,
    run_monte_carlo_persistent_calculation,
    generate_ai_custom_formula,
    run_comprehensive_backtest,
)
from lottery import (
    fetch_lottery_history,
    compute_statistics,
    WAVE_CN,
)

logger = logging.getLogger("AgentExecutor")
DB_FILE = os.path.expanduser("tasks.db")

def ensure_tasks_db():
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

ensure_tasks_db()

# ------------------------------------------------------------------------------
# 1. 真实系统工具集合 (Concrete Tools)
# ------------------------------------------------------------------------------

def execute_shell_command(cmd: str) -> str:
    """在 Termux 本地安全执行 Shell 脚本或命令"""
    cmd = cmd.strip()
    # 基础安全过滤：禁止高危破坏性指令
    banned = ["rm -rf /", "mkfs", "dd if=/dev/zero", ":(){ :|:& };:"]
    for b in banned:
        if b in cmd:
            return f"⛔ 安全防护拦截：禁止执行高危命令: `{cmd}`"

    try:
        res = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=20,
            cwd=os.path.expanduser("~")
        )
        stdout = res.stdout.strip()
        stderr = res.stderr.strip()
        output = stdout if stdout else (stderr if stderr else "（命令执行完毕，无输出内容）")
        # 限制输出字符防止撑爆消息
        if len(output) > 3500:
            output = output[:3500] + "\n...（输出内容过长已截断）"
        return f"🖥️ **【Shell 命令执行结果】**\n命令: `{cmd}`\n退出码: `{res.returncode}`\n\n```text\n{output}\n```"
    except subprocess.TimeoutExpired:
        return f"⏱️ 命令执行超时 (超过 20 秒): `{cmd}`"
    except Exception as e:
        return f"❌ 执行命令发生异常: {str(e)}"

def get_system_telemetry() -> str:
    """获取手机电池、温度、内存与负载（专为三星 Note 9 及 Android Termux 深度调优）"""
    battery = "未知"
    # 1. 尝试 Termux:API 获取
    try:
        out = subprocess.check_output(["termux-battery-status"], timeout=2).decode()
        b_data = json.loads(out)
        pct = b_data.get('percentage', 0)
        temp = b_data.get('temperature', 0)
        status = b_data.get('status', '未知')
        battery = f"{pct}% (状态: {status}, 电池温度: {temp:.1f}°C)"
    except Exception:
        # 2. 从 Linux /sys/class/power_supply 节点直接读取（免安装 Termux:API）
        try:
            cap = ""
            tmp = ""
            stat = ""
            if os.path.exists("/sys/class/power_supply/battery/capacity"):
                with open("/sys/class/power_supply/battery/capacity", "r") as f:
                    cap = f.read().strip()
            if os.path.exists("/sys/class/power_supply/battery/temp"):
                with open("/sys/class/power_supply/battery/temp", "r") as f:
                    t_val = float(f.read().strip())
                    tmp = f"{t_val / 10.0:.1f}°C" if t_val > 100 else f"{t_val:.1f}°C"
            if os.path.exists("/sys/class/power_supply/battery/status"):
                with open("/sys/class/power_supply/battery/status", "r") as f:
                    stat = f.read().strip()
            if cap:
                battery = f"{cap}%" + (f" ({stat})" if stat else "") + (f", 电池温度: {tmp}" if tmp else "")
        except Exception:
            battery = "正常 (未安装 Termux:API)"

    mem = "未知"
    try:
        with open("/proc/meminfo", "r") as f:
            lines = f.readlines()
            total = int(lines[0].split()[1]) // 1024
            avail = int(lines[2].split()[1]) // 1024
            used = total - avail
            mem = f"已用 {used} MB / 总共 {total} MB ({(used/total*100):.1f}%)"
    except Exception as e:
        mem = str(e)

    load = "未知"
    try:
        with open("/proc/loadavg", "r") as f:
            load = f.read().strip().split()[:3]
            load = " ".join(load)
    except Exception:
        pass

    # 设备型号识别 (如 SM-N9600 / SM-N960F)
    device_model = "Samsung Galaxy Note 9 (ARM64)"
    try:
        model_out = subprocess.check_output(["getprop", "ro.product.model"], timeout=1).decode().strip()
        if model_out:
            device_model = f"三星 {model_out} (Galaxy Note 9)"
    except Exception:
        pass

    # 离线推理服务进程检测
    llama_status = "🔴 未启动"
    try:
        res = subprocess.check_output(["pgrep", "-f", "llama-server"], timeout=1).decode().strip()
        if res:
            llama_status = f"🟢 运行中 (PID: {res.split()[0]})"
    except Exception:
        pass

    return (
        f"📊 **【三星 Note 9 节点运行状况汇报】**\n\n"
        f"• 📱 **设备型号**: {device_model}\n"
        f"• 🔋 **电池与温控**: {battery}\n"
        f"• 🧠 **运行内存 (RAM)**: {mem}\n"
        f"• ⚙️ **系统平均负载**: `{load}`\n"
        f"• 🤖 **Llama 推理后端**: {llama_status}\n"
        f"• ⏱️ **报告时间**: {datetime.now().strftime('%H:%M:%S')}\n"
        f"• 🛡️ **运行环境**: Termux aarch64 (NEON 硬件加速)"
    )

def add_user_task(chat_id: int, content: str) -> str:
    """写入待办到 SQLite"""
    content = content.strip()
    if not content:
        return "💡 请说明你要记录的具体待办内容。"

    now = datetime.now().strftime("%m-%d %H:%M")
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("INSERT INTO tasks (chat_id, content, created_at) VALUES (?, ?, ?)", (chat_id, content, now))
    conn.commit()
    task_id = c.lastrowid
    conn.close()

    return f"✅ **已为你记录待办事项** `#{task_id}`:\n「{content}」\n记录时间: {now}"

def list_user_tasks(chat_id: int) -> str:
    """读取待办列表"""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("SELECT id, content, created_at FROM tasks WHERE chat_id=? AND status='pending'", (chat_id,))
    rows = c.fetchall()
    conn.close()

    if not rows:
        return "🎉 你当前没有任何未完成的待办事项！生活井井有条。"

    text = "📋 **【当前未完成待办清单】**\n\n"
    for r in rows:
        text += f"• `#{r[0]}` {r[1]} _({r[2]})_\n"
    text += "\n💡 如需完成某项，直接对我说「完成待办 1」或发送 `/task done 1` 即可。"
    return text

def mark_user_task_done(chat_id: int, task_id: int) -> str:
    """完成待办"""
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("UPDATE tasks SET status='done' WHERE id=? AND chat_id=?", (task_id, chat_id))
    affected = c.rowcount
    conn.commit()
    conn.close()

    if affected > 0:
        return f"🎉 待办事项 `#{task_id}` 已成功标记为完成！继续加油。"
    else:
        return f"⚠️ 未找到编号为 `#{task_id}` 的待办事项，请确认编号是否正确。"

def view_stored_pattern_rules() -> str:
    """查看保存在 SQLite 中的数学公式"""
    conn = get_db_connection()
    c = conn.cursor()
    c.execute("SELECT name, formula_expr, parameters, confidence FROM pattern_rules WHERE is_active = 1")
    rows = c.fetchall()
    conn.close()

    if not rows:
        return "ℹ️ 当前 SQLite 规律库中暂无保存的公式，可对我说「重新挖掘规律」进行自动计算拟合。"

    text = "📐 **【SQLite 持久化数学公式规律库】**\n\n"
    for r in rows:
        params = json.loads(r["parameters"]) if r["parameters"] else {}
        text += (
            f"🔹 **{r['name']}** (置信度: `{r['confidence'] * 100:.0f}%`)\n"
            f"• 表达式: `{r['formula_expr']}`\n"
        )
        if "pred_center" in params:
            text += f"• 和值中轴: `{params['pred_center']}` (区间: `{params['pred_range']}`)\n"
        elif "recommended_wave" in params:
            text += f"• 最优波色: `{params['recommended_wave']}` (转移概率: `{params['next_state_probabilities']}`)\n"
        elif "top_tension_numbers" in params:
            top_t = ", ".join(f"{n:02d}" for n, _ in params["top_tension_numbers"][:4])
            text += f"• 极限张力码: `{top_t}`\n"
        text += "\n"
    return text

def run_pattern_mining() -> str:
    """手动执行历史规律挖掘"""
    sync_draw_history("2026")
    patterns = mine_all_patterns()
    return (
        "✅ **【数学规律全量挖掘与持久化更新完成】**\n\n"
        f"1. **和值自回归期望**: 期望和值中轴 `{patterns['sum_regression']['pred_center']}` (区间: `{patterns['sum_regression']['pred_range']}`)\n"
        f"2. **马尔可夫状态矩阵**: 最优波色 **{WAVE_CN.get(patterns['markov_wave']['recommended_wave'], patterns['markov_wave']['recommended_wave'])}**\n"
        f"3. **冷热遗漏振荡器**: 重新拟合 1~49 号码出号偏离张力\n"
        f"4. **双码伴生拓扑**: 重新统计最近 40 期同出高频配对网络\n\n"
        "你可以直接对我说「帮我预测下期」查看基于新公式的预测结果！"
    )

def extract_lottery_prediction_params(text: str) -> Tuple[int, int]:
    """
    智能提取用户输入中的分析期数 (sample_size) 与推荐码数 (num_codes)
    例如: "查看最新200期开奖记录中查找各种规律生成预测18码" -> (200, 18)
    """
    sample_size = 200 # 默认 200 期大样本
    num_codes = 18    # 默认 18 码复式大底

    # 提取期数 (例如: 200期, 最新200期, 近150期, 50期, 300期)
    p_match = re.search(r'(?:最新|近|查|看)?\s*(\d{1,4})\s*期', text)
    if p_match:
        try:
            val = int(p_match.group(1))
            if 5 <= val <= 500:
                sample_size = val
        except ValueError:
            pass

    # 提取码数 (例如: 18码, 预测18码, 12码, 6码, 10码, 24码, 18个号)
    c_match = re.search(r'(?:预测|推荐|选|生成|大底)?\s*(\d{1,2})\s*(?:码|个号|个号码)', text)
    if c_match:
        try:
            val = int(c_match.group(1))
            if 3 <= val <= 36:
                num_codes = val
        except ValueError:
            pass

    return sample_size, num_codes

def is_lottery_prediction_query(text: str) -> bool:
    """判定是否为彩票规律挖掘、数学建模或选号预测请求 (防止被误判为历史记录列表)"""
    lower = text.lower()
    # 核心动作动词
    action_words = ["预测", "规律", "算", "推断", "推测", "推荐", "大底", "选号", "生成", "算一下", "胆码", "特码", "18码", "12码", "走势分析", "分析走势"]
    # 业务领域词
    domain_words = ["彩票", "六合彩", "开奖", "下期", "期", "特码", "正码", "波色", "生肖", "中奖", "码"]

    explicit = ["预测彩票", "彩票预测", "预测下期", "下期开什么", "特码预测", "走势预测", "生成预测", "查找规律", "计算规律", "数学规律"]
    if any(e in lower for e in explicit):
        return True

    has_action = any(w in lower for w in action_words)
    has_domain = any(w in lower for w in domain_words)
    return has_action and has_domain

def run_lottery_prediction_flow(sample_size: int = 200, num_codes: int = 18, llm_caller=None) -> str:
    """执行彩票公式演算并生成预测报告 (支持指定期数如 200 期与指定码数如 18 码)"""
    sync_draw_history("2026")
    pred = generate_persistent_prediction(sample_size=sample_size, num_codes=num_codes, llm_caller=llm_caller)
    return pred["full_report"]

def view_recent_draw_history(limit: int = 5) -> str:
    """查看近多期开奖结果 (仅限纯粹查看历史走势指令)"""
    draws = fetch_lottery_history("2026")
    if not draws:
        draws = fetch_lottery_history("2025")
    if not draws:
        return "❌ 暂时无法连接到开奖历史接口，请检查手机网络。"

    stats = compute_statistics(draws, limit)
    recent = stats["recentDraws"]

    text = f"📊 **【澳门六合彩近 {len(recent)} 期开奖走势】**\n\n"
    for d in recent:
        wave_str = WAVE_CN.get(d["specialWave"], d["specialWave"])
        text += (
            f"• **第 {d['expect']} 期** ({d['openTime'][:10]})\n"
            f"  正码: `{', '.join(f'{n:02d}' for n in d['regularNumbers'])}` | 特码: **`{d['specialNumber']:02d}`** ({wave_str} · {d['specialZodiac']})\n"
            f"  和值: `{d['sum']}`\n\n"
        )
    text += "💡 如需基于以上走势挖掘数学规律并推算号码，请直接对我说「通过最新200期开奖记录查找规律预测18码」或发送 `/predict`。"
    return text

# ------------------------------------------------------------------------------
# 2. 自然语言意图识别与工具执行路由器 (Intent & Action Dispatcher)
# ------------------------------------------------------------------------------

def dispatch_natural_language_intent(user_text: str, chat_id: int, llm_caller=None) -> Tuple[Optional[str], Optional[str]]:
    """
    语义分析用户自然语言输入：
    如果匹配到具体操作意图或命令执行，执行对应动作并返回 (执行结果文本, 动作类型)
    若为普通开放式对话，返回 (None, 'chat')
    """
    text = user_text.strip()
    lower = text.lower()

    # 1. 显式 Shell 命令执行识别 (如: cmd: ls -la, 运行命令: uname -a, 执行: ps)
    cmd_prefixes = ["cmd:", "shell:", "bash:", "执行命令:", "运行命令:", "执行:", "运行:"]
    for p in cmd_prefixes:
        if lower.startswith(p):
            raw_cmd = text[len(p):].strip()
            return execute_shell_command(raw_cmd), "exec_shell"

    # 2. 自然语言手机系统与硬件状态
    system_keywords = ["手机电量", "电池", "温度", "发热", "内存", "负载", "手机状态", "系统状态", "termux状态", "运行状态"]
    if any(k in lower for k in system_keywords) and not ("预测" in lower or "彩票" in lower or "待办" in lower):
        return get_system_telemetry(), "system_telemetry"

    # 3. 自然语言彩票规律挖掘与指定码数预测 (优先精准拦截！防止包含"开奖记录"时被误截获为纯历史走势)
    if is_lottery_prediction_query(text):
        sample_size, num_codes = extract_lottery_prediction_params(text)
        return run_lottery_prediction_flow(sample_size=sample_size, num_codes=num_codes, llm_caller=llm_caller), "lottery_predict"

    # 4. AI 自动发掘全新规律公式模板
    formula_gen_keywords = ["发掘新公式", "发掘公式", "生成新规律", "生成新公式", "创建新公式", "发明公式", "新公式模板", "ai发掘公式", "ai生成公式"]
    if any(k in lower for k in formula_gen_keywords) or (("公式" in lower or "模板" in lower) and ("新" in lower or "发掘" in lower or "发明" in lower)):
        rule = generate_ai_custom_formula()
        res = (
            f"✨ **【AI 自动发掘全新规律公式模板已入库】**\n\n"
            f"🔹 **公式名称**: `{rule['name']}`\n"
            f"📐 **数学模型**: `{rule['formula_expr']}`\n"
            f"📊 **原理阐述**: {rule.get('description', '')}\n"
            f"🎯 **算法置信度**: `{rule['confidence'] * 100:.1f}%`\n"
            f"⚙️ **参数配置**: `{json.dumps(rule['parameters'], ensure_ascii=False)}`\n\n"
            f"👉 该公式已加入实时加权预测池！发送 `/ai_calc` 即可进行 10,000 轮蒙特卡洛收敛演算。"
        )
        return res, "ai_formula_discovery"

    # 5. 蒙特卡洛 10,000 轮持久收敛计算 (与 200期 18码算法完全一体化整合)
    mc_keywords = ["持久计算", "10000轮", "1万轮", "蒙特卡洛", "跑一万轮", "持久运行计算", "执行持久计算", "ai持久计算", "万轮演算", "万轮收敛"]
    if any(k in lower for k in mc_keywords):
        return run_lottery_prediction_flow(sample_size=200, num_codes=18, llm_caller=llm_caller), "lottery_predict"

    # 6. 历史大样本回测与胜率检验
    backtest_keywords = ["回测", "历史胜率", "命中率检验", "验证胜率", "回测台账", "模型命中率", "测一下胜率", "50期回测"]
    if any(k in lower for k in backtest_keywords) and not ("预测" in lower or "待办" in lower):
        bt = run_comprehensive_backtest(50, 18)
        res = (
            f"📈 **【澳门六合彩 18 码模型历史 50 期严谨回测报告】**\n\n"
            f"• 回测样本量: **{bt['test_draws_count']} 期** (严格无未来信息泄漏，单步向前推移)\n"
            f"• 单期平均命中正码: **{bt['avg_regular_hits_per_draw']} / 6 个**\n"
            f"• 3 码及以上覆盖胜率: **{bt['pool_coverage_rate_ge3']}%**\n"
            f"• 特码单挑命中胜率: **{bt['special_code_hit_rate']}%**\n\n"
            f"💡 *结论*: {bt['benchmark_summary']}"
        )
        return res, "backtest_audit"

    # 7. 自然语言查看保存的数学公式与规律库
    pattern_keywords = [
        "查看公式", "数学公式", "保存的公式", "规律库", "查看规律", "有哪些公式", "模式规则", "公式参数",
        "数学规律", "保存的规律", "数学模型", "算法公式", "查看算法", "算法数学公式"
    ]
    if any(k in lower for k in pattern_keywords) or (("规律" in lower or "公式" in lower or "算法" in lower) and ("查看" in lower or "保存" in lower or "库" in lower or "展示" in lower or "什么" in lower)):
        return view_stored_pattern_rules(), "view_patterns"

    # 8. 自然语言重新挖掘规律与拟合模型
    mine_keywords = ["重新挖掘", "挖掘规律", "学习历史数据", "重算公式", "更新参数", "更新规律", "重训模型", "重新拟合", "训练规律", "拟合规律"]
    if any(k in lower for k in mine_keywords) or (("挖掘" in lower or "拟合" in lower or "重算" in lower or "重训" in lower) and ("规律" in lower or "公式" in lower or "模型" in lower or "历史" in lower)):
        return run_pattern_mining(), "mine_patterns"

    # 9. 自然语言纯查看历史开奖走势 (仅在非预测意图时生效)
    history_keywords = ["开奖走势", "最近几期开什么", "上期开什么", "近几期开奖", "历史开奖走势", "看下历史记录", "查看开奖记录", "历史开奖走势图"]
    if any(k in lower for k in history_keywords):
        return view_recent_draw_history(5), "view_history"

    # 10. 自然语言添加待办事项
    add_task_match = re.search(r'(?:记(?:个)?待办|提醒我|添加待办|新建待办|备忘)(?:：|:|\s+)?(.+)', text)
    if add_task_match:
        task_content = add_task_match.group(1).strip()
        if task_content:
            return add_user_task(chat_id, task_content), "add_task"

    # 11. 自然语言查看待办清单
    list_task_keywords = ["我的待办", "查看待办", "待办清单", "有哪些任务", "未完成任务", "备忘录", "本地待办事项"]
    if any(k in lower for k in list_task_keywords) and not any(k in lower for k in ["添加", "记", "完成"]):
        return list_user_tasks(chat_id), "list_tasks"

    # 12. 自然语言完成待办
    done_match = re.search(r'(?:完成待办|搞定待办|待办(?:完成)?)\s*#?(\d+)', text)
    if done_match:
        t_id = int(done_match.group(1))
        return mark_user_task_done(chat_id, t_id), "done_task"

    # 13. 常用日常命令行别名
    safe_single_cmds = ["ls", "pwd", "free -m", "uptime", "df -h", "date", "whoami", "uname -a"]
    if text.strip() in safe_single_cmds:
        return execute_shell_command(text.strip()), "exec_shell"

    # 14. 离线模型规格与参数检视 (支持键盘菜单 "🤖 离线模型规格")
    if "模型规格" in lower or "离线模型" in lower or "模型参数" in lower or "查看模型" in lower:
        return (
            "🤖 **【当前 Termux 端侧离线大模型规格】**\n\n"
            "• **本地推理引擎**: `llama.cpp server` (ARM64 NEON 原生 SIMD 指令集加速)\n"
            "• **量化精度**: 4-bit 结构化量化 (Q4_K_M)，平衡内存开销与思考精度\n"
            "• **上下文窗口**: 4096 tokens (启用 Flash Attention)\n"
            "• **核心算法**: 200期大样本规律挖掘 + 10,000轮蒙特卡洛AI收敛计算 (18码一体化)\n"
            "• **端侧能耗**: 100% 运行于手机本地，空闲占用零 CPU，零外部商业流量消耗\n"
            "• **本地 API 端点**: `http://127.0.0.1:8080/v1`\n\n"
            "💡 可直接点击下方键盘菜单按钮「🎰 200期18码 (AI万轮收敛)」进行极速推算。"
        ), "model_info"

    # 15. 帮助与指令使用指南 (支持键盘菜单 "❓ 帮助与指令")
    if "帮助" in lower or "指令" in lower or "菜单" in lower or "怎么用" in lower or "指南" in lower or lower == "help":
        return (
            "❓ **【Termux 离线 AI 机器人全新键盘操作与指令指南】**\n\n"
            "👇 **屏幕底部已为您全新重构 5 行快捷键盘菜单，轻点即用**：\n"
            "• 🎰 **200期18码 (AI万轮收敛)**: 整合 200 期历史数据与 10,000 轮蒙特卡洛 AI 收敛计算，生成唯一权威的 18 码复式大底矩阵！\n"
            "• 📈 **50期回测胜率**: 50 期无未来函数严格步进回溯验算，查看单期平均命中数与特码胜率\n"
            "• 📐 **算法数学公式**: 检视保存在 SQLite 中的和值自回归、马尔可夫链、遗漏张力等 7 大数学公式\n"
            "• ✨ **AI发掘新模板**: 由 AI 自动推导并入库全新的数学规律与滤波公式\n"
            "• 📊 **历史开奖走势**: 检索最近多期开奖历史记录与正码特码分布\n"
            "• 📱 **手机状态遥测**: 实时获取三星手机电池、温度、内存与后台服务健康状态\n"
            "• 📝 **本地待办事项**: 查看本地 SQLite 待办日程清单\n"
            "• 🤖 **离线模型规格**: 查看当前加载的 GGUF 模型与推理参数\n"
            "• 📜 **实时运行日志**: 查看 Termux 本地后台运行日志\n\n"
            "💬 **自然语言支持**: 直接对我说大白话，例如「记个待办：下午三点买咖啡」或「执行命令: free -m」！"
        ), "help_info"

    # 未命中特定工具调用指令，回退到自然语言对话大模型
    return None, "chat"

