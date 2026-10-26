#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Termux 彩票历史数据获取与 AI 预测分析模块 (纯标准库零外部依赖)
- 数据源: https://history.macaumarksix.com/history/macaujc2/y/2026
- 功能:
  1. 自动拉取澳门六合彩历史开奖数据 (urllib.request 原生支持)
  2. 数理统计：冷热号码、大小单双比例、三色波分布、生肖出现频次、特码走势
  3. 组装专业数理特征并调用本地大模型生成下期概率推测报告
"""

import sys
import json
import ssl
import logging
from typing import List, Dict, Any, Optional
from collections import Counter
import urllib.request
import urllib.error

logger = logging.getLogger("LotteryAnalyzer")

API_URL_TEMPLATE = "https://history.macaumarksix.com/history/macaujc2/y/{year}"

# 波色中文映射
WAVE_CN = {
    "red": "红波 🔴",
    "blue": "蓝波 🔵",
    "green": "绿波 🟢",
}

def fetch_lottery_history(year: str = "2026", timeout: float = 15.0) -> List[Dict[str, Any]]:
    """从官方接口获取指定年份的开奖历史"""
    url = API_URL_TEMPLATE.format(year=year)
    headers = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 13; Termux) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Accept": "application/json, text/plain, */*",
    }

    req = urllib.request.Request(url, headers=headers)
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as response:
            if response.status == 200:
                body = response.read().decode("utf-8", errors="ignore")
                data = json.loads(body)
                if data.get("result") and "data" in data and isinstance(data["data"], list):
                    return data["data"]
                else:
                    logger.warning(f"接口返回非标准结构: {data.get('message')}")
                    return []
            else:
                logger.error(f"HTTP 状态码异常: {response.status}")
                return []
    except Exception as e:
        logger.error(f"拉取彩票历史数据失败: {e}")
        return []

def fetch_deep_lottery_history(years: Optional[List[str]] = None, timeout: float = 12.0) -> List[Dict[str, Any]]:
    """从官方接口深度抓取多年度全量历史开奖数据 (2026, 2025, 2024 等) 并去重合并"""
    if years is None:
        years = ["2026", "2025", "2024"]

    all_records = []
    seen_expects = set()

    for y in years:
        draws = fetch_lottery_history(year=y, timeout=timeout)
        if draws:
            for d in draws:
                exp = d.get("expect")
                if exp and exp not in seen_expects:
                    seen_expects.add(exp)
                    all_records.append(d)

    # 保证按期数从新到旧降序排序
    all_records.sort(key=lambda x: str(x.get("expect", "")), reverse=True)
    return all_records

def parse_draw(item: Dict[str, Any]) -> Dict[str, Any]:
    """解析单期开奖记录"""
    expect = item.get("expect", "")
    open_time = item.get("openTime", "")
    open_code_raw = item.get("openCode", "")
    wave_raw = item.get("wave", "")
    zodiac_raw = item.get("zodiac", "")

    numbers = [int(n.strip()) for n in open_code_raw.split(",") if n.strip().isdigit()]
    waves = [w.strip() for w in wave_raw.split(",") if w.strip()]
    zodiacs = [z.strip() for z in zodiac_raw.split(",") if z.strip()]

    # 澳门六合彩通常前 6 个为平码，第 7 个为特码
    regular_nums = numbers[:6] if len(numbers) >= 6 else numbers
    special_num = numbers[6] if len(numbers) >= 7 else (numbers[-1] if numbers else 0)
    special_wave = waves[6] if len(waves) >= 7 else (waves[-1] if waves else "unknown")
    special_zodiac = zodiacs[6] if len(zodiacs) >= 7 else (zodiacs[-1] if zodiacs else "unknown")

    return {
        "expect": expect,
        "openTime": open_time,
        "numbers": numbers,
        "regularNumbers": regular_nums,
        "specialNumber": special_num,
        "waves": waves,
        "specialWave": special_wave,
        "zodiacs": zodiacs,
        "specialZodiac": special_zodiac,
        "sum": sum(numbers),
        "openCodeStr": open_code_raw,
    }

def compute_statistics(draws: List[Dict[str, Any]], sample_size: int = 30) -> Dict[str, Any]:
    """对最近 N 期开奖记录进行多维数理特征计算"""
    parsed = [parse_draw(d) for d in draws[:sample_size]]
    if not parsed:
        return {}

    all_numbers = []
    special_numbers = []
    special_waves = []
    special_zodiacs = []
    sums = []
    odd_count = 0
    even_count = 0
    big_count = 0   # 25-49 为大
    small_count = 0 # 01-24 为小

    for p in parsed:
        all_numbers.extend(p["numbers"])
        special_numbers.append(p["specialNumber"])
        special_waves.append(p["specialWave"])
        special_zodiacs.append(p["specialZodiac"])
        sums.append(p["sum"])

        for n in p["numbers"]:
            if n % 2 == 1:
                odd_count += 1
            else:
                even_count += 1

            if n >= 25:
                big_count += 1
            else:
                small_count += 1

    num_counter = Counter(all_numbers)
    special_counter = Counter(special_numbers)
    wave_counter = Counter(special_waves)
    zodiac_counter = Counter(special_zodiacs)

    appeared_nums = set(all_numbers)
    missing_nums = [n for n in range(1, 50) if n not in appeared_nums]

    latest_draw = parsed[0]

    return {
        "sampleSize": len(parsed),
        "latestDraw": latest_draw,
        "recentDraws": parsed[:10],
        "hotNumbers": num_counter.most_common(8),
        "coldNumbers": num_counter.most_common()[:-9:-1],
        "missingNumbers": missing_nums[:6],
        "hotSpecialNumbers": special_counter.most_common(5),
        "specialWaveDistribution": dict(wave_counter),
        "specialZodiacDistribution": dict(zodiac_counter.most_common(6)),
        "oddEvenRatio": f"{odd_count}:{even_count}",
        "bigSmallRatio": f"{big_count}:{small_count}",
        "avgSum": round(sum(sums) / len(sums), 1) if sums else 0,
        "minSum": min(sums) if sums else 0,
        "maxSum": max(sums) if sums else 0,
    }

def format_draw_summary(draw: Dict[str, Any]) -> str:
    """美化单期开奖结果为 Telegram 排版"""
    nums_str = ", ".join(f"{n:02d}" for n in draw["regularNumbers"])
    special_str = f"{draw['specialNumber']:02d}"
    wave_str = WAVE_CN.get(draw["specialWave"], draw["specialWave"])

    return (
        f"📅 **第 {draw['expect']} 期** ({draw['openTime']})\n"
        f"• 正码: `{nums_str}`\n"
        f"• 特码: **`{special_str}`** ({wave_str} · 生肖: {draw['specialZodiac']})\n"
        f"• 和值: `{draw['sum']}`"
    )

def build_prediction_prompt(stats: Dict[str, Any]) -> str:
    """构建给离线大语言模型的数理推断 Prompt"""
    latest = stats["latestDraw"]
    recent = stats["recentDraws"]

    recent_table = "\n".join([
        f"- 第{d['expect']}期: 开奖号码 {d['openCodeStr']} | 特码:{d['specialNumber']:02d} ({d['specialWave']}, {d['specialZodiac']}) | 和值:{d['sum']}"
        for d in recent[:7]
    ])

    hot_str = ", ".join([f"{num:02d}({cnt}次)" for num, cnt in stats["hotNumbers"]])
    cold_str = ", ".join([f"{num:02d}({cnt}次)" for num, cnt in stats["coldNumbers"]])
    wave_dist = ", ".join([f"{WAVE_CN.get(k, k)}:{v}次" for k, v in stats["specialWaveDistribution"].items()])
    zodiac_dist = ", ".join([f"{k}:{v}次" for k, v in stats["specialZodiacDistribution"].items()])

    prompt = f"""
