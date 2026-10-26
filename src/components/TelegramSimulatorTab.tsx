import React, { useState, useRef, useEffect } from 'react';
import { BotConfig, TelegramMessage } from '../types';
import { GGUF_MODELS } from '../data/modelsData';
import {
  Send,
  Trash2,
  Bot,
  User,
  Zap,
  Activity,
  Sparkles,
  RotateCcw,
  Terminal,
  Clock,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Download,
} from 'lucide-react';

interface TelegramSimulatorTabProps {
  config: BotConfig;
  onShowToast: (msg: string) => void;
}

export const TelegramSimulatorTab: React.FC<TelegramSimulatorTabProps> = ({
  config,
  onShowToast,
}) => {
  const selectedModel = GGUF_MODELS.find((m) => m.id === config.selectedModelId) || GGUF_MODELS[0];

  const [messages, setMessages] = useState<TelegramMessage[]>([
    {
      id: 'init-1',
      sender: 'bot',
      text: `🤖 **Termux 离线 AI Telegram 管家已就绪**\n\n• **宿主设备**: Android 手机本地 (Termux ARM64)\n• **当前模型**: \`${selectedModel.filename}\`\n• **量化规格**: \`${selectedModel.quantization}\` (物理占用 ~${selectedModel.sizeGb}GB)\n• **推理服务**: \`http://127.0.0.1:${config.port}/v1\`\n\n✨ **快捷指令支持**:\n• \`/write <主题>\` - 自动化撰写文章、文案与脚本\n• \`/summarize <文本>\` - 智能提炼要点与行动清单\n• \`/task add <事项>\` - 记录到手机本地 SQLite 数据库\n• \`/task list\` - 查看未完成任务清单\n• \`/status\` - 查看手机端电池、温度与内存负载\n\n💬 直接发送任意问题，本地神经网络即刻为您运算！`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      metrics: {
        latencyMs: 140,
        estimatedTokens: 180,
        tokensPerSecond: 28.5,
        model: selectedModel.name,
        quantization: selectedModel.quantization,
        engine: 'llama.cpp ARM64 NEON',
      },
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text || isLoading) return;

    const userMsg: TelegramMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/simulate-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          modelName: selectedModel.name,
          systemPrompt: config.systemPrompt,
          temperature: config.temperature,
          pureMathMode: config.pureMathMode,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();

      const botMsg: TelegramMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: data.reply || '（未获取到回复）',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        metrics: data.simulatedMetrics,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Simulation error:', err);
      // Fallback message
      const errorMsg: TelegramMessage = {
        id: `bot-err-${Date.now()}`,
        sender: 'bot',
        text: `⚠️ **本地仿真连接提示**: 离线引擎正在本地待机。\n针对指令: \`${text}\`\n\nTermux 离线环境将由本地编译的 \`llama-server\` 负责秒级吐字，不消耗手机移动流量。`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
      onShowToast('使用本地备用端侧响应');
    } finally {
      setIsLoading(false);
    }
  };

  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const handleClearHistory = () => {
    setMessages([
      {
        id: `reset-${Date.now()}`,
        sender: 'system',
        text: '对话记录已在本地清空。',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    onShowToast('对话已重置');
  };

  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    onShowToast('消息内容已复制到剪贴板！');
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleExportTranscript = () => {
    const transcript = messages
      .map((m) => `[${m.timestamp}] ${m.sender === 'user' ? '用户' : m.sender === 'bot' ? 'Termux Bot' : '系统'}:\n${m.text}\n`)
      .join('\n---\n\n');
    const blob = new Blob([transcript], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `telegram-bot-transcript-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('对话记录已导出为 Markdown 文件！');
  };

  const [isKeyboardOpen, setIsKeyboardOpen] = useState(true);

  const replyKeyboardButtons = [
    [
      { label: '⚡ 纯数学计算 18 码 (/calc)', prompt: '/calc', desc: '100% 绕过大模型，纯确定性高维数学矩阵松弛求解' },
      { label: '🎰 200期18码 (万轮收敛)', prompt: '🎰 200期18码 (AI万轮收敛)', desc: '200期全量样本 + 1万轮蒙特卡洛一体化收敛预测' },
    ],
    [
      { label: '🛡️ 24/7 持久守护状态', prompt: '/daemon_status', desc: '自动增量监听、贝叶斯自进化与静默推送' },
      { label: '📈 50期回测胜率', prompt: '/backtest 50', desc: '近50期严格步进无未来函数回测报告' },
    ],
    [
      { label: '📐 算法数学公式库', prompt: '📐 查看算法公式', desc: 'SQLite 持久化数学规律模型库' },
      { label: '📊 历史开奖走势', prompt: '📊 历史开奖走势', desc: '近多期开奖号码与生肖波色分布' },
    ],
    [
      { label: '📱 手机状态遥测', prompt: '📱 手机状态遥测', desc: '电池、发热温度与Termux负载' },
      { label: '📝 本地待办事项', prompt: '📝 本地待办事项', desc: '本地 SQLite 日程与备忘' },
    ],
    [
      { label: '🤖 离线模型规格', prompt: '/model', desc: '当前加载的端侧模型与推理参数' },
      { label: '📜 实时运行日志', prompt: '/logs 15', desc: '实时检视 Termux 本地后台日志' },
    ],
  ];

  const quickCommands = [
    { label: '⚡ 纯数学计算 (/calc)', prompt: '/calc' },
    { label: '❓ 为什么不用弱智AI?', prompt: '感觉AI没什么用，太弱智，是否可以编写各种规律公式和各种算法持久运行生成预测结果呢' },
    { label: '🛡️ 持久守护状态', prompt: '/daemon_status' },
    { label: '🎰 200期18码', prompt: '🎰 200期18码 (AI万轮收敛)' },
    { label: '📈 50期回测胜率', prompt: '/backtest 50' },
    { label: '📐 算法数学公式', prompt: '/patterns' },
    { label: '📊 历史开奖走势', prompt: '/lottery_chart' },
    { label: '🔄 重新挖掘规律', prompt: '/mine' },
    { label: '🎯 预测核验台账', prompt: '/verify' },
    { label: '📱 手机状态遥测', prompt: '/status' },
    { label: '🖥️ 执行Shell: free -m', prompt: '/cmd free -m' },
    { label: '📜 查看日志 (/logs 15)', prompt: '/logs 15' },
    { label: '📋 查看我的待办', prompt: '/task list' },
  ];

  return (
    <div className="space-y-6">
      {/* Intro strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-lg bg-slate-900/60 border border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Telegram Bot 实时对话仿真沙盒
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            此沙盒直观模拟部署在 Termux 中的 Python Bot 与本地端侧模型。你可以直接测试
            /write、/summarize、/task 等命令与长文本自动排版能力。
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportTranscript}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
            title="导出对话记录为 Markdown 文件"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>导出记录</span>
          </button>
          <button
            type="button"
            onClick={handleClearHistory}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>重置对话</span>
          </button>
        </div>
      </div>

      {/* Quick Test Command Chips Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-500 shrink-0 font-medium text-[11px] flex items-center gap-1">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          快捷调试:
        </span>
        {quickCommands.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={isLoading}
            onClick={() => handleSendMessage(item.prompt)}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-slate-300 hover:text-white text-[11px] whitespace-nowrap transition-colors disabled:opacity-50"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Telegram Mock Viewport */}
      <div className="max-w-4xl mx-auto rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl flex flex-col h-[680px]">
        {/* Telegram Chat Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">Termux AI Assistant</span>
                <span className="text-[11px] text-slate-500 font-mono">bot</span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>在线 · Termux ARM64</span>
                <span aria-hidden="true">·</span>
                <span className="text-cyan-400 font-mono text-[11px]">{selectedModel.name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span className="hidden sm:inline">端侧常驻: 127.0.0.1:{config.port}</span>
          </div>
        </div>

        {/* Message timeline */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-950/80">
          {messages.map((msg) => {
            if (msg.sender === 'system') {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="text-[11px] text-slate-500 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[85%] ${
                  isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {!isUser && (
                  <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-1">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className="space-y-1.5">
                  <div
                    className={`p-3.5 rounded-lg text-xs leading-relaxed ${
                      isUser
                        ? 'bg-cyan-500/15 border border-cyan-500/30 text-slate-100'
                        : 'bg-slate-900 border border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans selection:bg-cyan-500/30">
                      {msg.text}
                    </div>

                    {/* Inline Keyboard Buttons (InlineKeyboardMarkup) under bot responses */}
                    {!isUser && (msg.text.includes('预测') || msg.text.includes('公式') || msg.text.includes('六合彩') || msg.text.includes('走势') || msg.text.includes('管家已就绪')) && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-2">
                        <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-medium">
                          <Sparkles className="w-3 h-3" />
                          <span>交互式内嵌按钮 (Telegram Inline Keyboard)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleSendMessage('🎰 预测200期18码')}
                            className="px-2 py-1.5 rounded bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-300 hover:text-white text-[11px] font-medium transition-colors text-center"
                          >
                            🎯 预测200期18码
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleSendMessage('/ai_calc 200 18')}
                            className="px-2 py-1.5 rounded bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800/60 text-indigo-300 hover:text-white text-[11px] font-medium transition-colors text-center"
                          >
                            🌌 1万轮AI持久计算
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleSendMessage('/formula new')}
                            className="px-2 py-1.5 rounded bg-slate-800/70 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white text-[11px] font-medium transition-colors text-center"
                          >
                            ✨ 发掘新公式模板
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleSendMessage('/backtest 50')}
                            className="px-2 py-1.5 rounded bg-slate-800/70 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white text-[11px] font-medium transition-colors text-center"
                          >
                            📈 50期回测胜率
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleSendMessage('📐 查看算法公式')}
                            className="px-2 py-1.5 rounded bg-slate-800/70 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white text-[11px] font-medium transition-colors text-center"
                          >
                            📐 算法公式库
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleSendMessage('/lottery_chart')}
                            className="px-2 py-1.5 rounded bg-slate-800/70 hover:bg-slate-700 border border-slate-700/60 text-slate-200 hover:text-white text-[11px] font-medium transition-colors text-center"
                          >
                            📊 历史走势图
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg.id, msg.text)}
                        className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-cyan-300 transition-colors"
                        title="复制消息内容"
                      >
                        {copiedMsgId === msg.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                        <span>{copiedMsgId === msg.id ? '已复制' : '复制'}</span>
                      </button>
                      <div className="flex items-center gap-1.5">
                        <span>{msg.timestamp}</span>
                        {isUser && <span className="text-cyan-400">✓✓</span>}
                      </div>
                    </div>
                  </div>

                  {/* Telemetry pill-free unboxed metadata for bot responses */}
                  {msg.metrics && !isUser && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 font-mono px-1">
                      <span>
                        耗时: <span className="text-slate-300 tabular-nums">{msg.metrics.latencyMs}ms</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        推理速度: <span className="text-cyan-400 tabular-nums">{msg.metrics.tokensPerSecond} tok/s</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        生成长度: <span className="text-slate-300 tabular-nums">~{msg.metrics.estimatedTokens} 字</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{msg.metrics.engine}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-3 max-w-[85%] mr-auto items-center">
              <div className="w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Bot className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>手机端侧大模型正在推理生成中...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Telegram Native ReplyKeyboardMarkup Panel */}
        {isKeyboardOpen && (
          <div className="px-3.5 py-3 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md transition-all">
            <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800 text-[11px]">
              <div className="flex items-center gap-2 text-slate-200 font-semibold">
                <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
                <span>Telegram 常驻键盘菜单 (ReplyKeyboardMarkup · 一键免打字)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsKeyboardOpen(false)}
                className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 transition-colors"
                title="收起键盘"
              >
                <span>收起键盘</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {replyKeyboardButtons.map((row, rowIdx) => (
                <div
                  key={rowIdx}
                  className={`grid gap-2 ${
                    row.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
                  }`}
                >
                  {row.map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleSendMessage(btn.prompt)}
                      className={`group flex items-center justify-between p-2.5 rounded-lg border text-left transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-sm ${
                        row.length === 1
                          ? 'bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-950 border-cyan-500/40 hover:border-cyan-400'
                          : 'bg-slate-950 hover:bg-slate-800/90 border-slate-800/90 hover:border-cyan-500/50'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div
                          className={`text-xs font-semibold truncate ${
                            row.length === 1
                              ? 'text-cyan-200 group-hover:text-cyan-100 font-bold'
                              : 'text-slate-100 group-hover:text-cyan-300'
                          }`}
                        >
                          {btn.label}
                        </div>
                        <div className="text-[10px] text-slate-400 group-hover:text-slate-300 truncate mt-0.5">
                          {btn.desc}
                        </div>
                      </div>
                      <span className="text-[10px] text-cyan-400 font-mono opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        发送 ↵
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Input box */}
        <div className="p-3 bg-slate-950 border-t border-slate-800 shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => setIsKeyboardOpen(!isKeyboardOpen)}
              title={isKeyboardOpen ? '收起快捷键盘' : '展开快捷键盘菜单 (免打字)'}
              className={`p-2 rounded-md border text-xs flex items-center justify-center transition-colors shrink-0 ${
                isKeyboardOpen
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              placeholder="输入消息或点击下方键盘菜单 (如: 🎰 预测200期18码、📐 查看算法公式)..."
              className="flex-1 px-3.5 py-2 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>发送</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
