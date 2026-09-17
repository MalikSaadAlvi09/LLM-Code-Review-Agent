export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
export type EvidenceSource = 'AI Review' | 'Compiler' | 'Linter' | 'Dependency Scanner' | 'Test Runner';
export type FindingStatus = 'confirmed' | 'suspected';
export type LocationType = 'line' | 'file' | 'project';

export type FindingState = 'suspected' | 'tool_reported' | 'reproduced' | 'suggested_fix' | 'applied_fix' | 'validated';
export type ValidationStatus = 'passed' | 'failed' | 'unavailable' | 'not_run';

export interface PatchInfo {
  patchId: string;
  diff: string;
  replacementCode: string;
  originalHash: string;
  status: 'suggested' | 'applied' | 'conflict' | 'reverted';
  appliedAt?: string;
}

export interface ReproductionTestInfo {
  framework: string;
  testCode: string;
  runResult?: {
    baselineFailed: boolean;
    postFixPassed: boolean;
    exitCode: number;
    output: string;
    isExecutedInSandbox: boolean;
  };
}

export interface SuppressionInfo {
  isSuppressed: boolean;
  reason?: string;
  suppressedBy?: string;
  timestamp?: string;
}

export interface SecretInfo {
  detected: boolean;
  category?: string;
  maskedSnippet?: string;
  remediationAdvice?: string;
}

export interface Finding {
  id?: string;
  line: number;
  startLine?: number;
  endLine?: number;
  column?: number;
  file?: string;
  scope?: string;
  codeSnippet?: string;
  title: string;
  severity: SeverityLevel | 'bug' | 'logic' | 'style';
  category?: string;
  language?: string;
  evidenceSource?: EvidenceSource;
  status?: FindingStatus;
  findingState?: FindingState;
  validationStatus?: ValidationStatus;
  description: string;
  triggerImpact?: string;
  suggested_fix: string;
  fixExplanation?: string;
  uncertaintyNote?: string;
  locationType?: LocationType;
  commitSha?: string;
  callerLocation?: { file: string; line: number };
  handlerLocation?: { file: string; line: number };
  patch?: PatchInfo;
  reproductionTest?: ReproductionTestInfo;
  suppression?: SuppressionInfo;
  secretInfo?: SecretInfo;
}

export interface CustomRule {
  id: string;
  name: string;
  category: string;
  pattern: string;
  severity: SeverityLevel;
  description: string;
  enabled: boolean;
}

export interface PullRequestFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface PullRequestInfo {
  repoOwner: string;
  repoName: string;
  prNumber: number;
  title: string;
  branch: string;
  headSha: string;
  baseSha: string;
  changedFiles: PullRequestFile[];
}

