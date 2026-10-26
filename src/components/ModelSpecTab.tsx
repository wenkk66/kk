import React, { useState } from 'react';
import { BotConfig } from '../types';
import { GGUF_MODELS, CHIP_TIERS } from '../data/modelsData';
import {
  Cpu,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Download,
  Flame,
  Check,
  Shield,
  Layers,
} from 'lucide-react';

interface ModelSpecTabProps {
  config: BotConfig;
  onChangeConfig: (newConfig: BotConfig) => void;
  onShowToast: (msg: string) => void;
}

export const ModelSpecTab: React.FC<ModelSpecTabProps> = ({
  config,
  onChangeConfig,
  onShowToast,
}) => {
  const [deviceRamGb, setDeviceRamGb] = useState<number>(8);
  const [selectedChipTierIndex, setSelectedChipTierIndex] = useState<number>(0);

  const currentChip = CHIP_TIERS[selectedChipTierIndex];

  // Calculated usable memory (Android OS usually takes ~2.2 - 2.8 GB)
  const estimatedOsOverheadGb = 2.4;
  const availableRamForAi = Math.max(0.6, deviceRamGb - estimatedOsOverheadGb);

  return (
    <div className="space-y-6">
      {/* Intro strip */}
      <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">
          端侧大模型选型与安卓算力适配测算
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          手机端运行离线大模型的核心约束是物理内存与温控散热。利用此测算器，根据你的手机配置精准选择最流畅的量化 GGUF 模型。
        </p>
      </div>

      {/* Hardware Simulator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Hardware Input Panel (5 cols) */}
        <div className="lg:col-span-5 p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-slate-200">手机硬件参数模拟</h2>
            </div>
            <span className="text-xs text-slate-500 font-mono">ARM64 Hardware</span>
          </div>

          {/* Device Presets */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-slate-400 block font-medium">快速预设机型模板:</label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setDeviceRamGb(6);
                  setSelectedChipTierIndex(1);
                  onChangeConfig({ ...config, threads: 4, contextSize: 4096, selectedModelId: 'qwen2.5-1.5b' });
                  onShowToast('已加载三星 Galaxy Note 9 最佳调优参数 (6GB/4核/1.5B)');
                }}
                className="p-2 rounded bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/40 text-cyan-200 text-left transition-colors"
              >
                <div className="font-bold text-[11px] text-cyan-300">三星 Note 9 专享 ⭐</div>
                <div className="text-[10px] text-slate-400">6GB RAM · 4核 · 1.5B</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeviceRamGb(12);
                  setSelectedChipTierIndex(0);
                  onChangeConfig({ ...config, threads: 6, contextSize: 8192, selectedModelId: 'qwen2.5-3b' });
                  onShowToast('已加载高通骁龙 8 Gen2/3 旗舰参数 (12GB/6核/3B)');
                }}
                className="p-2 rounded bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-left transition-colors"
              >
                <div className="font-bold text-[11px] text-slate-200">高通旗舰 8 Gen 2/3</div>
                <div className="text-[10px] text-slate-400">12GB RAM · 6核 · 3B</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeviceRamGb(8);
                  setSelectedChipTierIndex(1);
                  onChangeConfig({ ...config, threads: 4, contextSize: 4096, selectedModelId: 'deepseek-r1-distill-qwen-1.5b' });
                  onShowToast('已加载主流次旗舰参数 (8GB/4核/DeepSeek-R1)');
                }}
                className="p-2 rounded bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-left transition-colors"
              >
                <div className="font-bold text-[11px] text-slate-200">主流次旗舰 (870/天玑)</div>
                <div className="text-[10px] text-slate-400">8GB RAM · 4核 · R1 1.5B</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeviceRamGb(4);
                  setSelectedChipTierIndex(3);
                  onChangeConfig({ ...config, threads: 2, contextSize: 2048, selectedModelId: 'qwen2.5-0.5b' });
                  onShowToast('已加载老旧低配备用机参数 (4GB/2核/0.5B)');
                }}
                className="p-2 rounded bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-left transition-colors"
              >
                <div className="font-bold text-[11px] text-slate-200">老旧低配备用机</div>
                <div className="text-[10px] text-slate-400">4GB RAM · 2核 · 0.5B</div>
              </button>
            </div>
          </div>

          {/* RAM Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-300">手机物理运行内存 (RAM)</label>
              <span className="text-sm font-bold font-mono text-cyan-400 tabular-nums">
                {deviceRamGb} GB
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={16}
              step={1}
              value={deviceRamGb}
              onChange={(e) => setDeviceRamGb(Number(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>3 GB (备用机)</span>
              <span>6 GB</span>
              <span>8 GB (主流)</span>
              <span>12 GB</span>
              <span>16 GB (旗舰)</span>
            </div>
          </div>

          {/* Chip tier */}
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              手机处理器芯片梯队
            </label>
            <select
              value={selectedChipTierIndex}
              onChange={(e) => setSelectedChipTierIndex(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-cyan-500/60"
            >
              {CHIP_TIERS.map((chip, idx) => (
                <option key={chip.name} value={idx}>
                  {chip.name}
                </option>
              ))}
            </select>
            <div className="mt-2 text-[11px] text-slate-400 space-y-1">
              <div className="text-slate-500">代表机型: {currentChip.typicalSoC.join(', ')}</div>
              <div className="text-slate-400">
                推荐推理线程数:{' '}
                <span className="text-cyan-400 font-mono">{currentChip.recommendedThreads} 线程</span>
              </div>
            </div>
          </div>

          {/* Calculated Output card */}
          <div className="p-4 rounded-md bg-slate-950 border border-slate-800/80 space-y-3">
            <h3 className="text-xs font-semibold text-slate-300">算力诊断与内存分配测算</h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>安卓系统与底层底噪占用:</span>
                <span className="font-mono tabular-nums text-slate-300">~{estimatedOsOverheadGb} GB</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>可用端侧模型显存上限:</span>
                <span className="font-mono tabular-nums text-emerald-400 font-semibold">
                  {availableRamForAi.toFixed(1)} GB
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>建议部署模型参数量:</span>
                <span className="font-mono text-cyan-400 font-medium">
                  {deviceRamGb < 4
                    ? '0.5B 极轻量'
                    : deviceRamGb <= 6
                    ? '1.5B ~ 1.7B 黄金甜点'
                    : deviceRamGb <= 10
                    ? '1.5B 或 3B 深度创作'
                    : '3B ~ 7B 旗舰全开'}
                </span>
              </div>
            </div>

            {/* Thermal Note */}
            <div className="pt-2 border-t border-slate-800/80 flex items-start gap-2 text-[11px] text-slate-400">
              <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                在室温 25°C 环境下，建议单次请求上下文控制在 4096 tokens 内，可确保手机不发烫、全天候 24h 稳定后台待机。
              </span>
            </div>
          </div>
        </div>

        {/* Model Matrix Cards (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">
              主流端侧 GGUF 模型兼容性对比
            </h2>
            <span className="text-xs text-slate-500 font-mono">共 {GGUF_MODELS.length} 款推荐</span>
          </div>

          <div className="space-y-3">
            {GGUF_MODELS.map((model) => {
              const isSelected = config.selectedModelId === model.id;
              const isRecommended = deviceRamGb >= model.minRamGb;
              const isTight = deviceRamGb < model.minRamGb;

              return (
                <div
                  key={model.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-cyan-500/60 shadow-sm'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-100">{model.name}</span>
                      <span className="text-xs font-mono text-slate-500">·</span>
                      <span className="text-xs font-mono text-cyan-400">{model.quantization}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isTight ? (
                        <span className="text-[11px] text-amber-400 flex items-center gap-1 font-mono">
                          <AlertTriangle className="w-3 h-3" />
                          需扩容 ZRAM
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                          <CheckCircle2 className="w-3 h-3" />
                          完美适配
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onChangeConfig({ ...config, selectedModelId: model.id });
                          onShowToast(`已选择 ${model.name} 为目标部署模型`);
                        }}
                        className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                          isSelected
                            ? 'bg-cyan-400 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {isSelected ? '当前选定' : '选定此模型'}
                      </button>
                    </div>
                  </div>

                  {/* Body description */}
                  <p className="text-xs text-slate-400 mt-2.5 leading-relaxed">{model.description}</p>

                  {/* Metrics bar */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 font-mono">
                    <div>
                      <span className="text-slate-500">模型大小: </span>
                      <span className="text-slate-200 tabular-nums">{model.sizeGb} GB</span>
                    </div>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <div>
                      <span className="text-slate-500">最低手机内存: </span>
                      <span className="text-slate-200 tabular-nums">{model.minRamGb} GB</span>
                    </div>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <div>
                      <span className="text-slate-500">预估推理速度: </span>
                      <span className="text-cyan-400">{model.avgTokensPerSec}</span>
                    </div>
                  </div>

                  {/* Feature tags (unboxed text) */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span className="text-slate-500">特色能力:</span>
                    {model.features.map((feat, i) => (
                      <React.Fragment key={feat}>
                        {i > 0 && <span aria-hidden="true" className="text-slate-600">/</span>}
                        <span className="text-slate-300">{feat}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Android Background Survival Secrets */}
          <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 text-xs space-y-2">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              安卓系统常驻不被杀后台的 3 大关键配置
            </h3>
            <ul className="space-y-1.5 text-slate-400 pl-1">
              <li>
                <span className="text-slate-200 font-medium">1. 关闭电池省电策略：</span>
                在系统设置 → 应用管理 → Termux → 省电策略/电池优化中，设置为「无限制」或「允许完全后台运行」。
              </li>
              <li>
                <span className="text-slate-200 font-medium">2. 锁定后台任务卡片：</span>
                在手机多任务后台界面中，长按 Termux 卡片并点击「加锁图标」，防止一键清理内存时被划掉。
              </li>
              <li>
                <span className="text-slate-200 font-medium">3. 开启 Termux 唤醒锁：</span>
                在手机下拉通知栏看到 Termux 时点击「Acquire Wakelock」，或运行 <code className="text-cyan-400">termux-wake-lock</code>。
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
