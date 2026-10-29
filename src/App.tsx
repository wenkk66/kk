import React, { useState } from 'react';
import { BotConfig, TabType } from './types';
import { Header } from './components/Header';
import { DeployConfigTab } from './components/DeployConfigTab';
import { ModelSpecTab } from './components/ModelSpecTab';
import { TelegramSimulatorTab } from './components/TelegramSimulatorTab';
import { AiEngineTab } from './components/AiEngineTab';
import { ContentTasksTab } from './components/ContentTasksTab';
import { TroubleshootTab } from './components/TroubleshootTab';
import { Check, ShieldCheck, Terminal, Cpu } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<TabType>('deploy');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [config, setConfig] = useState<BotConfig>({
    botToken: '',
    adminChatId: '',
    selectedModelId: 'deepseek-r1-distill-qwen-7b',
    backendEngine: 'llamacpp',
    threads: 6,
    contextSize: 4096,
    port: 8080,
    temperature: 0.7,
    enableTaskDb: true,
    enableCronScheduler: true,
    enableSystemMonitor: true,
    adminOnly: false,
    pureMathMode: false,
    persistentDaemonEnabled: true,
    systemPrompt:
      '你是一个运行在 Android Termux 手机终端中的离线人工智能助手兼 Telegram Bot。你拥有扎实的中文理解能力、逻辑分析能力与文案排版能力，能够协助用户执行长文撰写、待办备忘、指令自动化以及日常知识问答。输出请使用清晰优雅的 Markdown 格式。',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar following Top Bar Contract */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        config={config}
        onShowToast={showToast}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'deploy' && (
          <DeployConfigTab
            config={config}
            onChangeConfig={setConfig}
            onShowToast={showToast}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'models' && (
          <ModelSpecTab
            config={config}
            onChangeConfig={setConfig}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'sandbox' && (
          <TelegramSimulatorTab
            config={config}
            onShowToast={showToast}
          />
        )}

        {currentTab === 'engine' && (
          <AiEngineTab
            config={config}
            onShowToast={showToast}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'tasks' && (
          <ContentTasksTab
            config={config}
            onShowToast={showToast}
            onNavigateTab={setCurrentTab}
          />
        )}

        {currentTab === 'troubleshoot' && (
          <TroubleshootTab onShowToast={showToast} />
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-md bg-slate-900 border border-cyan-500/50 text-cyan-200 text-xs shadow-xl animate-fade-in">
          <Check className="w-3.5 h-3.5 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-slate-900 px-6 py-5 text-center text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>Termux 离线 AI 与 Telegram Bot 智能运维工作台</span>
          <span aria-hidden="true">·</span>
          <span>ARM64 Native llama.cpp & Python 异步引擎</span>
          <span aria-hidden="true">·</span>
          <span>100% 离线隐私数据保密</span>
        </div>
      </footer>
    </div>
  );
}
