import React, { useState, useEffect } from 'react';
import { BotConfig, TabType } from '../types';
import { GGUF_MODELS } from '../data/modelsData';
import {
  generateInstallScript,
  generateBuildAndDownloadScript,
  generateBotPy,
  generateStartAllScript,
  generateStatusScript,
  generateStopScript,
  generateTermuxBootScript,
  generateCrontabConfig,
  generateWebhookScript,
  generateCronJobsScript,
  generateEnvExample,
  generateRequirementsTxt,
  generateReadme,
} from '../utils/scriptGenerators';
import {
  Copy,
  Check,
  Download,
  Settings,
  Code2,
  FileCode,
  ExternalLink,
  Cpu,
  ShieldCheck,
  Play,
  Layers,
  Globe,
  Terminal,
  FileText,
  Sparkles,
} from 'lucide-react';

interface DeployConfigTabProps {
  config: BotConfig;
  onChangeConfig: (newConfig: BotConfig) => void;
  onShowToast: (msg: string) => void;
  onNavigateTab: (tab: TabType) => void;
}

type ScriptKey =
  | 'bot'
  | 'agent'
  | 'pattern'
  | 'lottery'
  | 'persistent'
  | 'start'
  | 'status'
  | 'stop'
  | 'webhook'
  | 'build'
  | 'install'
  | 'cron'
  | 'boot'
  | 'crontab'
  | 'env'
  | 'req'
  | 'readme';

type CategoryKey = 'all' | 'python' | 'shell' | 'config';

