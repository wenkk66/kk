import React, { useState } from 'react';
import { BotConfig, ContentTaskTemplate, TabType } from '../types';
import { CONTENT_TASK_TEMPLATES } from '../data/modelsData';
import {
  Sparkles,
  Calendar,
  Clock,
  Copy,
  Check,
  Send,
  Wand2,
  Newspaper,
  Terminal,
  CheckSquare,
  ArrowRight,
} from 'lucide-react';

interface ContentTasksTabProps {
  config: BotConfig;
  onShowToast: (msg: string) => void;
  onNavigateTab: (tab: TabType) => void;
}

export const ContentTasksTab: React.FC<ContentTasksTabProps> = ({
  config,
  onShowToast,
  onNavigateTab,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<ContentTaskTemplate>(
    CONTENT_TASK_TEMPLATES[0]
  );
  const [topic, setTopic] = useState<string>(CONTENT_TASK_TEMPLATES[0].defaultTopic);
  const [tone, setTone] = useState<string>('专业客观且排版优雅');
  const [length, setLength] = useState<string>('中等篇幅 (500~800字)');
  const [cronTime, setCronTime] = useState<string>('08:30');
  const [cronFrequency, setCronFrequency] = useState<string>('daily');

  const [generatedOutput, setGeneratedOutput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const handleSelectTemplate = (template: ContentTaskTemplate) => {
    setSelectedTemplate(template);
    setTopic(template.defaultTopic);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setIsGenerating(true);
    setGeneratedOutput('');

    try {
      const response = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: selectedTemplate.name,
          topic,
          tone,
          length,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setGeneratedOutput(data.content || '生成完毕');
      onShowToast('内容已由智能引擎生成！');
    } catch (err: any) {
      console.error('Content generation failed:', err);
      // Fallback
      setGeneratedOutput(
        `【${selectedTemplate.name}】\n主题：${topic}\n\n` +
          `在安卓端侧运行大模型，能彻底消除网络云端依赖与调用账单。您可以在 Termux 配合 Cron 定时调度，每天按时向您的 Telegram 机器人或专属频道推送此类高质量内容。`
      );
      onShowToast('生成完成 (本地备用格式)');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!generatedOutput) return;
    navigator.clipboard.writeText(generatedOutput);
    setCopied(true);
    onShowToast('已复制内容到剪贴板！');
    setTimeout(() => setCopied(false), 2000);
  };

  // Build Termux crontab instruction for this task
  const [hour, minute] = cronTime.split(':');
  const generatedCronLine = `${Number(minute) || 0} ${Number(hour) || 8} * * *`;
  const cronBashCommand =
    selectedTemplate.id === 'lottery-pattern-daily'
      ? `${generatedCronLine} cd ~/telegram-offline-ai && bash cron_jobs.sh "澳门六合彩走势预测" >> logs/cron.log 2>&1`
      : `${generatedCronLine} python3 -c 'from bot import call_offline_llm; import asyncio; print(asyncio.run(call_offline_llm("请生成${topic}", "${selectedTemplate.systemPromptAddon}")))' >> ~/telegram-offline-ai/logs/cron.log 2>&1`;

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'newspaper':
        return <Newspaper className="w-4 h-4 text-cyan-400" />;
      case 'sparkles':
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
      case 'terminal':
        return <Terminal className="w-4 h-4 text-cyan-400" />;
      case 'check-square':
        return <CheckSquare className="w-4 h-4 text-cyan-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-cyan-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro strip */}
      <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">
          自动化内容生成与智能化管理调度
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          借助手机端离线大模型，Telegram Bot 不仅可以被动回复，还能化身主动的个人生活与工作管家：定时生成早报、自动整理知识清单、批量产出自媒体文案。
        </p>
      </div>

      {/* Templates Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {CONTENT_TASK_TEMPLATES.map((tmpl) => {
          const isSelected = selectedTemplate.id === tmpl.id;
          return (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => handleSelectTemplate(tmpl)}
              className={`p-4 rounded-lg border text-left transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900 border-cyan-500/60 shadow-sm'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                    {getIcon(tmpl.icon)}
                  </div>
                  <span className="text-xs font-bold text-slate-200">{tmpl.name}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{tmpl.description}</p>
              </div>

              <div className="mt-4 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Cron: {tmpl.cronExpression}</span>
                {isSelected && <span className="text-cyan-400 font-sans font-medium">当前选用</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Generator & Preview Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Input Form (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-200">生成参数配置</h2>
            <span className="text-xs text-cyan-400 font-mono">{selectedTemplate.name}</span>
          </div>

          {/* Topic */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              生成主题 / 核心诉求
            </label>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="输入你希望生成的内容主题或关键词..."
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 leading-relaxed"
            />
          </div>

          {/* Tone & Length */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">语气风格</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-cyan-500/60"
              >
                <option value="专业客观且排版优雅">专业客观 / 优雅排版</option>
                <option value="生动活泼且富有吸引力">生动活泼 / 爆款网感</option>
                <option value="干货硬核且条理严谨">干货硬核 / 严密逻辑</option>
                <option value="简明精要适合速读">极简要点 / 快速阅读</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">目标篇幅</label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-cyan-500/60"
              >
                <option value="精简短讯 (200~400字)">精简短讯 (200~400字)</option>
                <option value="中等篇幅 (500~800字)">中等篇幅 (500~800字)</option>
                <option value="详实长文 (1000字以上)">详实长文 (1000字以上)</option>
              </select>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="button"
            disabled={isGenerating || !topic.trim()}
            onClick={handleGenerate}
            className="w-full py-2.5 px-4 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>{isGenerating ? 'AI 正在离线演算生成中...' : '立即生成内容'}</span>
          </button>

          {/* Special Deep-Link for Lottery Pattern Task */}
          {selectedTemplate.id === 'lottery-pattern-daily' && (
            <div className="p-3 rounded-md bg-gradient-to-r from-amber-950/40 via-cyan-950/30 to-slate-900 border border-amber-500/30 flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>10,000 轮蒙特卡洛与公式库现已就绪</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  支持 49 码遗漏走势、AI 自动发掘新公式与收敛 18 码研判。
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onNavigateTab('engine');
                  onShowToast('已进入 AI 规律公式与 1 万轮持久计算工作台');
                }}
                className="shrink-0 px-2.5 py-1 text-xs font-medium bg-amber-400 hover:bg-amber-300 text-slate-950 rounded transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>进入工作台</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Cron Automation Box */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <h3 className="text-xs font-semibold text-slate-200">
                定时自动化推送 (Termux Cron)
              </h3>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1">
                <span className="text-[11px] text-slate-400 block mb-1">每日推送时间</span>
                <input
                  type="time"
                  value={cronTime}
                  onChange={(e) => setCronTime(e.target.value)}
                  className="w-full px-2 py-1 text-xs font-mono bg-slate-950 border border-slate-800 rounded text-slate-200"
                />
              </div>
              <div className="flex-1">
                <span className="text-[11px] text-slate-400 block mb-1">Cron 调度周期</span>
                <span className="text-xs font-mono text-cyan-400 block py-1">每天 {cronTime}</span>
              </div>
            </div>

            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto space-y-1">
              <div className="text-slate-500"># 在 Termux 输入 crontab -e 并粘贴：</div>
              <div className="text-slate-300 select-all">{cronBashCommand}</div>
            </div>
          </div>
        </div>

        {/* Right: Output Preview (7 cols) */}
        <div className="lg:col-span-7 rounded-lg bg-slate-900 border border-slate-800 overflow-hidden flex flex-col h-[560px]">
          <div className="px-4 py-2.5 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between shrink-0">
            <span className="text-xs font-medium text-slate-300">
              生成的 Telegram 消息预览
            </span>

            <div className="flex items-center gap-2">
              {generatedOutput && (
                <>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>{copied ? '已复制' : '复制全文'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onNavigateTab('sandbox');
                      onShowToast('前往仿真沙盒查看 Bot 交互效果！');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-cyan-400 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                  >
                    <span>在沙盒测试</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-5 flex-1 overflow-y-auto bg-slate-950">
            {generatedOutput ? (
              <div className="whitespace-pre-wrap text-xs text-slate-200 leading-relaxed font-sans selection:bg-cyan-500/30">
                {generatedOutput}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                <Wand2 className="w-8 h-8 text-slate-700" />
                <p className="text-xs">
                  在左侧选择模板并填写主题后，点击「立即生成内容」开始自动化创作。
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
