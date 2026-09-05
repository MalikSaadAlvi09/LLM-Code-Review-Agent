import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Cpu, 
  Check, 
  Sparkles, 
  RefreshCw, 
  Sliders, 
  Cloud, 
  ShieldCheck, 
  ExternalLink, 
  Eye, 
  EyeOff, 
  Zap, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Search, 
  Code2, 
  Terminal, 
  Info,
  Server,
  Play,
  Palette
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { POPULAR_OPENROUTER_MODELS, OpenRouterModelInfo } from '../types';

export function OpenRouterSettings() {
  const { user, openRouterConfig, saveOpenRouterConfig, signInWithGoogle, theme, setTheme, availableThemes } = useAuth();

  const [apiKey, setApiKey] = useState(openRouterConfig.apiKey || '');
  const [selectedModel, setSelectedModel] = useState(openRouterConfig.selectedModel || 'nvidia/llama-3.1-nemotron-70b-instruct');
  const [customModel, setCustomModel] = useState(openRouterConfig.customModelName || '');
  const [temperature, setTemperature] = useState(openRouterConfig.temperature ?? 0.2);
  const [maxTokens, setMaxTokens] = useState(openRouterConfig.maxTokens ?? 2048);
  const [topP, setTopP] = useState(openRouterConfig.topP ?? 0.95);
  const [providerType, setProviderType] = useState<'gemini' | 'openrouter'>(openRouterConfig.providerType || 'openrouter');
  
  const [showKey, setShowKey] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [providerFilter, setProviderFilter] = useState<'all' | 'nvidia' | 'meta' | 'qwen' | 'mistral' | 'deepseek'>('all');
  
  // Dynamic models state
  const [dynamicModels, setDynamicModels] = useState<OpenRouterModelInfo[]>(POPULAR_OPENROUTER_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsFetchedCount, setModelsFetchedCount] = useState<number | null>(null);
  
  // Testing state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs?: number;
    reply?: string;
    error?: string;
    model?: string;
  } | null>(null);

  // Playground code test
  const [testCodeSnippet, setTestCodeSnippet] = useState(`def process_batch(items: list, db_pool):\n    for item in items:\n        # TODO: Potential unhandled exception\n        query = f"SELECT * FROM records WHERE id = {item['id']}"\n        db_pool.execute(query)\n    return True`);
  const [isAnalyzingTest, setIsAnalyzingTest] = useState(false);
  const [testAnalysisOutput, setTestAnalysisOutput] = useState<string | null>(null);

  // Save feedback state
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync state when openRouterConfig changes from Firestore
  useEffect(() => {
    if (openRouterConfig) {
      setApiKey(openRouterConfig.apiKey || '');
      setSelectedModel(openRouterConfig.selectedModel || 'nvidia/llama-3.1-nemotron-70b-instruct');
      setCustomModel(openRouterConfig.customModelName || '');
      setTemperature(openRouterConfig.temperature ?? 0.2);
      setMaxTokens(openRouterConfig.maxTokens ?? 2048);
      setTopP(openRouterConfig.topP ?? 0.95);
      setProviderType(openRouterConfig.providerType || 'openrouter');
    }
  }, [openRouterConfig]);

  // Fetch dynamic models from OpenRouter API
  const handleFetchDynamicModels = async () => {
    setIsLoadingModels(true);
    try {
      const res = await fetch('/api/openrouter/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.models && data.models.length > 0) {
          // Merge dynamic models with our curated list
          const combined = [...POPULAR_OPENROUTER_MODELS];
          const existingIds = new Set(POPULAR_OPENROUTER_MODELS.map(m => m.id));
          
          data.models.forEach((m: any) => {
            if (!existingIds.has(m.id)) {
              combined.push({
                id: m.id,
                name: m.name,
                description: m.description,
                context_length: m.context_length,
                pricing: m.pricing,
                provider: m.provider,
                tags: m.isOpenSource ? ['Open Source'] : []
              });
            }
          });
          setDynamicModels(combined);
          setModelsFetchedCount(data.total || data.models.length);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch dynamic models:', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const modelToTest = customModel.trim() || selectedModel;
      const res = await fetch('/api/openrouter/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          model: modelToTest
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          latencyMs: data.latencyMs,
          reply: data.reply,
          model: data.model
        });
      } else {
        setTestResult({
          success: false,
          latencyMs: data.latencyMs,
          error: data.error || 'Connection test failed. Please verify your OpenRouter API key.',
          model: modelToTest
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: err.message || 'Network error occurred while testing OpenRouter'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Run live test review
  const handleRunPlaygroundReview = async () => {
    if (!apiKey.trim()) {
      setTestResult({
        success: false,
        error: 'Please enter your OpenRouter API key before running a test analysis.'
      });
      return;
    }
    setIsAnalyzingTest(true);
    setTestAnalysisOutput(null);
    try {
      const modelToUse = customModel.trim() || selectedModel;
      const res = await fetch('/api/openrouter/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          model: modelToUse,
          code: testCodeSnippet,
          filePath: 'batch_worker.py',
          task: 'review',
          temperature
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTestAnalysisOutput(data.rawText || JSON.stringify(data.structured, null, 2));
      } else {
        setTestAnalysisOutput(`[Error]: ${data.error || 'Analysis failed'}`);
      }
    } catch (err: any) {
      setTestAnalysisOutput(`[Network Error]: ${err.message}`);
    } finally {
      setIsAnalyzingTest(false);
    }
  };

  // Save settings to Firestore and localStorage
  const handleSaveSettings = async () => {
    setSaveStatus('saving');
    try {
      const success = await saveOpenRouterConfig({
        apiKey: apiKey.trim(),
        selectedModel,
        customModelName: customModel.trim(),
        temperature,
        maxTokens,
        topP,
        isEnabled: Boolean(apiKey.trim()),
        providerType
      });

      if (success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error('Save settings error:', err);
      setSaveStatus('error');
    }
  };

  // Filter models
  const filteredModels = dynamicModels.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (providerFilter === 'all') return true;
    if (providerFilter === 'nvidia') return m.id.toLowerCase().includes('nvidia') || m.id.toLowerCase().includes('nemotron');
    if (providerFilter === 'meta') return m.id.toLowerCase().includes('llama') || m.id.toLowerCase().includes('meta');
    if (providerFilter === 'qwen') return m.id.toLowerCase().includes('qwen');
    if (providerFilter === 'mistral') return m.id.toLowerCase().includes('mistral') || m.id.toLowerCase().includes('codestral');
    if (providerFilter === 'deepseek') return m.id.toLowerCase().includes('deepseek');

    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner / Card */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-neutral-900">Model Configuration & OpenRouter</h2>
              <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Nemotron 70B & Open-Source Ready</span>
              </span>
            </div>
            <p className="text-xs text-neutral-500 leading-relaxed">
              Configure your personal OpenRouter API key to power code reviews and chats with state-of-the-art open models like <strong>NVIDIA Nemotron 70B</strong>. All settings automatically synchronize securely to your Google Cloud Firestore account.
            </p>
          </div>

          {/* Cloud Firestore Status Badge */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <div className="flex items-center gap-2 bg-blue-50/80 border border-blue-200/70 text-blue-900 px-3 py-1.5 rounded-xl text-xs">
                <Cloud className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
                <div>
                  <div className="font-semibold text-[11px]">Firestore Synced</div>
                  <div className="text-[10px] text-blue-700/80 truncate max-w-[140px]">{user.email}</div>
                </div>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-xs transition"
              >
                <Cloud className="w-3.5 h-3.5 text-amber-300" />
                <span>Sign In to Sync Firestore</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Left Column (API Key & Engine Toggle) & Right Column (Model Selector & Params) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: API Key & Provider Preferences (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active AI Provider Toggle Card */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-neutral-500" />
                <span>Active AI Inference Engine</span>
              </label>
              <span className="text-[10px] font-mono font-medium text-neutral-400">Default engine</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setProviderType('openrouter')}
                className={`p-3 rounded-xl border text-left transition ${
                  providerType === 'openrouter'
                    ? 'border-neutral-950 bg-neutral-950 text-white shadow-xs'
                    : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100/80 text-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">OpenRouter</span>
                  {providerType === 'openrouter' && <Check className="w-3.5 h-3.5 text-amber-300" />}
                </div>
                <p className={`text-[11px] ${providerType === 'openrouter' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                  Nemotron 70B, Llama 3.3, Qwen & Open Weights
                </p>
              </button>

              <button
                type="button"
                onClick={() => setProviderType('gemini')}
                className={`p-3 rounded-xl border text-left transition ${
                  providerType === 'gemini'
                    ? 'border-neutral-950 bg-neutral-950 text-white shadow-xs'
                    : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100/80 text-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Google Gemini</span>
                  {providerType === 'gemini' && <Check className="w-3.5 h-3.5 text-amber-300" />}
                </div>
                <p className={`text-[11px] ${providerType === 'gemini' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                  Gemini 3.5 Flash & 3.1 Pro Native
                </p>
              </button>
            </div>
          </div>

          {/* Appearance & Color Themes Card */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span>Appearance & Themes</span>
              </label>
              <span className="text-[10px] font-mono font-medium text-neutral-400">Synced to cloud</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {availableThemes.map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTheme(t.id)}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between space-y-2 relative overflow-hidden ${
                    theme === t.id
                      ? 'border-neutral-950 bg-neutral-950 text-white shadow-xs dark:bg-neutral-800 dark:border-neutral-700 ring-2 ring-neutral-950 dark:ring-neutral-700 ring-offset-1'
                      : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`w-4 h-4 rounded-full border ${t.borderPreview} ${t.bgPreview} flex items-center justify-center p-0.5 shadow-2xs`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${t.accentPreview}`} />
                    </div>
                    {theme === t.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">{t.name}</div>
                    <div className={`text-[10px] truncate mt-0.5 ${theme === t.id ? 'text-neutral-300' : 'text-neutral-500'}`}>
                      {t.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* OpenRouter API Key Input */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="openrouter-api-key-input" className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-600" />
                <span>OpenRouter API Key</span>
              </label>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Get API Key</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            <div className="relative">
              <input
                id="openrouter-api-key-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxx..."
                className="w-full pl-3 pr-10 py-2 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white text-neutral-900 placeholder:text-neutral-400"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 p-1"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                id="test-openrouter-key-btn"
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !apiKey.trim()}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  isTesting || !apiKey.trim()
                    ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-white shadow-2xs'
                }`}
              >
                <Zap className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : 'text-amber-300'}`} />
                <span>{isTesting ? 'Verifying Key & Model...' : 'Test Connection'}</span>
              </button>
            </div>

            {/* Test Connection Result Alert */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs space-y-1.5 animate-in fade-in duration-200 ${
                  testResult.success
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50/80 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center justify-between font-bold text-[11px]">
                  <div className="flex items-center gap-1.5">
                    {testResult.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    <span>{testResult.success ? 'Connection Successful' : 'Connection Failed'}</span>
                  </div>
                  {testResult.latencyMs && (
                    <span className="font-mono text-[10px] bg-white/70 px-1.5 py-0.5 rounded border border-emerald-200/50">
                      {testResult.latencyMs}ms
                    </span>
                  )}
                </div>
                {testResult.reply && (
                  <p className="text-[11px] font-mono bg-white/60 p-2 rounded border border-emerald-200/40 text-emerald-800">
                    "{testResult.reply}"
                  </p>
                )}
                {testResult.error && (
                  <p className="text-[11px] text-rose-700 leading-tight">{testResult.error}</p>
                )}
              </div>
            )}
          </div>

          {/* Model Inference Hyperparameters */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs space-y-4">
            <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-neutral-500" />
              <span>Inference Parameters</span>
            </label>

            {/* Temperature Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-700">Temperature</span>
                <span className="font-mono text-xs font-bold text-neutral-900">{temperature}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-neutral-900 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>0.0 (Precise / Code AST)</span>
                <span>1.0 (Creative)</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-neutral-700">Max Generation Tokens</span>
                <span className="font-mono text-xs font-bold text-neutral-900">{maxTokens}</span>
              </div>
              <input
                type="range"
                min="512"
                max="8192"
                step="256"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full accent-neutral-900 h-1.5 bg-neutral-200 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>512</span>
                <span>8192 tokens</span>
              </div>
            </div>
          </div>

          {/* Main Action: Save Settings & Sync to Firestore */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs space-y-3">
            <button
              id="save-openrouter-config-btn"
              type="button"
              onClick={handleSaveSettings}
              disabled={saveStatus === 'saving'}
              className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition"
            >
              {saveStatus === 'saving' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Syncing to Firestore...</span>
                </>
              ) : saveStatus === 'saved' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Saved & Cloud Synced!</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-amber-300" />
                  <span>Save & Persist to Firestore</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-neutral-400 text-center">
              {user 
                ? 'Your key and chosen model will be synced to your Firestore profile.'
                : 'Sign in with Google to automatically back up these settings to the cloud.'}
            </p>
          </div>
        </div>

        {/* Right Column: Dynamic Open-Source Model Selector (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Highlighted Model: NVIDIA Nemotron 70B */}
          <div 
            onClick={() => {
              setSelectedModel('nvidia/llama-3.1-nemotron-70b-instruct');
              setCustomModel('');
            }}
            className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
              selectedModel === 'nvidia/llama-3.1-nemotron-70b-instruct' && !customModel
                ? 'bg-neutral-950 border-neutral-950 text-white ring-2 ring-amber-400 shadow-md'
                : 'bg-white border-amber-300 hover:border-amber-400 text-neutral-900 shadow-xs'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm">NVIDIA Nemotron 70B Instruct</span>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    selectedModel === 'nvidia/llama-3.1-nemotron-70b-instruct' && !customModel
                      ? 'bg-amber-400 text-neutral-950'
                      : 'bg-amber-100 text-amber-900'
                  }`}>
                    ⭐ Recommended for Code Reviews
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${
                  selectedModel === 'nvidia/llama-3.1-nemotron-70b-instruct' && !customModel
                    ? 'text-neutral-300'
                    : 'text-neutral-600'
                }`}>
                  NVIDIA-refined Llama 3.1 70B with state-of-the-art synthetic alignment. Unrivaled for Python bug detection, AST analysis, security audits, and type-hint refactoring.
                </p>
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    selectedModel === 'nvidia/llama-3.1-nemotron-70b-instruct' && !customModel
                      ? 'bg-neutral-800 text-neutral-300'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    Context: 128k
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    selectedModel === 'nvidia/llama-3.1-nemotron-70b-instruct' && !customModel
                      ? 'bg-neutral-800 text-neutral-300'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}>
                    Model ID: nvidia/llama-3.1-nemotron-70b-instruct
                  </span>
                </div>
              </div>

              <div className="shrink-0 pt-0.5">
                {selectedModel === 'nvidia/llama-3.1-nemotron-70b-instruct' && !customModel ? (
                  <div className="w-6 h-6 rounded-full bg-amber-400 text-neutral-950 flex items-center justify-center">
                    <Check className="w-4 h-4 font-bold stroke-[3]" />
                  </div>
                ) : (
                  <button
                    type="button"
                    className="px-3 py-1 rounded-lg text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-800"
                  >
                    Select
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Model Catalog & Dynamic Fetcher */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Open-Source Model Catalog</span>
                </label>
                <p className="text-[11px] text-neutral-500">
                  Select from popular open-weight models or fetch live models from OpenRouter.
                </p>
              </div>

              <button
                id="fetch-live-models-btn"
                type="button"
                onClick={handleFetchDynamicModels}
                disabled={isLoadingModels}
                className="px-3 py-1.5 rounded-xl border border-neutral-200 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition shrink-0"
              >
                <RefreshCw className={`w-3 h-3 text-blue-600 ${isLoadingModels ? 'animate-spin' : ''}`} />
                <span>{isLoadingModels ? 'Fetching...' : 'Fetch Live Models'}</span>
              </button>
            </div>

            {/* Provider Filter Chips & Search Bar */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search open-source models (Nemotron, Llama, Qwen, Mistral, DeepSeek)..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white text-neutral-900 placeholder:text-neutral-400"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {(['all', 'nvidia', 'meta', 'qwen', 'mistral', 'deepseek'] as const).map((prov) => (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => setProviderFilter(prov)}
                    className={`px-2.5 py-1 rounded-lg font-medium text-[11px] whitespace-nowrap transition ${
                      providerFilter === prov
                        ? 'bg-neutral-900 text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {prov === 'all' ? 'All Models' : prov === 'nvidia' ? 'NVIDIA (Nemotron)' : prov === 'meta' ? 'Meta Llama' : prov === 'qwen' ? 'Qwen Coder' : prov === 'mistral' ? 'Mistral' : 'DeepSeek'}
                  </button>
                ))}
              </div>
            </div>

            {/* Model List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {filteredModels.map((model) => {
                const isSelected = selectedModel === model.id && !customModel;
                return (
                  <div
                    key={model.id}
                    onClick={() => {
                      setSelectedModel(model.id);
                      setCustomModel('');
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition ${
                      isSelected
                        ? 'border-neutral-950 bg-neutral-900 text-white shadow-2xs'
                        : 'border-neutral-200/80 bg-neutral-50/40 hover:bg-neutral-100/60 text-neutral-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold">{model.name}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                            isSelected ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-200/70 text-neutral-700'
                          }`}>
                            {model.provider || 'Open Source'}
                          </span>
                        </div>
                        {model.description && (
                          <p className={`text-[11px] line-clamp-2 ${isSelected ? 'text-neutral-300' : 'text-neutral-500'}`}>
                            {model.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-0.5 text-[10px] font-mono">
                          <span className={isSelected ? 'text-neutral-400' : 'text-neutral-400'}>
                            ID: {model.id}
                          </span>
                          {model.context_length && (
                            <span className={isSelected ? 'text-amber-300' : 'text-neutral-500'}>
                              • Context: {Math.round(model.context_length / 1000)}k
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isSelected ? (
                          <div className="w-5 h-5 rounded-full bg-white text-neutral-950 flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-700">
                            Use
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredModels.length === 0 && (
                <div className="text-center py-6 text-neutral-400 text-xs">
                  No models found matching "{searchQuery}". You can enter a custom OpenRouter model ID below.
                </div>
              )}
            </div>

            {/* Custom Model ID Entry */}
            <div className="pt-2 border-t border-neutral-100 space-y-1.5">
              <label htmlFor="custom-openrouter-model" className="text-xs font-medium text-neutral-700">
                Or Specify Any Custom OpenRouter Model ID:
              </label>
              <div className="flex gap-2">
                <input
                  id="custom-openrouter-model"
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="e.g. nvidia/nemotron-4-340b-instruct or anthropic/claude-3.5-sonnet"
                  className="flex-1 px-3 py-1.5 text-xs font-mono bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white text-neutral-900 placeholder:text-neutral-400"
                />
                {customModel && (
                  <button
                    type="button"
                    onClick={() => setCustomModel('')}
                    className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-800 bg-neutral-100 rounded-xl"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Playground / Live Verification Section */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-neutral-500" />
                <span>Live Verification Playground ({customModel || selectedModel})</span>
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">Real-time AST Test</span>
            </div>

            <textarea
              value={testCodeSnippet}
              onChange={(e) => setTestCodeSnippet(e.target.value)}
              rows={4}
              className="w-full p-2.5 text-xs font-mono bg-neutral-900 text-neutral-100 rounded-xl border border-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="Enter Python code to test with Nemotron 70B..."
            />

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRunPlaygroundReview}
                disabled={isAnalyzingTest || !apiKey.trim()}
                className={`py-2 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                  isAnalyzingTest || !apiKey.trim()
                    ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                    : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-2xs'
                }`}
              >
                <Play className={`w-3.5 h-3.5 ${isAnalyzingTest ? 'animate-spin' : 'fill-current'}`} />
                <span>{isAnalyzingTest ? 'Analyzing with Model...' : 'Run Test Review with OpenRouter'}</span>
              </button>
              
              <span className="text-[11px] text-neutral-400">
                Active: <strong className="text-neutral-700 font-mono">{customModel || selectedModel.split('/')[1] || selectedModel}</strong>
              </span>
            </div>

            {testAnalysisOutput && (
              <div className="mt-3 p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs font-mono max-h-52 overflow-y-auto space-y-1">
                <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider pb-1 border-b border-neutral-800">
                  Model Output ({customModel || selectedModel})
                </div>
                <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-neutral-300">
                  {testAnalysisOutput}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