你是一位资深的概率统计分析与彩票走势规律研究专家。
基于刚刚从官方接口拉取的澳门六合彩（Macau Mark Six）最新历史开奖数据，请执行深度数理统计建模与下期趋势推测。

【最新一期开奖详情】
- 开奖期数: 第 {latest['expect']} 期
- 开奖时间: {latest['openTime']}
- 正码前六位: {", ".join(f"{n:02d}" for n in latest['regularNumbers'])}
- 特码: {latest['specialNumber']:02d} (波色: {latest['specialWave']}, 生肖: {latest['specialZodiac']})
- 本期和值: {latest['sum']}

【近 {stats['sampleSize']} 期核心数理统计指标】
1. 号码冷热分布：
   - 高频热号: {hot_str}
   - 极冷号码: {cold_str}
2. 基础形态特征：
   - 全体单双比: {stats['oddEvenRatio']}
   - 大小号比例 (≥25为大): {stats['bigSmallRatio']}
   - 和值平均值: {stats['avgSum']} (极值范围: {stats['minSum']} ~ {stats['maxSum']})
3. 特码走势特征：
   - 特码波色频次: {wave_dist}
   - 特码生肖分布: {zodiac_dist}

【最近 7 期走势回溯】
{recent_table}

【分析与预测任务要求】
请按照以下清晰结构撰写分析预测报告（适合 Telegram 格式排版）：
1. 📊 **【近期走势特征复盘】**：分析和值走势倾向、单双大小回补趋势以及连号/重号规律。
2. 🎯 **【核心波色与生肖推测】**：
   - 下期特码优势波色（红波/蓝波/绿波分析与理由）
   - 下期推荐关注生肖（结合近期冷热生肖与周期循环）
3. 🔢 **【号码概率矩阵预测】**：
   - 重点精选胆码推荐（3~4 个高概率核心号码）
   - 推荐正码大底候选池（精选 8~10 码）
   - 特码重点单选推荐（3~5 个重点号码）
4. 💡 **【2组精选推荐组合方案】**：给出两组（6正码+1特码）的推荐组合供参考。
5. ⚠️ **【数理概率学理性警示】**：明确声明彩票每一期均为独立随机事件，分析仅供数理统计研究与娱乐交流，严禁沉迷。
"""
    return prompt.strip()

if __name__ == "__main__":
    print("正在拉取澳门六合彩历史开奖数据...")
    draws = fetch_lottery_history("2026")
    if not draws:
        draws = fetch_lottery_history("2025")

    if draws:
        stats = compute_statistics(draws, 30)
        print(f"成功获取 {len(draws)} 期数据！")
        print("\n" + format_draw_summary(stats["latestDraw"]))
        print("\n热号:", [n for n, c in stats["hotNumbers"]])
        print("特码波色分布:", stats["specialWaveDistribution"])
        print("\n生成的 AI 分析 Prompt 长度:", len(build_prediction_prompt(stats)))
    else:
        print("未能获取到数据，请检查网络连接。")
