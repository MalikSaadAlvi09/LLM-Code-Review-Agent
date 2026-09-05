export interface Finding {
  line: number;
  title: string;
  severity: 'bug' | 'logic' | 'style';
  description: string;
  suggested_fix: string;
}

export interface ReviewResult {
  summary: string;
  findings: Finding[];
  qualityScore: number;
  verdict: 'Needs Improvement' | 'Approved' | 'Critical Issues';
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
