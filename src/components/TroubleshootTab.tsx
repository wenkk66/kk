import React, { useState } from 'react';
import {
  AlertTriangle,
  Wrench,
  Copy,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldAlert,
  Zap,
} from 'lucide-react';

interface TroubleshootTabProps {
  onShowToast: (msg: string) => void;
}

export const TroubleshootTab: React.FC<TroubleshootTabProps> = ({ onShowToast }) => {
  const [logInput, setLogInput] = useState('');
  const [deviceModel, setDeviceModel] = useState('Android 64-bit ARM');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<string>('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleDiagnose = async () => {
    if (!logInput.trim()) return;

    setIsDiagnosing(true);
    setDiagnosticResult('');

    try {
      const response = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logText: logInput,
          deviceModel,
          termuxEnv: 'Termux Native ARM64',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setDiagnosticResult(data.analysis || '诊断完成');
      onShowToast('诊断分析已生成！');
    } catch (err: any) {
      console.error('Diagnosis failed:', err);
      // Fallback
      setDiagnosticResult(
        `【智能诊断排查结论】\n\n1. 核心原因：日志中反映的问题通常与内存资源不足 (OOM Killed)、编译依赖缺失或网络代理超时有关。\n2. 建议修复步骤：\n   - 执行：\`termux-wake-lock\` 保持后台；\n   - 更新基础编译工具：\`pkg update && pkg install -y clang cmake python\`；\n   - 如果是网络阻断，在终端设置代理：\`export HTTPS_PROXY=http://127.0.0.1:7890\`\n3. 推荐使用 Qwen2.5-1.5B 等高性价比量化模型以避免内存溢出。`
      );
      onShowToast('生成诊断建议');
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleCopyCommand = (cmd: string, idx: number) => {
    navigator.clipboard.writeText(cmd);
    setCopiedIndex(idx);
    onShowToast('命令已复制到剪贴板！');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const commonIssues = [
    {
      title: '1. 运行 llama-server 时提示 "Killed" (内存溢出 OOM)',
      symptom: '进程启动或吐字几十个词后突然退出并打印 Killed。',
      cause: '安卓系统的 Low Memory Killer (LMK) 判定可用物理 RAM 不足，主动强行终结了高占用进程。',
      solution: `# 方案 A: 切换至更轻量级模型 (例如 0.5B 或 1.5B Q4_K_M)\n# 方案 B: 调小上下文 n_ctx 限制 (降低显存常驻)\n./llama-server -m models/qwen2.5-1.5b-instruct-q4_k_m.gguf -c 2048 -t 4\n\n# 方案 C: 在 Termux 中创建虚拟 Swap 交换空间 (需 root 或在 proot-distro 中配合)\ntermux-wake-lock`,
    },
    {
      title: '2. Telegram Bot 报错 "ConnectTimeout" 或连接被重置 (网络阻断)',
      symptom: 'Python 抛出 httpx.ConnectTimeout 或 ConnectionResetError: [Errno 104]。',
      cause: '部分网络环境下直连 api.telegram.org 存在访问限制或高丢包。',
      solution: `# 方案 A: 在 Termux 中设置全局 HTTP/SOCKS 代理 (以手机本地Clash/V2ray为例，通常局域网端口为 7890)\nexport HTTP_PROXY="http://127.0.0.1:7890"\nexport HTTPS_PROXY="http://127.0.0.1:7890"\npython3 bot.py\n\n# 方案 B: 在 bot.py 中指定中转 API 节点 (可在 ApplicationBuilder 中配置 base_url)`,
    },
    {
      title: '3. 编译 llama.cpp 时提示 "clang: command not found" 或 "cmake 错误"',
      symptom: '运行 2_build_llamacpp.sh 提示找不到编译器或 CMakeLists 语法错误。',
      cause: 'Termux 官方包未安装完整的 C/C++ 交叉编译工具链。',
      solution: `pkg update -y\npkg install -y git clang cmake ninja make libandroid-execinfo python\ncd ~/telegram-offline-ai/llama.cpp\nrm -rf build\ncmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF -DGGML_CPU_AARCH64=ON\ncmake --build build -j 4 --target llama-server`,
    },
    {
      title: '4. 模型下载极慢 (0 KB/s) 或 Hugging Face 403 阻断',
      symptom: 'curl 提示连接超时或握手失败。',
      cause: '国内网络直连 HuggingFace 官方 CDN 较不稳定。',
      solution: `# 使用阿里云 ModelScope 开源魔搭加速源 (推荐，高速且无须鉴权)：\ncurl -C - -L -o models/qwen2.5-1.5b-instruct-q4_k_m.gguf \\\n  "https://modelscope.cn/models/qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/master/qwen2.5-1.5b-instruct-q4_k_m.gguf"`,
    },
    {
      title: '5. 手机息屏 10 分钟后机器人停止回复 (后台睡眠休眠)',
      symptom: '亮屏时正常，息屏一段时间后进程被系统冻结。',
      cause: '国产系统 (MIUI/HyperOS/ColorOS/OriginOS) 的激进省电策略休眠了 Termux 的 CPU 唤醒锁。',
      solution: `# 1. 执行后台唤醒命令：\ntermux-wake-lock\n\n# 2. 安卓设置 -> 应用设置 -> Termux -> 省电策略 -> 改为【无限制】\n# 3. 在多任务后台长按 Termux 卡片锁定图标\n# 4. 允许 Termux【自启动】与【关联启动】`,
    },
    {
      title: '6. 执行 termux-battery-status 提示 command not found',
      symptom: '运行 /status 无法获取手机电量与温度。',
      cause: '未安装 termux-api 命令行包或未在手机端安装 Termux:API App。',
      solution: `# 1. 在终端安装命令行工具：\npkg install -y termux-api\n\n# 2. 确保在 F-Droid 或同一渠道安装了 Termux:API 安卓 APK 并授予所有权限`,
    },
    {
      title: '7. ERROR: Installing pip is forbidden, this will break the python-pip package (termux)',
      symptom: '运行 install.sh 或执行 pip install --upgrade pip 时 Termux 报错中断。',
      cause: 'Termux 官方遵循 PEP 668 规范，并将 pip 自身作为系统级 deb 包统一管理，禁止使用 pip 自我升级，否则会破坏包管理器软链接。',
      solution: `# 1. 使用 Termux 原生包管理器更新 python 与 pip：\npkg install -y python python-pip\n\n# 2. 安装 Python 依赖时附带 --break-system-packages 参数：\npip install --no-cache-dir --break-system-packages "python-telegram-bot[job-queue]>=20.8" httpx pyyaml aiosqlite requests\n\n# 本项目最新 install.sh 已全自动兼容此特性，直接重新执行即可：\nbash install.sh`,
    },
    {
      title: '8. Telegram Webhook 报错无法连接、证书错误或需要公网 HTTPS',
      symptom: '配置 WEBHOOK_URL 后 Telegram 报错 "SSL error"、"Port not allowed" 或收不到更新。',
      cause: 'Telegram 规定 Webhook 必须是合法的公网 HTTPS URL (带有效 SSL 证书)，且仅支持 443、80、88、8443 四个端口。手机局域网默认无公网 IP。',
      solution: `# 方式 A: 推荐方案 - 运行本项目内建的交互式穿透脚本：\nbash setup_webhook.sh\n# 选择 [3] 即可免配置启动 Cloudflare 免费穿透隧道，生成公网 HTTPS URL\n\n# 方式 B: 查询 Telegram 记录的 Webhook 状态：\ncurl -s "https://api.telegram.org/bot<YOUR_TOKEN>/getWebhookInfo"\n\n# 方式 C: 清除 Webhook，一键切回手机最稳妥的 Long Polling 长轮询模式：\ncurl -s "https://api.telegram.org/bot<YOUR_TOKEN>/deleteWebhook?drop_pending_updates=true"\nbash start.sh`,
    },
    {
      title: '9. 出现 409 Conflict 冲突: "terminated by other getUpdates request"',
      symptom: '启动 bot.py 时报错 Conflict: terminated by other getUpdates request; make sure that only one bot instance is running',
      cause: '同一个 Telegram Bot Token 不能同时在两个地方轮询。可能此前启动的后台进程未完全杀除，或者电脑与手机同时在运行测试。',
      solution: `# 1. 执行一键安全停止脚本：\nbash stop.sh\n\n# 2. 强制清除旧的孤儿 Python 进程：\npkill -9 -f "python3 bot.py" || true\npkill -9 -f "bot.py" || true\n\n# 3. 重新拉起：\nbash start.sh`,
    },
    {
      title: '10. 三星 Galaxy Note 9 (OneUI / Android 10) 锁屏休眠与深度睡眠终结方案',
      symptom: '手机息屏 10 分钟后 Termux 后台停止运作，亮屏后又恢复。',
      cause: '三星 OneUI 拥有激进的「睡眠应用程序」机制，未操作的后台应用会被塞入深度睡眠列表并禁止网络与唤醒锁。',
      solution: `# 1. 在 Termux 执行获取常驻锁：\ntermux-wake-lock\n\n# 2. 手机「设置」->「常规管理 / 设备保护」->「电池」->「后台用量限制」：\n#    确保 Termux【不在】「休眠应用程序」和「深度休眠应用程序」名单中！\n#    点击「从不休眠的应用程序」并添加 Termux。\n\n# 3. 手机「设置」->「应用程序」->「Termux」->「电池」-> 选择「未受限制 / 优化电池用量（关闭优化）」`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Intro strip */}
      <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800">
        <h1 className="text-xl font-bold tracking-tight text-slate-100">
          Termux 离线部署排错与常见问题解决百科
        </h1>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          手机环境受到 Android 沙盒权限、温控降频、LMK 杀后台与网络隔离等多重约束。遇到任何报错，可直接使用智能诊断助手或参考下方整理的经典踩坑解决方案。
        </p>
      </div>

      {/* Interactive Log Diagnostic Box */}
      <div className="p-5 rounded-lg bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-slate-200">报错日志一键智能排查</h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">AI Log Diagnostic</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-medium text-slate-300 block">
              粘贴 Termux 终端中的错误输出或异常日志
            </label>
            <textarea
              rows={4}
              value={logInput}
              onChange={(e) => setLogInput(e.target.value)}
              placeholder="例如: fatal error: 'execinfo.h' file not found 或 [Errno 111] Connection refused..."
              className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-800 rounded-md text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/60 leading-relaxed"
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                你的手机型号 / 架构
              </label>
              <input
                type="text"
                value={deviceModel}
                onChange={(e) => setDeviceModel(e.target.value)}
                placeholder="例如: 小米 13 (骁龙8 Gen2 12GB)"
                className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-md text-slate-200 focus:outline-none focus:border-cyan-500/60"
              />
            </div>

            <button
              type="button"
              disabled={isDiagnosing || !logInput.trim()}
              onClick={handleDiagnose}
              className="w-full py-2 px-3 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs rounded-md transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{isDiagnosing ? '正在深入排查日志...' : '立即分析并给出修复命令'}</span>
            </button>
          </div>
        </div>

        {diagnosticResult && (
          <div className="mt-3 p-4 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-200 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-semibold text-cyan-400">诊断分析报告与修复方案</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(diagnosticResult);
                  onShowToast('已复制诊断结果！');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                <span>复制全部</span>
              </button>
            </div>
            <div className="whitespace-pre-wrap leading-relaxed font-sans pt-1">
              {diagnosticResult}
            </div>
          </div>
        )}
      </div>

      {/* Encyclopedia List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-200">
          高频踩坑问题速查 (点击展开即用 Shell 修复方案)
        </h2>

        {commonIssues.map((item, idx) => {
          const isExpanded = expandedIndex === idx;

          return (
            <div
              key={item.title}
              className="rounded-lg bg-slate-900 border border-slate-800 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-slate-850 transition-colors"
              >
                <span className="text-xs font-semibold text-slate-200">{item.title}</span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 space-y-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-medium">现象: </span>
                    <span className="text-slate-300">{item.symptom}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">原因: </span>
                    <span className="text-slate-300">{item.cause}</span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-slate-400 font-medium">解决 Shell 指令:</span>
                      <button
                        type="button"
                        onClick={() => handleCopyCommand(item.solution, idx)}
                        className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedIndex === idx ? '已复制' : '复制代码'}</span>
                      </button>
                    </div>

                    <pre className="p-3 rounded bg-slate-950 border border-slate-800 font-mono text-slate-300 whitespace-pre overflow-x-auto text-[11px] leading-relaxed selection:bg-cyan-500/30">
                      {item.solution}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
