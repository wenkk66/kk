# Termux 离线大语言模型 + Telegram Bot 智能化运维与内容生成系统

> 📱 **把闲置或日常安卓手机改造成 24 小时随身专属的离线 AI 智能管家！**  
> 运行在 Android Termux 终端环境中，基于原生编译的 `llama.cpp` ARM64 NEON 指令集加速，常驻 4-bit 离线量化大模型（Qwen 2.5 / DeepSeek-R1 / SmolLM2），通过 Telegram Bot 实现安全私密对话、自动化内容创作（早报/文案/代码）、待办日程管理与定时推送。

---

## 🌟 核心特性与优势

- **100% 纯离线运行与隐私安全**：大模型权重常驻在手机本地内存中，所有推理与文字生成完全在手机芯片上执行，零云端调用、零 API 账单、无数据泄露风险。
- **针对手机 ARM64 深度优化**：使用 C/C++ 原生编译 `llama.cpp`，启用 ARM NEON SIMD 向量加速，骁龙主流芯片可跑出 20~40 tokens/s 的流畅生成速度。
- **纯 Python 3.10+ 异步处理与极简依赖**：零 Go 编译器依赖，基于官方 `python-telegram-bot` 异步长轮询与事件循环，高并发、内存占用小、发热量低。
- **丰富的智能化管理与运维功能**：
  - 📝 `/write <主题>`：全自动长文撰写、行业早报生成、自媒体爆款文案裂变、Shell 自动化脚本生成。
  - 📑 `/summarize <长文本>`：智能提炼核心观点，自动归纳行动事项与关键结论。
  - 📋 `/task add/list/done`：本地嵌入式 SQLite 数据库，安全记录待办日程与备忘事项。
  - 📊 `/status`：结合 `termux-api` 实时监控手机电池电量、发热温度、RAM 内存负载与系统平均负载。
  - 🎰 `/predict` & `/patterns`：澳门六合彩历史走势自动同步、和值回归与马尔可夫数学模型、SQLite 规则持久化与下期推断。
  - 🖥️ `/cmd <Shell命令>`：管理员远程在 Telegram 执行手机 Termux Shell 指令（如 `free -m`、`df -h`）并即时回显输出。
  - 📜 `/logs [行数]`：实时检视手机本地各组件运行与推理日志。
  - 💬 **自然语言 Agent 调度**：无需记忆指令，直接输入「看下手机电量和发热」「记个待办」「帮我预测这期」等大白话自动调度工具。
- **后台常驻与开机自启**：配备 `termux-wake-lock` 防休眠机制与 `Termux:Boot` 开机无感自启，配合 Linux Cron 实现每日定时自动推送。

---

## 🏗️ 系统架构图

```
┌────────────────────────────────────────────────────────┐
│                   Telegram App (用户端)                 │
└───────────────────────────▲────────────────────────────┘
                            │ HTTPS (Long Polling / Webhook)
┌───────────────────────────▼────────────────────────────┐
│              Android Termux 运行环境 (aarch64)           │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  bot.py (Python 3.10+ 异步 Telegram 守护进程)    │  │
│  │  • 指令路由 (/write, /summarize, /task, /status) │  │
│  │  • SQLite 数据库持久化 (tasks.db)                 │  │
│  │  • 消息长文本分段与安全排版                      │  │
│  └──────────────────────────▲───────────────────────┘  │
│                             │ HTTP POST /v1/chat/completions
│  ┌──────────────────────────▼───────────────────────┐  │
│  │  llama-server (C++ 原生编译, 端口 8080)          │  │
│  │  • ARMv8.2 NEON SIMD 指令集加速                  │  │
│  │  • GGUF 4-bit 量化引擎 (Q4_K_M)                  │  │
│  └──────────────────────────▲───────────────────────┘  │
│                             │ 内存映射 (mmap)          │
│  ┌──────────────────────────▼───────────────────────┐  │
│  │  本地 GGUF 模型 (models/qwen2.5-1.5b-instruct...) │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  • 守护层: termux-wake-lock + crond + Termux:Boot       │
└────────────────────────────────────────────────────────┘
```

---

## 📱 手机硬件配置与推荐模型选型