export interface ReviewResult {
  summary: string;
  findings: Finding[];
  qualityScore: number;
  verdict: 'Needs Improvement' | 'Approved' | 'Critical Issues';
  languagesSummary?: Record<string, number>;
  filesDiscovered?: number;
  filesReviewed?: number;
  filesSkipped?: number;
  filesFailed?: number;
  coverageDetails?: {
    skippedFiles?: { path: string; reason: string }[];
    failedFiles?: { path: string; reason: string }[];
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ReviewSession {
  id: string;
  projectId: string;
  filename: string;
  sourceCode: string;
  model: string;
  review: ReviewResult;
  messages: ChatMessage[];
  createdAt: string;
}

export type ProjectSourceType = 'folder' | 'zip' | 'files' | 'github' | 'pasted';

export interface ImportedCodeFile {
  id: string;
  path: string;
  name: string;
  extension: string;
  language: string;
  size: number;
  content: string;
  selected: boolean;
  status: 'ready' | 'ignored' | 'unsupported' | 'error';
  reason?: string;
}

export interface ImportedProject {
  id: string;
  name: string;
  sourceType: ProjectSourceType;
  files: ImportedCodeFile[];
  repository?: {
    owner: string;
    name: string;
    url: string;
    branch: string;
    commitSha?: string;
    isPrivate?: boolean;
  };
  createdAt: string;
}

export const IMPORT_LIMITS = {
  maxSingleFileBytes: 2 * 1024 * 1024,
  maxArchiveBytes: 50 * 1024 * 1024,
  maxExtractedBytes: 200 * 1024 * 1024,
  maxFileCount: 5000,
  maxReviewFilesPerRequest: 100,
} as const;

export interface OpenRouterModelInfo {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt: string;
    completion: string;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
  tags?: string[];
  provider?: string;
}

export interface OpenRouterConfig {
  apiKey: string;
  selectedModel: string;
  customModelName?: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  isEnabled: boolean;
  providerType: 'gemini' | 'openrouter';
  updatedAt?: any;
}

export const POPULAR_OPENROUTER_MODELS: OpenRouterModelInfo[] = [
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'NVIDIA Nemotron 70B Instruct',
    description: 'Custom customized Llama 3.1 70B model by NVIDIA, optimized for exceptional code review, deep reasoning, and math synthesis.',
    context_length: 131072,
    provider: 'NVIDIA',
    tags: ['Nemotron', '70B', 'Top Coding & Review', 'Reasoning', 'Open Weights']
  },
  {
    id: 'nvidia/nemotron-4-340b-instruct',
    name: 'NVIDIA Nemotron-4 340B Instruct',
    description: 'Massive open 340B parameter synthetic data generator & reasoning model tailored for enterprise code architecture.',
    context_length: 4096,
    provider: 'NVIDIA',
    tags: ['Nemotron', '340B', 'Enterprise Architecture']
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Meta Llama 3.3 70B Instruct',
    description: 'State-of-the-art open weights flagship model matching 405B capabilities on code and reasoning with 128k context.',
    context_length: 131072,
    provider: 'Meta',
    tags: ['Llama 3.3', '70B', 'Open Source', 'Fast']
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B Instruct',
    description: 'Specialized code generation, AST analysis, and security bug hunting open model supporting 128k context.',
    context_length: 131072,
    provider: 'Qwen',
    tags: ['Qwen', 'Coder', '32B', 'Code Specialist']
  },
  {
    id: 'qwen/qwen-2.5-72b-instruct',
    name: 'Qwen 2.5 72B Instruct',
    description: 'Flagship multilingual reasoning and Python architecture model with high accuracy across standard benchmarks.',
    context_length: 131072,
    provider: 'Qwen',
    tags: ['Qwen', '72B', 'High Performance']
  },
  {
    id: 'mistralai/codestral-2501',
    name: 'Mistral Codestral 25.01',
    description: 'Mistral state-of-the-art code completion and review model optimized for 80+ programming languages.',
    context_length: 256000,
    provider: 'Mistral AI',
    tags: ['Codestral', 'Code Master', '256k Context']
  },
  {
    id: 'mistralai/mistral-large-2407',
    name: 'Mistral Large 2',
    description: 'Top-tier reasoning and code synthesis model with multi-lingual precision and reasoning capabilities.',
    context_length: 128000,
    provider: 'Mistral AI',
    tags: ['Mistral Large', 'General Intelligence']
  },
  {
    id: 'deepseek/deepseek-r1',
    name: 'DeepSeek R1 Reasoning',
    description: 'Advanced open-weight reasoning model employing reinforcement learning for complex multi-step code and mathematical proofs.',
    context_length: 64000,
    provider: 'DeepSeek',
    tags: ['DeepSeek', 'Reasoning', 'R1']
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    description: 'High-speed MoE model with 671B total parameters (37B active) for fast, cost-effective Python code reviews.',
    context_length: 64000,
    provider: 'DeepSeek',
    tags: ['DeepSeek', 'MoE', 'V3']
  }
];

export type AppTheme = 'light' | 'dark' | 'midnight' | 'emerald' | 'cyberpunk' | 'sunset';

export interface ThemeOption {
  id: AppTheme;
  name: string;
  description: string;
  bgPreview: string;
  borderPreview: string;
  accentPreview: string;
  isDark: boolean;
}

export const AVAILABLE_THEMES: ThemeOption[] = [
  {
    id: 'light',
    name: 'Light Modern',
    description: 'Clean, crisp light interface with high-contrast slate details.',
    bgPreview: 'bg-neutral-100',
    borderPreview: 'border-neutral-300',
    accentPreview: 'bg-neutral-950',
    isDark: false,
  },
  {
    id: 'dark',
    name: 'Dark Slate',
    description: 'Sleek dark mode with balanced neutral slate surfaces.',
    bgPreview: 'bg-slate-900',
    borderPreview: 'border-slate-700',
    accentPreview: 'bg-amber-400',
    isDark: true,
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    description: 'Deep ocean dark mode with rich indigo & sapphire accents.',
    bgPreview: 'bg-slate-950',
    borderPreview: 'border-indigo-900/80',
    accentPreview: 'bg-indigo-500',
    isDark: true,
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    description: 'Vibrant matrix & terminal inspired deep emerald theme.',
    bgPreview: 'bg-zinc-950',
    borderPreview: 'border-emerald-900/80',
    accentPreview: 'bg-emerald-400',
    isDark: true,
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    description: 'Futuristic dark aesthetic with purple glow & cyan highlights.',
    bgPreview: 'bg-gray-950',
    borderPreview: 'border-purple-800/80',
    accentPreview: 'bg-cyan-400',
    isDark: true,
  },
  {
    id: 'sunset',
    name: 'Sunset Amber',
    description: 'Warm cozy dark theme with rich amber & rose accents.',
    bgPreview: 'bg-stone-950',
    borderPreview: 'border-amber-900/80',
    accentPreview: 'bg-amber-500',
    isDark: true,
  },
];

