import React from 'react';
import { TabType, BotConfig } from '../types';
import { createProjectZip } from '../utils/scriptGenerators';
import { Download, Terminal } from 'lucide-react';

interface HeaderProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  config: BotConfig;
  onShowToast: (msg: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  config,
  onShowToast,
}) => {
  const [downloading, setDownloading] = React.useState(false);

  const handleDownloadAll = async () => {
    try {
      setDownloading(true);
      const zipBlob = await createProjectZip(config);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `termux-telegram-ai-orchestrator-${config.selectedModelId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onShowToast('全套 Termux 部署脚本包已成功导出！');
    } catch (err: any) {
      console.error('Zip generation failed:', err);
      onShowToast('导出失败，请重试');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
      {/* Zone 1: Single element Brand wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Terminal className="w-4 h-4" />
        </div>
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            onTabChange('deploy');
          }}
          className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap hover:text-white transition-colors"
        >
          Termux AI Orchestrator
        </a>
      </div>

      {/* Zone 2: 4-5 concise single-line text nav links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
        <button
          type="button"
          onClick={() => onTabChange('deploy')}
          className={`whitespace-nowrap transition-colors pb-0.5 ${
            currentTab === 'deploy'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          一键部署生成器
        </button>
        <button
          type="button"
          onClick={() => onTabChange('models')}
          className={`whitespace-nowrap transition-colors pb-0.5 ${
            currentTab === 'models'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          端侧模型与算力测算
        </button>
        <button
          type="button"
          onClick={() => onTabChange('sandbox')}
          className={`whitespace-nowrap transition-colors pb-0.5 ${
            currentTab === 'sandbox'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          Telegram Bot 仿真
        </button>
        <button
          type="button"
          onClick={() => onTabChange('engine')}
          className={`whitespace-nowrap transition-colors pb-0.5 flex items-center gap-1.5 ${
            currentTab === 'engine'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          <span>数理公式与持久自运行</span>
          <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-cyan-500/20 text-cyan-300 font-mono">1万轮</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange('tasks')}
          className={`whitespace-nowrap transition-colors pb-0.5 ${
            currentTab === 'tasks'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          内容生成与调度
        </button>
        <button
          type="button"
          onClick={() => onTabChange('troubleshoot')}
          className={`whitespace-nowrap transition-colors pb-0.5 ${
            currentTab === 'troubleshoot'
              ? 'text-cyan-400 border-b-2 border-cyan-400 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          排错与常见问题
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-cyan-400 rounded-md hover:bg-cyan-300 transition-colors whitespace-nowrap shadow-sm disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{downloading ? '打包中...' : '下载完整包 (.ZIP)'}</span>
          <span className="sm:hidden">{downloading ? '打包中' : '下载ZIP'}</span>
        </button>
      </div>
    </header>
    {/* Mobile Horizontal Navigation Strip */}
    <div className="md:hidden flex items-center gap-2 px-4 py-2 bg-slate-950/95 border-b border-slate-900 overflow-x-auto text-xs whitespace-nowrap no-scrollbar sticky top-[57px] z-40">
      <button
        type="button"
        onClick={() => onTabChange('deploy')}
        className={`px-2.5 py-1 rounded transition-colors ${
          currentTab === 'deploy'
            ? 'bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/30'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        一键部署
      </button>
      <button
        type="button"
        onClick={() => onTabChange('models')}
        className={`px-2.5 py-1 rounded transition-colors ${
          currentTab === 'models'
            ? 'bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/30'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        模型测算
      </button>
      <button
        type="button"
        onClick={() => onTabChange('sandbox')}
        className={`px-2.5 py-1 rounded transition-colors ${
          currentTab === 'sandbox'
            ? 'bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/30'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        Bot 仿真
      </button>
      <button
        type="button"
        onClick={() => onTabChange('engine')}
        className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
          currentTab === 'engine'
            ? 'bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/30'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <span>数理公式与持久自运行</span>
        <span className="px-1 py-0.2 text-[9px] rounded-full bg-cyan-500/20 text-cyan-300 font-mono">1万轮</span>
      </button>
      <button
        type="button"
        onClick={() => onTabChange('tasks')}
        className={`px-2.5 py-1 rounded transition-colors ${
          currentTab === 'tasks'
            ? 'bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/30'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        内容生成
      </button>
      <button
        type="button"
        onClick={() => onTabChange('troubleshoot')}
        className={`px-2.5 py-1 rounded transition-colors ${
          currentTab === 'troubleshoot'
            ? 'bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/30'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        排错诊断
      </button>
    </div>
    </>
  );
};