| 手机物理内存 (RAM) | 推荐模型规模 | 推荐模型文件名 | 模型体积 | 预估生成速度 (骁龙8系) | 适用场景 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **3 GB ~ 4 GB** (备用机) | 0.5B 极轻量 | `qwen2.5-0.5b-instruct-q4_k_m.gguf` | 0.38 GB | 40 ~ 65 tok/s | 基础指令响应、极低发热、省电 |
| **6 GB ~ 8 GB** (主流机) | **1.5B ~ 1.7B (推荐)** | `qwen2.5-1.5b-instruct-q4_k_m.gguf` | 0.98 GB | 22 ~ 38 tok/s | **黄金甜点！** 中文极佳、排版优雅、常驻稳定 |
| **6 GB ~ 8 GB** (逻辑推理) | 1.5B 强化推理 | `deepseek-r1-distill-qwen-1.5b-q4_k_m.gguf` | 1.02 GB | 20 ~ 34 tok/s | 思维链推理、数学逻辑、深度分析 |
| **6 GB ~ 8 GB** (英文优先) | 1.7B 高效率 | `smollm2-1.7b-instruct-q4_k_m.gguf` | 1.06 GB | 25 ~ 42 tok/s | 英文能力优异、工具调度、代码辅助 |
| **12 GB ~ 16 GB** (高配旗舰) | 3.0B 深度创作 | `qwen2.5-3b-instruct-q4_k_m.gguf` | 1.93 GB | 12 ~ 20 tok/s | 长篇小说文案、深度行业研报、复杂逻辑 |

---

## 🛠️ 第一步：前置准备工作

