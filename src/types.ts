export type TabType = 'deploy' | 'models' | 'sandbox' | 'engine' | 'tasks' | 'troubleshoot';

export interface FormulaTemplate {
  id: string;
  category: string;
  name: string;
  formula_expr: string;
  parameters: Record<string, any>;
  confidence: number;
  backtestAccuracy?: string;
  is_active: boolean;
  description: string;
  updated_at: string;
}

export interface PersistentCalcResult {
  targetExpect: string;
  sampleSize: number;
  iterations: number;
  convergenceScore: number;
  activeRulesCount: number;
  numCodes: number;
  recommendedPool: number[];
  recommendedDan: number[];
  recommendedRebound: number[];
  recommendedBalanced: number[];
  combinations: Array<{
    name: string;
    regulars: number[];
    special: number;
  }>;
  rankedNumbers: Array<{
    number: number;
    probability: number;
    percentage: number;
    simHits: number;
    omission: number;
    frequency: number;
  }>;
  calculatedAt: string;
}

export interface BacktestResult {
  testDrawsCount: number;
  numCodes: number;
  avgRegularHitsPerDraw: number;
  specialCodeHitRate: string;
  poolCoverageRateGe3: string;
  regularHitDistribution: Record<string, number>;
  recentSamples: Array<{
    expect: string;
    openCode: string;
    matchedReg: number;
    matchedSp: boolean;
  }>;
  summary: string;
}

export interface BotConfig {
  botToken: string;
  adminChatId: string;
  selectedModelId: string;
  backendEngine: 'llamacpp' | 'ollama' | 'llama-cpp-python';
  threads: number;
  contextSize: number;
  port: number;
  temperature: number;
  enableTaskDb: boolean;
  enableCronScheduler: boolean;
  enableSystemMonitor: boolean;
  adminOnly: boolean;
  systemPrompt: string;
  pureMathMode?: boolean; // 纯数学与确定性算法模式 (零大模型/防幻觉，直接调用高维数学与蒙特卡洛矩阵)
  persistentDaemonEnabled?: boolean; // 后台 24/7 持久运行守护进程 (自动监听开奖/自动回测/贝叶斯自进化/自动推送)
}

export interface ModelSpec {
  id: string;
  name: string;
  parameters: string;
  sizeGb: number;
  minRamGb: number;
  recommendedRamGb: number;
  quantization: string;
  downloadUrlHuggingFace: string;
  downloadUrlModelScope: string;
  filename: string;
  description: string;
  avgTokensPerSec: string;
  features: string[];
  recommendedContext: number;
}

export interface ChipTier {
  name: string;
  category: 'Flagship' | 'High-End' | 'Mid-Range' | 'Entry';
  estimatedSpeedMultiplier: number;
  recommendedThreads: number;
  typicalSoC: string[];
}

export interface TelegramMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: string;
  metrics?: {
    latencyMs: number;
    estimatedTokens: number;
    tokensPerSecond: number;
    model: string;
    quantization: string;
    engine: string;
  };
  commandUsed?: string;
}

export interface ContentTaskTemplate {
  id: string;
  name: string;
  icon: string;
  category: 'daily' | 'social' | 'devops' | 'notes';
  defaultTopic: string;
  systemPromptAddon: string;
  description: string;
  cronExpression: string;
}