export const DeployConfigTab: React.FC<DeployConfigTabProps> = ({
  config,
  onChangeConfig,
  onShowToast,
  onNavigateTab,
}) => {
  const [activeScript, setActiveScript] = useState<ScriptKey>('bot');
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [serverFiles, setServerFiles] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/project-files')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setServerFiles(data);
        }
      })
      .catch((err) => {
        console.warn('Could not load server project files:', err);
      });
  }, []);

  const scriptsMap: Record<ScriptKey, { filename: string; category: 'python' | 'shell' | 'config'; content: string; desc: string }> = {
    bot: {
      filename: 'bot.py',
      category: 'python',
      content: serverFiles['bot.py'] || generateBotPy(config),
      desc: '纯 Python 3.10+ 异步 Telegram Bot 主程序，自动支持 Long Polling 与 Webhook 双模式，负责指令路由、Agent 调度、彩票规律推算与 SQLite 待办持久化。',
    },
    agent: {
      filename: 'agent_executor.py',
      category: 'python',
      content: serverFiles['agent_executor.py'] || `# Agent 调度中枢 (自然语言意图识别与系统工具调用)\n# 详情请下载完整 ZIP 或在服务器查看。`,
      desc: '自然语言意图识别与工具执行路由器：支持大白话自动识别彩票预测、手机遥测、待办增删、规律重算及 Shell 命令。',
    },
    pattern: {
      filename: 'pattern_engine.py',
      category: 'python',
      content: serverFiles['pattern_engine.py'] || `# SQLite 持久化数学规律挖掘与 18 码复式大底推导引擎`,
      desc: 'SQLite 持久化数学模型库：和值自回归期望 AR(1)、马尔可夫波色转移矩阵、冷热遗漏极限张力及双码伴生亲和拓扑。',
    },
    lottery: {
      filename: 'lottery.py',
      category: 'python',
      content: serverFiles['lottery.py'] || `# 澳门六合彩历史数据解析与数理特征统计计算库`,
      desc: '官方开奖历史数据拉取与多维数理特征统计库：高频热号、极冷张力、波色分布、生肖频次与 Prompt 组装。',
    },
    persistent: {
      filename: 'persistent_engine.py',
      category: 'python',
      content: serverFiles['persistent_engine.py'] || `# 增量开奖自动监听、历史核验与自动发帖守护进程`,
      desc: '常驻后台轮询监听增量开奖数据，自动回测上期预测命中率，自适应更新数学模型参数并发布最新预测。',
    },
    start: {
      filename: 'start.sh',
      category: 'shell',
      content: serverFiles['start.sh'] || generateStartAllScript(config),
      desc: '一键后台拉起 llama.cpp server 推理引擎、自适应规律守护与 Python Bot，并具备端口就绪探测与大核线程优化。',
    },
    status: {
      filename: 'status.sh',
      category: 'shell',
      content: serverFiles['status.sh'] || generateStatusScript(),
      desc: '实时查看 llama-server、bot.py 与 persistent_engine 进程状态、内存占用及 SQLite 规则库统计。',
    },
    stop: {
      filename: 'stop.sh',
      category: 'shell',
      content: serverFiles['stop.sh'] || generateStopScript(),
      desc: '一键安全终止所有后台 Python 与 llama 推理进程，释放手机系统内存与计算资源。',
    },
    webhook: {
      filename: 'setup_webhook.sh',
      category: 'shell',
      content: serverFiles['setup_webhook.sh'] || generateWebhookScript(),
      desc: 'Telegram Webhook 交互式配置工具：支持一键查询 Webhook 状态、一键清除回退轮询、以及 Cloudflare Tunnel 免公网 IP 穿透启动。',
    },
    build: {
      filename: 'setup_model.sh',
      category: 'shell',
      content: serverFiles['setup_model.sh'] || generateBuildAndDownloadScript(config),
      desc: '编译原生 aarch64 NEON 加速的 llama.cpp，并断点续传下载指定量化 GGUF 模型。',
    },
    install: {
      filename: 'install.sh',
      category: 'shell',
      content: serverFiles['install.sh'] || generateInstallScript(config),
      desc: 'Termux 基础环境初始化：安装 clang、cmake、python、wake-lock 及必要 Python 依赖库（已修复 pip upgrade 冲突）。',
    },
    cron: {
      filename: 'cron_jobs.sh',
      category: 'shell',
      content: serverFiles['cron_jobs.sh'] || generateCronJobsScript(),
      desc: 'Termux Cron 定时自动化任务执行脚本：调用离线大语言模型生成早报或彩票预测并推送至 Telegram。',
    },
    boot: {
      filename: 'termux_boot.sh',
      category: 'shell',
      content: serverFiles['termux_boot.sh'] || generateTermuxBootScript(config),
      desc: '配合安卓 Termux:Boot 应用，实现手机开机后无需人工操作自启动机器人。',
    },
    crontab: {
      filename: 'crontab.example',
      category: 'config',
      content: serverFiles['crontab.example'] || generateCrontabConfig(config),
      desc: 'Linux Cron 定时任务配置，实现早报晚报定时自动生成与看门狗进程守护。',
    },
    env: {
      filename: '.env.example',
      category: 'config',
      content: serverFiles['.env.example'] || generateEnvExample(config),
      desc: '三星 Note 9 极简 2 行配置文件模板，已针对 ARM64 与 Note 9 骁龙 845 / 猎户座 9810 深度调优。',
    },
    req: {
      filename: 'requirements.txt',
      category: 'config',
      content: serverFiles['requirements.txt'] || generateRequirementsTxt(),
      desc: '纯 Python 3.10+ 核心依赖库清单，保证 100% 零 Go 语言依赖、零 Cgo 编译风险。',
    },
    readme: {
      filename: 'README.md',
      category: 'config',
      content: serverFiles['README.md'] || generateReadme(config),
      desc: '项目完整架构文档与 3 步极速部署指南。',
    },
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    onShowToast(`已复制 ${scriptsMap[key as ScriptKey]?.filename || '内容'} 到剪贴板！`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadSingle = (script: { filename: string; content: string }) => {
    const blob = new Blob([script.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = script.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast(`已下载 ${script.filename}`);
  };

  const selectedModel = GGUF_MODELS.find((m) => m.id === config.selectedModelId) || GGUF_MODELS[0];

  const filteredScriptKeys = (Object.keys(scriptsMap) as ScriptKey[]).filter((key) => {
    if (activeCategory === 'all') return true;
    return scriptsMap[key].category === activeCategory;
  });

  return (
    <div className="space-y-6">
      {/* Overview intro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-lg bg-slate-900/60 border border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Termux 离线 AI & Telegram Bot 部署中枢
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            配置你的 Telegram Bot Token 与安卓设备硬件参数，系统将自动生成完备的原生编译脚本、Python 异步机器人代码、自启看门狗、数学规律挖掘与定时任务。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('sandbox')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
          >
            <Play className="w-3.5 h-3.5 text-cyan-400" />
            <span>进入 Bot 对话仿真测试</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Configuration Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-slate-200">机器人与环境参数</h2>
              </div>
              <span className="text-xs text-slate-500 font-mono">config.env</span>
            </div>

            {/* Telegram Bot Token */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">Telegram Bot Token</label>
                <a
                  href="https://t.me/BotFather"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-cyan-400 hover:underline inline-flex items-center gap-1"
                >
                  通过 @BotFather 获取
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="text"
                value={config.botToken}
                onChange={(e) => onChangeConfig({ ...config, botToken: e.target.value })}
                placeholder="例如: 7123456789:AAHq_mF7J..."
                className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                创建机器人后获得的唯一访问凭证，完全保存在手机本地。
              </p>
            </div>

            {/* Admin Chat ID */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-300">管理员 Telegram Chat ID</label>
                <span className="text-[11px] text-slate-500">向 @userinfobot 发送消息获取数字 ID</span>
              </div>
              <input
                type="text"
                value={config.adminChatId}
                onChange={(e) => onChangeConfig({ ...config, adminChatId: e.target.value })}
                placeholder="例如: 987654321"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60"
              />
            </div>

            {/* Model Selector */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                常驻端侧大语言模型 (GGUF)
              </label>
              <select
                value={config.selectedModelId}
                onChange={(e) => onChangeConfig({ ...config, selectedModelId: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-cyan-500/60"
              >
                {GGUF_MODELS.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} — {model.parameters} ({model.sizeGb} GB)
                  </option>
                ))}
              </select>
              <div className="mt-2 p-2.5 rounded bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">{selectedModel.name}</span>
                  <span className="text-cyan-400 font-mono text-[11px]">{selectedModel.quantization}</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{selectedModel.description}</p>
                <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-500 font-mono">
                  <span>模型大小: {selectedModel.sizeGb} GB</span>
                  <span aria-hidden="true">·</span>
                  <span>最低内存: {selectedModel.minRamGb} GB</span>
                </div>
              </div>
            </div>

            {/* Hardware & Threads */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  CPU 推理核心数
                </label>
                <select
                  value={config.threads}
                  onChange={(e) => onChangeConfig({ ...config, threads: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-cyan-500/60 font-mono"
                >
                  <option value={2}>2 核心 (省电低发热)</option>
                  <option value={4}>4 核心 (Note 9 推荐)</option>
                  <option value={6}>6 核心 (骁龙旗舰推荐)</option>
                  <option value={8}>8 核心 (满血全开)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  上下文长度 (n_ctx)
                </label>
                <select
                  value={config.contextSize}
                  onChange={(e) => onChangeConfig({ ...config, contextSize: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-cyan-500/60 font-mono"
                >
                  <option value={2048}>2048 tokens (最省内存)</option>
                  <option value={4096}>4096 tokens (均衡推荐)</option>
                  <option value={8192}>8192 tokens (长文写作)</option>
                </select>
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="pt-2 border-t border-slate-800 space-y-2.5">
              <span className="text-xs font-medium text-slate-300 block">集成功能特性</span>

              <label className="flex items-center justify-between p-2 rounded bg-slate-950/40 border border-slate-800/60 cursor-pointer hover:bg-slate-950/70">
                <div className="text-xs">
                  <span className="text-slate-200 block font-medium">仅限管理员私有访问</span>
                  <span className="text-[11px] text-slate-500">仅允许上面填写的 Admin Chat ID 交互</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.adminOnly}
                  onChange={(e) => onChangeConfig({ ...config, adminOnly: e.target.checked })}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-slate-950/40 border border-slate-800/60 cursor-pointer hover:bg-slate-950/70">
                <div className="text-xs">
                  <span className="text-slate-200 block font-medium">SQLite 待办与规律存储 (/task, /predict)</span>
                  <span className="text-[11px] text-slate-500">自动记录日程备忘并固化 4 组数学公式</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableTaskDb}
                  onChange={(e) => onChangeConfig({ ...config, enableTaskDb: e.target.checked })}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-slate-950/40 border border-slate-800/60 cursor-pointer hover:bg-slate-950/70">
                <div className="text-xs">
                  <span className="text-slate-200 block font-medium">Termux:API 硬件遥测 (/status)</span>
                  <span className="text-[11px] text-slate-500">获取手机温度、电量与内存负载</span>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableSystemMonitor}
                  onChange={(e) => onChangeConfig({ ...config, enableSystemMonitor: e.target.checked })}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right column: Generated Files Inspector (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
            {/* Category Filter Bar */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 bg-slate-950">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">文件分类:</span>
                <button
                  type="button"
                  onClick={() => setActiveCategory('all')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    activeCategory === 'all'
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  全部 ({Object.keys(scriptsMap).length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('python')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    activeCategory === 'python'
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  🐍 Python 核心 (5)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('shell')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    activeCategory === 'shell'
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ⚙️ Shell 运维 (8)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('config')}
                  className={`px-2 py-0.5 rounded transition-colors ${
                    activeCategory === 'config'
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  📄 配置依赖 (4)
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(scriptsMap[activeScript].content, activeScript)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                >
                  {copiedKey === activeScript ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>{copiedKey === activeScript ? '已复制' : '复制代码'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadSingle(scriptsMap[activeScript])}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>下载此文件</span>
                </button>
              </div>
            </div>

            {/* Sub file tab selector bar */}
            <div className="flex items-center gap-1 overflow-x-auto px-4 py-2 bg-slate-950/80 border-b border-slate-800/80">
              {filteredScriptKeys.map((key) => {
                const s = scriptsMap[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveScript(key)}
                    className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                      activeScript === key
                        ? 'bg-slate-800 text-cyan-400 font-semibold border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {s.filename}
                  </button>
                );
              })}
            </div>

            {/* Script Description kicker */}
            <div className="px-4 py-2 bg-slate-950/40 border-b border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
              <span>{scriptsMap[activeScript].desc}</span>
              <span className="font-mono text-[11px] text-slate-500 shrink-0 ml-2">
                {scriptsMap[activeScript].content.split('\n').length} 行
              </span>
            </div>

            {/* Code Box */}
            <div className="p-4 bg-slate-950 max-h-[520px] overflow-y-auto">
              <pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre font-normal selection:bg-cyan-500/30">
                {scriptsMap[activeScript].content}
              </pre>
            </div>
          </div>

          {/* Quick Start Guide */}
          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-2.5">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              安卓手机 Termux 极速上线操作步骤 (三星 Note 9 专享调优)
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-400 pl-1">
              <li>
                在安卓手机上安装 <span className="text-slate-200 font-medium">Termux</span> 与{' '}
                <span className="text-slate-200 font-medium">Termux:API</span>。
              </li>
              <li>
                点击右上角 <span className="text-cyan-400 font-medium">下载完整项目包 (.ZIP)</span>，传入手机解压到{' '}
                <code className="text-slate-200 bg-slate-800 px-1 py-0.5 rounded">~/telegram-offline-ai</code>。
              </li>
              <li>
                在 Termux 中依次执行：
                <div className="mt-1.5 p-2 rounded bg-slate-950 border border-slate-800 font-mono text-slate-300 select-all space-y-1">
                  <div>bash install.sh</div>
                  <div>bash setup_model.sh</div>
                  <div>bash start.sh</div>
                </div>
              </li>
              <li>
                在 Telegram 中向你的 Bot 发送 <code className="text-cyan-400">/start</code> 或点击底部常驻键盘，机器人即刻响应！
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