### 1. 下载并安装必要安卓软件
强烈建议从 **[F-Droid](https://f-droid.org/)** 下载安装官方构建版（**切勿**使用应用商店过时的旧版，否则会导致源无法更新）：
1. **[Termux (F-Droid 下载)](https://f-droid.org/packages/com.termux/)**：核心 Linux 终端模拟器环境。
2. **[Termux:API (F-Droid 下载)](https://f-droid.org/packages/com.termux.api/)**：用于读取手机电量、温控与硬件状态。
3. **[Termux:Boot (可选，F-Droid 下载)](https://f-droid.org/packages/com.termux.boot/)**：用于手机开机/重启自动后台启动服务。

### 2. 创建 Telegram 机器人
1. 打开 Telegram，在搜索栏搜索官方机器人管理器 **[@BotFather](https://t.me/BotFather)**。
2. 发送 `/newbot`，根据提示设置机器人的显示名称和用户名（需以 `bot` 结尾）。
3. 成功后，BotFather 会给你一段类似如下格式的 **HTTP API Token**（妥善保存）：
   ```text
   7123456789:AAHq_mF7Jv9KL0mnPqRsTuVwXyZ12345678
   ```

### 3. 获取自己的 Telegram Chat ID
1. 在 Telegram 搜索并向 **[@userinfobot](https://t.me/userinfobot)** 发送任意消息。
2. 机器人会返回你的数字 ID（例如 `987654321`），用于配置机器人管理员鉴权，防止陌生人滥用。

---

## 📱 三星 Galaxy Note 9 极简 2 行配置专区（Termux 根目录 `~/.env`）

如果您使用的是 **三星 Galaxy Note 9**（或任意安卓手机），本项目已完成全自动化硬件识别与参数自适应。**您无需在项目目录修改复杂配置，直接在 Termux 根目录创建仅有 2 行的 `~/.env` 即可！**

### 1. 在 Termux 终端中直接粘贴执行以下两行生成命令：
```bash
cat << 'EOF' > ~/.env
BOT_TOKEN="你的Telegram机器人Token"
BOT_ID="你的Telegram数字ID"
EOF
```
*(例如：`BOT_TOKEN="7123456789:AAHq_mF7Jv9..."` 和 `BOT_ID="987654321"`)*

### 2. 为什么只需配置这两行？
- **多级智能寻径**：系统启动时会自动按照 `../.env`（即 Termux 根目录 `~/.env`）→ `~/.env` → `./.env` 的顺序自动读取配置。
- **Note 9 核心自适应**：系统检测到三星 Note 9 的 8 核架构（骁龙 845 / 猎户座 9810）后，会自动分配 **4 个高性能大核 (-t 4)**，不跑小核，彻底避免多线程等待卡顿与发热降频。
- **内存安全裕量**：Note 9 配备 6GB/8GB 物理内存，系统自动默认装载 **Qwen 2.5 1.5B Instruct** 模型（仅消耗 ~1.1GB RAM），剩余可用内存超 2.0GB，**100% 免疫系统杀后台 (LMK)**。
- **内置安全白名单**：只要配置了 `BOT_ID`，系统自动锁定管理员特权，陌生人无法调用你的手机终端或触发推理。

---

## 🚀 第二步：在 Termux 中拉取并部署运行

打开手机上的 **Termux** 应用，按顺序执行以下步骤：

### 1. 配置根目录凭证 (如已在上方创建过可跳过)
```bash
cat << 'EOF' > ~/.env
BOT_TOKEN="你的Telegram机器人Token"
BOT_ID="你的Telegram数字ID"
EOF
```

### 2. 克隆代码仓库并进入目录
```bash
# 进入 Termux 用户根目录
cd ~

# 克隆本项目仓库 (将 YOUR_USERNAME 替换为你的 GitHub 仓库地址)
git clone https://github.com/YOUR_USERNAME/termux-telegram-ai-bot.git

# 进入项目文件夹
cd termux-telegram-ai-bot
```

### 3. 执行一键环境依赖安装
此脚本会自动申请安卓后台 CPU 唤醒锁、更新 Termux 源、安装编译工具链（clang/cmake/ninja/python）以及 Python 异步依赖库：
```bash
bash install.sh
```
> 💡 *提示：执行过程中如果手机弹出「请求存储访问权限」对话框，请点击【允许】。*

### 4. 编译推理引擎并下载离线大模型
运行模型选型脚本，它将针对你的手机 ARM64 处理器自动完成 `llama-server` 编译，并提供交互式菜单让你选择下载模型（支持断点续传）：
```bash
bash setup_model.sh
```
输入对应数字选择想要下载的模型（三星 Note 9 强烈推荐直接按回车选择 **[1] Qwen 2.5 1.5B**）。

### 5. 一键启动服务
```bash
bash start.sh
```
此命令将：
1. 自动定位读取 Termux 根目录的 `~/.env`；
2. 锁定 Note 9 的 4 个大核并在后台拉起 `llama-server` 加载模型；
3. 自动在后台启动 `persistent_engine.py` 持久规律计算与自动发帖守护进程；
4. 启动 `bot.py` 开启 Telegram 双向自然语言长轮询。

现在打开 Telegram，向你的 Bot 发送任意消息（如：“`你好`”、“`帮我预测下期彩票`”、“`手机电量怎么样`”），机器人即可秒级响应！🎉

---

## 🌐 Telegram Bot 运行模式：Long Polling (长轮询) vs Webhook (反向推送)

系统默认采用 **Long Polling (长轮询)** 模式，即手机端 Python 程序主动向 Telegram 服务器请求更新。该模式**不需要公网 IP、不需要域名、不需要配置 SSL 证书**，在手机移动网络、随身 Wi-Fi、热点下开箱即用，是手机端 Termux 运行最稳妥的方案。

如果您希望使用 **Webhook 模式**（由 Telegram 官方服务器主动将用户消息 HTTPS POST 推送到手机端，响应更敏捷、省去频繁长轮询请求），请按照以下指南配置：

### ⚠️ Telegram 官方对 Webhook 的硬性要求：
1. **必须具备公网可访问的 HTTPS 协议**（HTTP 协议不被 Telegram 接受）；
2. **必须具备合法的 SSL/TLS 证书**（自签名证书需上传 pem，公网证书更便捷）；
3. **端口受限**：Telegram Webhook 仅支持 `443`、`80`、`88`、`8443` 四个端口。本项目在手机端默认监听端口为 **`8443`**。

---

### 🚀 方案一：使用 Cloudflare Tunnel 极速免公网 IP 启动 Webhook (最推荐，完全免费)

无需购买服务器或申请公网 IP，直接利用 Cloudflare 官方提供的免费安全穿透隧道：

1. **在 Termux 中运行 Webhook 配置向导**：
   ```bash
   bash setup_webhook.sh
   ```
2. **在交互菜单中输入 `3`**（一键启动 Cloudflare Tunnel）：
   - 脚本会自动检测并安装 `cloudflared`（ARM64 原生）；
   - 自动拉起安全隧道映射手机本地 `http://127.0.0.1:8443`；
   - 终端会输出形如 `https://random-words.trycloudflare.com` 的临时公网 HTTPS 地址。
3. **将该域名填入 `.env`**：
   ```ini
   WEBHOOK_URL="https://random-words.trycloudflare.com"
   WEBHOOK_PORT="8443"
   ```
4. **启动 Bot**：
   ```bash
   bash start.sh
   ```
   Bot 启动时检测到 `WEBHOOK_URL`，会自动调用 Telegram `setWebhook` API 完成注册，并启动内置 aiohttp/tornado 异步 Web 服务器监听接收更新！

---

### 🌐 方案二：已有公网 VPS 或独立域名反向代理

如果您拥有公网云服务器（如配置了 Nginx/Caddy）或使用了 FRP / Tailscale / Ngrok：

1. 在服务器或内网穿透中，将公网 `https://yourdomain.com/webhook` 转发至手机 Termux 的 `http://127.0.0.1:8443`；
2. 在 `~/.env` 中添加配置：
   ```ini
   WEBHOOK_URL="https://yourdomain.com/webhook"
   WEBHOOK_PORT="8443"
   WEBHOOK_SECRET="自定义安全密钥" # 可选，增加请求鉴权防伪造
   ```
3. 执行 `bash start.sh` 即可进入 Webhook 模式。

---

### 🔄 方案三：一键切回 Long Polling 长轮询模式

当在外出移动网络没有内网穿透时，您可以随时一键切回长轮询：
```bash
bash setup_webhook.sh
# 输入 2，即可自动调用 Telegram deleteWebhook API 并注销远程地址
bash start.sh
```
或者直接在终端执行：
```bash
curl -s "https://api.telegram.org/bot<你的BOT_TOKEN>/deleteWebhook?drop_pending_updates=true"
```
并在 `.env` 中注释掉 `WEBHOOK_URL` 即可。

💡 **提示**：在 Telegram 聊天框中，管理员可随时向机器人发送 `/webhook`，机器人会实时返回当前的 Webhook 注册状态、待投递消息数及最新报错信息。

---

## 🕹️ 常用运维指令速查

| 操作目的 | 执行命令 | 说明 |
| :--- | :--- | :--- |
| **启动所有服务** | `bash start.sh` | 自动检查并启动后台模型与前台 Bot (自动识别 Polling/Webhook) |
| **配置与管理 Webhook** | `bash setup_webhook.sh` | 交互式管理 Webhook 注册、Cloudflare Tunnel 穿透与清除 |
| **查看运行状态** | `bash status.sh` | 显示 PID、8080/8443 端口可用性、内存负载与电池温度 |
| **停止所有服务** | `bash stop.sh` | 安全终止 Python Bot 与释放模型常驻内存 |
| **查看实时日志** | `tail -f logs/bot.log` | 实时查看 Telegram 交互调用日志与报错 |
| **查看推理日志** | `tail -f logs/llama_server.log` | 查看 llama.cpp 的生成延迟与 Token 速率 |

---

## 💬 Telegram Bot 指令与功能详解

在 Telegram 对话中，你可以向机器人发送以下指令：

- **`/start` 或 `/help`**：显示欢迎界面、当前运行模型名称及指令菜单。
- **`/ai_calc`**：🔥 **10,000 轮蒙特卡洛矩阵持久收敛计算**。
  - 自动运行 10,000 轮高斯扰动与权重轮盘赌抽取，计算收敛置信度（达到 95%+）。
  - 输出 18 码核心精选大底、黄金三胆（Top 3）及 2 组实战对冲方案（组合 A 冷热对冲、组合 B 波动回归）。
- **`/formula` 或 `/formula new`**：📐 **AI 规律公式库与算法发掘**。
  - `/formula`：检视当前已启用的数学公式、表达式、参数与置信度。
  - `/formula new`：命令 AI 根据历史数据自动发掘并推导全新的规律模板并存入 SQLite。
- **`/backtest [期数]`**：📈 **历史大样本多步步进回测台账**。
  - 示例：`/backtest 50`（对最近 50 期进行步进回测，输出平均命中数与特码命中率）。
- **`/predict` 或 `/lottery`**：彩票开奖历史获取与 AI 深度预测分析。
  - 自动调用官方历史接口拉取最新 200 期数据，由离线大模型结合数学特征进行研判。
- **`/lottery_chart [数量]`**：以排版整齐的列表形式查看最近 5~15 期的开奖号码、特码波色及和值走势。
- **`/write <主题>`**：调用端侧大模型自动化生成内容。
  - 示例：`/write 撰写一份关于端侧AI与开源硬件自动化发展的科技晚报`
  - 示例：`/write 编写一篇把闲置手机改装为离线AI服务器的小红书爆款文案`
  - 示例：`/write 编写一个利用 curl 监控网络延迟并在断网时蜂鸣报警的 Bash 脚本`
- **`/summarize <文本>`**：结构化提炼长文、会议记录或文章笔记。
  - 示例：`/summarize [粘贴你的一大段会议记录或长文章]`
- **`/task add <事项>`**：将待办任务自动存入本地 SQLite 数据库。
  - 示例：`/task add 今晚9点检查 Termux 手机电池温度`
- **`/task list`**：查看当前所有尚未完成的待办清单。
- **`/task done <ID>`**：标记对应编号的事项为已完成（如 `/task done 1`）。
- **`/status`**：实时获取手机当前电量、发热温度、物理内存使用率与系统平均负载。
- **`/model`**：查看当前活跃模型的参数、采样温度及最大 Token 限制。

---

## 🗣️ 自然语言多轮对话与命令自主执行 (Natural Language Autonomous Agent)

**告别死板的斜杠命令！** 本项目内置基于端侧大模型的自然语言意图理解引擎（`agent_executor.py`）。你无需输入 `/predict` 或 `/task` 等复杂命令，**像与真人助理聊天一样直接向机器人发消息，AI 即可自动理解语义并自主执行手机命令**：

### 1. 常见自然语言对话示例：

| 你的输入 (自然语言) | AI 自主执行动作 | 返回结果 |
| :--- | :--- | :--- |
| **“帮我预测下期彩票”** 或 **“算一下下期特码”** | 自动触发数理公式推演与持久化演算 | 自动生成包含和值期望、波色概率、胆码及两组精选的预测贴 |
| **“查看保存的数学规律公式”** | 自动查询 SQLite 规律库 (`patterns.db`) | 展开 AR(1) 自回归方程、马尔可夫转移矩阵、冷热张力公式及当前置信度 |
| **“重新挖掘规律”** 或 **“更新历史数据与模型”** | 自动爬取历史接口并重新训练拟合参数 | 完成 360+ 期历史数据同步，重新计算出号张力与波色转移概率 |
| **“手机电量怎么样”** 或 **“查看系统负载”** | 自动调用 `termux-api` 与 `/proc/meminfo` | 汇报实时电池电量、发热温度、RAM 内存使用率与系统 LoadAvg |
| **“记个待办：下午3点开会”** | 自动写入本地 SQLite 待办库 (`tasks.db`) | 记录成功并分配任务 ID 号，提示记录时间 |
| **“我的待办清单”** 或 **“有哪些任务”** | 自动查询当前未完成事项列表 | 输出清晰的项目列表并提示完成指令 |
| **“搞定待办 1”** 或 **“完成待办 2”** | 自动更新数据库状态为 `done` | 提示标记完成 |
| **“cmd: uname -a”** 或 **“运行命令: ps”** | 自动在 Termux 中执行 Shell 命令并捕获输出 | 将 Linux 终端控制台回显格式化后直接回复在 Telegram |
| **纯输入日常指令**（如 `uptime`, `free -m`, `pwd`） | 识别为标准 Linux 指令直接执行 | 毫秒级返回宿主硬件与进程情况 |
| **“讲一个关于程序员的幽默笑话”** 或任意日常提问 | 回退至端侧离线大模型本地深度思考推理 | 零云端请求、纯离线生成高质量答复 |

---

## 🎰 彩票开奖历史获取与 AI 预测系统工作原理

本项目内置了独立的 `lottery.py` 自动化分析引擎，其全流程运行机制如下：

### 1. 真实数据源接入
系统通过 HTTP GET 请求获取澳门六合彩历史数据接口：
```http
GET https://history.macaumarksix.com/history/macaujc2/y/2026
```
接口返回 JSON 结构包含各期开奖详情：
```json
{
  "result": true,
  "data": [
    {
      "expect": "2026298",
      "openTime": "2026-10-25 21:32:32",
      "openCode": "31,36,40,34,37,43,08",
      "wave": "blue,blue,red,red,blue,green,red",
      "zodiac": "鼠,馬,虎,猴,蛇,豬,豬"
    }
  ]
}
```

### 2. 数理特征工程与四大公式模型提炼
数据拉取后，系统在手机本地通过 `pattern_engine.py` 挖掘规律并持久化存储至 SQLite 数据库（`patterns.db`）：

1. **一阶和值自回归期望公式 (AR-1 Sum Regression)**：
   $$\hat{S}_{t+1} = 0.55 \cdot MA_{21} + 0.30 \cdot S_t + 0.15 \cdot MA_7 \pm 1.15\sigma$$
   通过长短期移动平均线与历史方差，动态拟合和值波动的合理回落与冲高区间。
2. **马尔可夫链状态转移矩阵 (Markov Transition Matrix)**：
   $$P(\text{Wave}_{t+1} \mid \text{Wave}_t = \text{Current})$$
   从百期数据中构建状态转移概率矩阵，推导下一期红波、蓝波、绿波的最优转移概率。
3. **冷热遗漏张力振荡器 (Omission Tension Oscillator)**：
   $$T_i = \frac{\text{Omission}_i}{T_{\text{theo}}}, \quad (T_{\text{theo}} = \frac{49}{7} = 7.0)$$
   当某号码的遗漏周期达到理论值的 2 倍以上时，系统标记其进入极限张力回补临界区。
4. **双码伴随共现拓扑矩阵 (Co-occurrence Affinity Network)**：
   统计任意两码同出的频次与关联系数，捕捉高频成对出现的伴生关系。

### 3. 持久运行计算与自动发帖守护进程 (`persistent_engine.py`)
系统自带全天候后台守护进程：
```bash
# 后台持续运行，自动监听官方数据增量、更新公式、验算命中率并自动发帖
python3 persistent_engine.py
```
- **自动增量监听**：每隔 3 分钟轮询一次官方接口；
- **自动开奖核验**：新开奖出现后，立刻比对上期预测记录，计算大底命中数与特码命中状态并汇报；
- **自适应权重演进**：根据实测反馈动态调整公式置信度；
- **自动推送正式帖子**：生成新一期预测后，无需人工操作，直接推送到绑定的 Telegram 聊天界面或频道中！

### 4. 终端独立命令速查
- `python3 pattern_engine.py`：单次触发历史数据挖掘与公式持久化生成；
- `python3 persistent_engine.py`：启动持久循环监听守护进程；
- `bash status.sh`：查看持久引擎与公式库运行状态。

---

## ⏰ 智能化管理：定时内容生成与自动广播推送

利用安卓 Linux 底层的 `crond` 守护进程，可实现机器人每天按时自动为你生成内容并直接推送到你的 Telegram 私聊中。

### 1. 测试定时推送脚本
```bash
# 测试生成一份科技早报并推送到您的 Telegram
bash cron_jobs.sh "每日科技晨报" "以专业科技主编口吻总结今日行业进展，包含3个核心要点"
```

### 2. 配置 Crontab 计划任务
在 Termux 中执行：
```bash
crontab -e
```
粘贴以下预设规则：
```cron
# 每天早上 08:30 自动生成科技晨报并推送到 Telegram
30 8 * * * cd $HOME/termux-telegram-ai-bot && bash cron_jobs.sh "每日科技早报" "总结最新端侧AI与开源硬件动态，包含3个核心要点" >> logs/cron.log 2>&1

# 每天晚上 21:00 自动整理今日复盘
0 21 * * * cd $HOME/termux-telegram-ai-bot && bash cron_jobs.sh "晚间复盘与明日规划" "整理今日工作要点，提醒待办日程" >> logs/cron.log 2>&1

# 每隔 4 小时检查一次 llama-server 存活，若异常掉线则自动拉起
0 */4 * * * pgrep -f llama-server >/dev/null || (cd $HOME/termux-telegram-ai-bot && nohup bash start.sh >> logs/watchdog.log 2>&1 &)
```
保存后，在终端输入 `crond` 即可让定时任务在后台生效。

---

## 🔋 三星 Galaxy Note 9 (One UI 2.5) 24 小时后台保活四重防线

三星 One UI 2.5 的进程管理极其严格，为了防止息屏后 Termux 进程被系统挂起或冻结，请务必完成以下四步设置（一次设置，永久生效）：

### 🛡️ 第一重：关闭三星电池优化 (最关键)
1. 打开手机【设置】→【应用程序】→ 找到并点击【Termux】；
2. 点击【电池】→【优化电池使用量】；
3. 将顶部下拉筛选从「未优化的应用程序」切换为 **「全部」**；
4. 搜索或滑动找到 **Termux**，**将其右侧开关关闭**（变为灰色，表示不限制耗电）。

### 🛡️ 第二重：加入「从不休眠」白名单
1. 打开手机【设置】→【电池与设备维护】（部分系统显示为【设备维护】或【智能管理器】）；
2. 点击【电池】→【后台使用限制】；
3. 点击 **【从不自动休眠的应用程序】**；
4. 点击右上角 **「+」** 加号，在列表中勾选 **Termux** 并点击底部的【添加】。

### 🛡️ 第三重：多任务卡片界面锁定加锁
1. 从手机屏幕底部向上滑停顿（或点击导航栏的三条竖线图标）呼出最近应用卡片列表；
2. 找到 Termux 卡片，**点击卡片顶部的 Termux 圆形图标**；
3. 在弹出的菜单中点击 **【锁定此应用程序】**（卡片右下角会出现一把锁🔒标记，防止一键清理所有应用时被误杀）。

### 🛡️ 第四重：开启 Termux 唤醒锁与开机自启
本项目脚本在启动时已自动集成唤醒锁指令：
```bash
termux-wake-lock
```
若希望手机重启后自动无感恢复所有服务，请安装 **Termux:Boot** 应用，并在 Termux 中执行：
```bash
mkdir -p ~/.termux/boot
cp termux_boot.sh ~/.termux/boot/start_offline_ai.sh
chmod +x ~/.termux/boot/start_offline_ai.sh
```

---

## ❓ 常见问题与排错手册

### Q1: 运行 llama-server 时提示 `Killed` (内存溢出 OOM)
- **原因**：安卓系统的 Low Memory Killer (LMK) 判定物理内存吃紧，强行杀掉了进程。
- **解决方案**：
  1. 切换为占用更轻的模型：运行 `bash setup_model.sh` 选择 **[3] Qwen 2.5 0.5B**（仅需 400MB 内存）或 **[1] 1.5B**。
  2. 调小上下文参数：在 `start.sh` 中将 `-c 4096` 改为 `-c 2048`。
  3. 执行 `termux-wake-lock` 确保唤醒锁开启。

### Q2: 提示 `ConnectTimeout` 或无法连接 Telegram API
- **原因**：网络无法直连 `api.telegram.org`。
- **解决方案**：
  在手机本地或局域网开启代理软件（例如 Clash 或 V2ray），在 `.env` 中取消注释并配置代理地址：
  ```ini
  HTTPS_PROXY="http://127.0.0.1:7890"
  HTTP_PROXY="http://127.0.0.1:7890"
  ```
  保存后重新执行 `bash start.sh`。

### Q3: 提示 `clang: command not found` 或 `cmake error`
- **解决方案**：
  ```bash
  pkg update -y
  pkg install -y git clang cmake ninja make python libandroid-execinfo
  ```

### Q4: 模型下载速度极慢或卡在 0%
- **解决方案**：
  本项目的 `setup_model.sh` 脚本默认集成了国内 **阿里云魔搭社区 (ModelScope)** 镜像源，通常可跑满宽带；若魔搭偶尔维护，脚本会自动切换至 Hugging Face 源，且支持 `curl -C -` 断点续传，随时可以重新运行继续下载。

### Q5: `/status` 指令提示无法获取电池数据
- **解决方案**：
  1. 确保在 Termux 中执行过：`pkg install -y termux-api`；
  2. 确保在手机上安装了 `Termux:API` 安卓应用，并授予了所有请求的权限。

### Q6: 运行 install.sh 报错 `ERROR: Installing pip is forbidden, this will break the python-pip package (termux)`
- **原因**：Termux 遵循 PEP 668 系统环境规范，将 pip 作为系统级 deb 软件包统一管控，禁止直接运行 `pip install --upgrade pip`，以防止破坏 Termux 的包软链接。
- **解决方案**：
  请直接拉取本项目最新代码，或按以下方式执行：
  ```bash
  # 1. 使用 pkg 安装与更新 Python 和 pip
  pkg install -y python python-pip

  # 2. 安装 Python 依赖时加入 --break-system-packages 参数
  pip install --no-cache-dir --break-system-packages "python-telegram-bot[job-queue]>=20.8" httpx pyyaml aiosqlite requests
  ```
  本项目中的 `install.sh` 已全自动判断并自适应此参数，直接执行 `bash install.sh` 即可顺利完成！

### Q7: Webhook 模式提示 `Bad Request: bad webhook: HTTPS url must be provided` 或无法收到消息
- **原因**：Telegram 官方要求 Webhook URL 必须为带公网合法证书的 HTTPS 地址（仅限 443、80、88、8443 端口），手机本地内网 IP（如 192.168.x.x）无法被 Telegram 服务器直接路由。
- **解决方案**：
  1. 手机端运行 `bash setup_webhook.sh` 并按 `3`，一键启动免费的 Cloudflare Tunnel 穿透隧道；
  2. 复制生成的公网域名，保存到 `.env` 的 `WEBHOOK_URL` 中；
  3. 或者直接运行 `bash setup_webhook.sh` 并按 `2`，一键切回不需要任何公网 IP 的 Long Polling 长轮询模式。

### Q8: 报错 `Conflict: terminated by other getUpdates request; make sure that only one bot instance is running` (409 Conflict)
- **原因**：Telegram 严格限制同一个 Bot Token 只能有一个活跃的更新监听实例（无论是 Webhook 还是 Long Polling）。若后台已有旧的 `bot.py` 进程残留，或者其他设备也在运行该 Bot，就会相互踢掉对方。
- **解决方案**：
  1. 在 Termux 执行 `bash stop.sh` 彻底清理后台残留 Python 进程；
  2. 运行 `pgrep -fa "bot.py"` 确认无任何残留进程；
  3. 若之前配过 Webhook，运行 `bash setup_webhook.sh` 选择 `2` 清除 Telegram 服务器端注册的旧 Webhook 状态；
  4. 重新执行 `bash start.sh` 启动即可。

### Q9: 三星 Galaxy Note 9 / OneUI 熄屏数小时后 Termux 进程被杀死
- **原因**：三星 OneUI 系统带有激进的「深度休眠」与「设备维护」省电机制，屏幕关闭后若未加入白名单，系统会将 Termux 后台强制挂起冻结。
- **解决方案**：
  1. **开启 Termux 唤醒锁**：确保在 Termux 通知栏常驻显示 `wake lock held`（`bash start.sh` 会自动调用 `termux-wake-lock`）；
  2. **电池无限制优化**：进入手机「系统设置」→「应用程序」→ 找到「Termux」→ 点击「电池」→ 改为「不受限制 (Unrestricted)」；
  3. **排除休眠列表**：进入手机「设置」→「电池与设备维护」→「后台使用限制」→ 点击「从不自动休眠的应用」→ 添加「Termux」与「Termux:API」；
  4. **开启常驻通知**：下拉通知栏长按 Termux 通知，设为允许所有重要提醒。

---

## 📁 仓库项目文件结构

```
termux-telegram-ai-bot/
├── README.md               # 详细部署与运维全攻略 (本文件)
├── install.sh              # 一键基础环境与编译器依赖安装脚本 (修复 Termux pip 冲突)
├── setup_model.sh          # llama.cpp 编译与端侧 GGUF 模型下载器
├── setup_webhook.sh        # Telegram Webhook 状态查询、Cloudflare穿透与长轮询切换工具
├── start.sh                # 一键后台启动 llama-server 与 bot.py (自动识别 Polling/Webhook)
├── stop.sh                 # 一键安全关闭所有进程
├── status.sh               # 实时查看进程、端口、内存与电池状态
├── bot.py                  # Python 异步 Telegram Bot 主程序 (支持 Polling 与 Webhook 双模式)
├── agent_executor.py       # 自然语言意图识别、命令自主执行与系统工具调度引擎
├── pattern_engine.py       # 规律公式挖掘、SQLite持久化与自适应推演引擎
├── persistent_engine.py    # 持久运行计算与自动发帖守护进程
├── lottery.py              # 彩票历史接口抓取与数理特征提炼模块 (纯标准库)
├── cron_jobs.sh            # 定时任务执行与消息推送脚本
├── crontab.example         # Linux Cron 定时任务配置样例
├── termux_boot.sh          # Termux:Boot 开机自启配置脚本
├── requirements.txt        # Python 依赖包列表
├── .env.example            # 环境变量配置模板 (包含 Polling 与 Webhook 示例)
├── models/                 # 离线 GGUF 模型存放目录 (自动创建)
└── logs/                   # 运行日志存放目录 (自动创建)
```

---

## 📄 License
基于 Apache-2.0 协议开源，完全免费，无商业限制。
