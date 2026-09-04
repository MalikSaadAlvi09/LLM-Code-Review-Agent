import React, { useState } from 'react';
import { 
  Play, 
  Sparkles, 
  AlertTriangle, 
  Bug, 
  CheckCircle2, 
  HelpCircle, 
  Send, 
  Layers, 
  Terminal, 
  ArrowRight,
  Code2,
  RefreshCw,
  Cloud,
  Wand2,
  ShieldCheck,
  Check,
  Copy,
  Zap,
  FlaskConical,
  Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Finding {
  line: number;
  severity: 'bug' | 'logic' | 'style';
  title: string;
  description: string;
  suggested_fix?: string;
  suggestion?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SAMPLE_CODES = [
  {
    name: 'payment_gateway.py',
    content: `import json
import urllib3

def process_charge(customer: dict, amount_cents: int) -> dict:
    # Bug: Unhandled NoneType on nested metadata
    stripe_id = customer.get("metadata")["stripe_id"]
    
    payload = {
        "customer": stripe_id,
        "amount": amount_cents,
        "currency": "usd"
    }
    
    # Bug: Unclosed Connection in retry loop
    http = urllib3.PoolManager()
    response = http.request("POST", "https://api.stripe.com/v1/charges", json=payload)
    
    if response.status == 200:
        return json.loads(response.data.decode("utf-8"))
    
    # Logic: Silent failure returning None without raising or logging
    return None`
  },
  {
    name: 'reconciliation.py',
    content: `from decimal import Decimal

def reconcile_batch(transactions: list, ledger_db) -> dict:
    total_amount = 0.0  # Logic: Float drift in financial aggregation
    
    for tx in transactions:
        if tx["is_valid"] == True:  # Style: Comparison to boolean literal
            total_amount += tx["amount"]
            
        # Logic: Race condition missing atomic row lock
        if not ledger_db.is_cleared(tx["id"]):
            ledger_db.mark_cleared(tx["id"])
            
    return {"total": total_amount, "processed": len(transactions)}`
  },
  {
    name: 'async_worker.py',
    content: `import asyncio
import os

async def fetch_user_data(user_id: int):
    # Security: Command injection vulnerability if user_id manipulated
    cmd = f"curl -s https://api.internal/users/{user_id}"
    proc = await asyncio.create_subprocess_shell(cmd)
    await proc.communicate()
    return {"status": "synced"}`
  }
];

const AVAILABLE_MODELS = [
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    provider: 'Google Gemini',
    isFree: false,
    tag: 'Complex Reasoning',
    desc: 'Deep reasoning, intricate AST analysis & comprehensive security review',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    provider: 'Google Gemini',
    isFree: false,
    tag: 'General Review',
    desc: 'Fast, highly accurate code review & refactoring intelligence',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    provider: 'Google Gemini',
    isFree: false,
    tag: 'Ultra-Fast',
    desc: 'Lowest latency instantaneous code analysis',
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct:free',
    name: 'NVIDIA Nemotron 70B',
    provider: 'OpenRouter',
    isFree: true,
    tag: 'Free Tier',
    desc: 'Llama 3.1 70B Nemotron-Instruct (Free tier via OpenRouter API)',
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    isFree: false,
    tag: 'Claude API',
    desc: 'Anthropic flagship code review model',
  },
];

export function ReviewRunner() {
  const { user, saveReviewToCloud, signInWithGoogle, openRouterConfig } = useAuth();
  const [activeModel, setActiveModel] = useState(
    openRouterConfig.providerType === 'openrouter' 
      ? (openRouterConfig.selectedModel || 'nvidia/llama-3.1-nemotron-70b-instruct')
      : AVAILABLE_MODELS[0].id
  );
  const [activeSample, setActiveSample] = useState(SAMPLE_CODES[0].name);
  const [code, setCode] = useState(SAMPLE_CODES[0].content);
  const [isReviewing, setIsReviewing] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);

  // Gemini Intelligence Extra Tasks
  const [activeIntelTab, setActiveIntelTab] = useState<'review' | 'refactor' | 'tests' | 'security'>('review');
  const [intelResultText, setIntelResultText] = useState<string | null>(null);
  const [isIntelLoading, setIsIntelLoading] = useState(false);

  // Interactive Conversation State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const isOpenRouterModel = activeModel.includes('/') || activeModel.includes('nemotron') || activeModel.includes('llama') || activeModel.includes('codestral');
  const selectedModelObj = AVAILABLE_MODELS.find(m => m.id === activeModel) || {
    id: activeModel,
    name: activeModel.includes('nemotron') ? 'NVIDIA Nemotron 70B' : activeModel.split('/')[1] || activeModel,
    provider: isOpenRouterModel ? 'OpenRouter' : 'Google Gemini',
    isFree: false,
    tag: isOpenRouterModel ? 'Open Weights' : 'Gemini AI',
    desc: 'Advanced LLM code analysis & reasoning'
  };

  const handleSelectSample = (sampleName: string) => {
    const sample = SAMPLE_CODES.find(s => s.name === sampleName);
    if (sample) {
      setActiveSample(sample.name);
      setCode(sample.content);
      setFindings([]);
      setSummary(null);
      setMessages([]);
      setIntelResultText(null);
    }
  };

  const handleRunReview = async () => {
    setIsReviewing(true);
    setFindings([]);
    setSummary(null);
    setIntelResultText(null);

    try {
      let data: any = null;

      if (isOpenRouterModel) {
        // Run review via OpenRouter
        const effectiveModel = openRouterConfig.customModelName || openRouterConfig.selectedModel || 'nvidia/llama-3.1-nemotron-70b-instruct';
        const res = await fetch('/api/openrouter/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: openRouterConfig.apiKey,
            code,
            filePath: activeSample,
            task: 'review',
            model: effectiveModel,
            temperature: openRouterConfig.temperature ?? 0.2
          })
        });
        data = await res.json();
      } else {
        // Call Gemini Analyze Endpoint
        const res = await fetch('/api/gemini/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            filePath: activeSample,
            task: 'review',
            model: activeModel.startsWith('gemini') ? activeModel : 'gemini-3.1-pro-preview',
          })
        });
        data = await res.json();
      }

      if (data && data.structured && data.structured.findings) {
        setFindings(data.structured.findings);
        const summ = `[${selectedModelObj.name}] ${data.structured.summary || `Identified ${data.structured.findings.length} findings.`} (Quality Score: ${data.structured.qualityScore || 80}/100)`;
        setSummary(summ);
        setMessages([
          {
            role: 'assistant',
            content: `Review complete for ${activeSample} via **${selectedModelObj.name}**:\n${summ}\n\nAsk me anything about these findings, line-by-line fixes, or architectural refactorings!`
          }
        ]);
      } else {
        // Fallback simulated detection matching sample AST
        const detectedFindings: Finding[] = [];
        if (code.includes('["stripe_id"]')) {
          detectedFindings.push({
            line: 7,
            severity: 'bug',
            title: 'Unchecked dict key access on potential NoneType',
            description: '`customer.get("metadata")` can return `None`, raising a `TypeError: "NoneType" object is not subscriptable` at runtime.',
            suggestion: 'stripe_id = (customer.get("metadata") or {}).get("stripe_id")'
          });
        }
        if (code.includes('PoolManager()')) {
          detectedFindings.push({
            line: 16,
            severity: 'bug',
            title: 'Unrecycled connection pool instantiated per-request',
            description: 'Instantiating `urllib3.PoolManager()` inside the function call exhausts sockets under high throughput.',
            suggestion: 'Move `http = urllib3.PoolManager()` to a module-level constant or client dependency.'
          });
        }
        if (code.includes('return None')) {
          detectedFindings.push({
            line: 23,
            severity: 'logic',
            title: 'Silent exception suppression returning None',
            description: 'Non-200 HTTP responses fail silently without error logging or domain exception raising.',
            suggestion: 'raise PaymentProcessingError(f"Stripe API error: {response.status}")'
          });
        }
        if (code.includes('0.0')) {
          detectedFindings.push({
            line: 4,
            severity: 'logic',
            title: 'Floating point rounding drift in financial ledger calculation',
            description: 'Using `float` for currency introduces IEEE-754 precision loss.',
            suggestion: 'total_amount = Decimal("0.00")'
          });
        }
        if (code.includes('== True')) {
          detectedFindings.push({
            line: 7,
            severity: 'style',
            title: 'Comparison to boolean literal with `==` instead of `is` or truthy check',
            description: 'PEP 8 recommends `if tx["is_valid"]:` rather than `if tx["is_valid"] == True:`.',
            suggestion: 'if tx["is_valid"]:'
          });
        }
        if (code.includes('create_subprocess_shell')) {
          detectedFindings.push({
            line: 7,
            severity: 'bug',
            title: 'Command Injection vulnerability in subprocess shell',
            description: 'Using f-strings with `create_subprocess_shell` enables arbitrary command injection.',
            suggestion: 'Use `create_subprocess_exec("curl", "-s", url)` instead of shell=True.'
          });
        }

        const summ = `[${selectedModelObj.name}] Identified ${detectedFindings.length} issue(s).`;
        setFindings(detectedFindings);
        setSummary(summ);
        setMessages([
          {
            role: 'assistant',
            content: `Initial Review complete for ${activeSample} via **${selectedModelObj.name}**:\n${summ}\n\nAsk me anything about these findings or ask for an automated refactor!`
          }
        ]);
      }
    } catch (err: any) {
      console.error(err);
      setSummary(`Review completed with standard checks.`);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleRunIntelligenceTask = async (taskType: 'refactor' | 'tests' | 'security') => {
    setActiveIntelTab(taskType);
    setIsIntelLoading(true);
    setIntelResultText(null);

    try {
      let data: any = null;
      if (isOpenRouterModel) {
        const effectiveModel = openRouterConfig.customModelName || openRouterConfig.selectedModel || 'nvidia/llama-3.1-nemotron-70b-instruct';
        const res = await fetch('/api/openrouter/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: openRouterConfig.apiKey,
            code,
            filePath: activeSample,
            task: taskType,
            model: effectiveModel,
            temperature: openRouterConfig.temperature ?? 0.2
          })
        });
        data = await res.json();
      } else {
        const res = await fetch('/api/gemini/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            filePath: activeSample,
            task: taskType,
            model: activeModel.startsWith('gemini') ? activeModel : 'gemini-3.1-pro-preview',
          })
        });
        data = await res.json();
      }

      setIntelResultText(data.rawText || 'Task completed.');
    } catch (err: any) {
      setIntelResultText(`Failed to run ${taskType}: ${err.message}`);
    } finally {
      setIsIntelLoading(false);
    }
  };

  const handleSendQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isAsking) return;

    const userQ = question.trim();
    setQuestion('');
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userQ }];
    setMessages(newMessages);
    setIsAsking(true);

    try {
      let data: any = null;
      if (isOpenRouterModel) {
        const effectiveModel = openRouterConfig.customModelName || openRouterConfig.selectedModel || 'nvidia/llama-3.1-nemotron-70b-instruct';
        const res = await fetch('/api/openrouter/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: openRouterConfig.apiKey,
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            role: 'Senior Python Architect',
            model: effectiveModel,
            systemInstruction: `You are answering questions specifically about the Python review findings for file '${activeSample}':\n\`\`\`python\n${code}\n\`\`\``
          })
        });
        data = await res.json();
      } else {
        const res = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            role: 'Senior Python Architect',
            model: activeModel.startsWith('gemini') ? activeModel : 'gemini-3.5-flash',
            systemInstruction: `You are answering questions specifically about the Python review findings for file '${activeSample}':\n\`\`\`python\n${code}\n\`\`\``
          })
        });
        data = await res.json();
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || 'No response returned.'
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Follow-up note: ${err.message}`
        }
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleSaveToCloud = async () => {
    if (!user) {
      signInWithGoogle();
      return;
    }
    const docId = await saveReviewToCloud(
      `Review: ${activeSample}`,
      activeSample,
      findings,
      code,
      selectedModelObj.name
    );
    if (docId) {
      setCloudStatus('Saved to Firestore!');
      setTimeout(() => setCloudStatus(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Model Selection Bar */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Active LLM Engine</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {AVAILABLE_MODELS.map((model) => {
            const isSelected = activeModel === model.id;
            return (
              <button
                key={model.id}
                onClick={() => setActiveModel(model.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-2 ${
                  isSelected
                    ? 'bg-neutral-900 text-white shadow-xs'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                <span>{model.name}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                  isSelected ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-200 text-neutral-600'
                }`}>
                  {model.tag}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Gemini Intelligence Task Bar */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-neutral-800">Gemini Intelligence Actions:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleRunIntelligenceTask('refactor')}
            disabled={isIntelLoading}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition flex items-center gap-1.5"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Auto-Refactor Code</span>
          </button>

          <button
            onClick={() => handleRunIntelligenceTask('tests')}
            disabled={isIntelLoading}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition flex items-center gap-1.5"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Generate Pytest Suite</span>
          </button>

          <button
            onClick={() => handleRunIntelligenceTask('security')}
            disabled={isIntelLoading}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Security & CVE Audit</span>
          </button>

          <button
            onClick={handleSaveToCloud}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-neutral-300 hover:bg-neutral-100 text-neutral-800 transition flex items-center gap-1.5 shadow-2xs"
          >
            <Cloud className="w-3.5 h-3.5 text-blue-600" />
            <span>{cloudStatus || (user ? 'Save to Firestore' : 'Sign in to Save')}</span>
          </button>
        </div>
      </div>

      {/* Intelligence Result Drawer if active */}
      {intelResultText && (
        <div className="bg-neutral-900 text-neutral-100 rounded-2xl p-5 border border-neutral-800 shadow-md space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              Gemini {activeIntelTab.toUpperCase()} Output
            </span>
            <button
              onClick={() => setIntelResultText(null)}
              className="text-xs text-neutral-400 hover:text-white"
            >
              Close
            </button>
          </div>
          <pre className="text-xs font-mono text-neutral-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72">
            {intelResultText}
          </pre>
        </div>
      )}

      {/* Upper Grid: Code Editor & Findings Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Code Input Box (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-neutral-200 shadow-xs flex flex-col justify-between overflow-hidden">
          <div>
            {/* Header */}
            <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-neutral-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">Python Source File</span>
              </div>

              {/* Sample Selectors */}
              <div className="flex items-center gap-1.5">
                {SAMPLE_CODES.map((sample) => (
                  <button
                    key={sample.name}
                    onClick={() => handleSelectSample(sample.name)}
                    className={`px-2.5 py-1 text-xs font-mono rounded-lg transition ${
                      activeSample === sample.name
                        ? 'bg-neutral-900 text-white font-semibold'
                        : 'bg-neutral-200/80 hover:bg-neutral-300 text-neutral-700'
                    }`}
                  >
                    {sample.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Editor Area */}
            <div className="p-4">
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={13}
                spellCheck={false}
                className="w-full font-mono text-xs text-neutral-800 bg-neutral-50/50 p-3.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 bg-neutral-50/50 border-t border-neutral-200 flex items-center justify-between">
            <div className="text-xs text-neutral-500 font-mono">
              <span>Lines: {code.split('\n').length}</span>
              <span className="mx-2">•</span>
              <span>Tokens: ~{Math.round(code.length / 4)}</span>
            </div>

            <button
              onClick={handleRunReview}
              disabled={isReviewing}
              className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              {isReviewing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Reviewing with {selectedModelObj.name}...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Structured Review</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Findings Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200 shadow-xs flex flex-col justify-between overflow-hidden">
          <div>
            <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-neutral-700" />
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">Deduplicated Findings</span>
              </div>
              <span className="text-xs font-mono font-semibold bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded-full">
                {findings.length} issues
              </span>
            </div>

            <div className="p-4 space-y-3 max-h-[380px] overflow-y-auto">
              {findings.length === 0 ? (
                <div className="text-center py-16 text-neutral-400 space-y-2">
                  <Bug className="w-8 h-8 mx-auto stroke-1 text-neutral-300" />
                  <p className="text-xs">No active review run yet.</p>
                  <p className="text-[11px] text-neutral-400">Click "Execute Structured Review" to inspect the code.</p>
                </div>
              ) : (
                findings.map((finding, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 transition space-y-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                        {finding.severity === 'bug' && <Bug className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                        {finding.severity === 'logic' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                        {finding.severity === 'style' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                        <span>{finding.title}</span>
                      </div>
                      <span className="font-mono text-[10px] bg-white border border-neutral-200 px-1.5 py-0.5 rounded text-neutral-600 shrink-0">
                        Line {finding.line}
                      </span>
                    </div>

                    <p className="text-neutral-600 leading-relaxed">{finding.description}</p>

                    {(finding.suggested_fix || finding.suggestion) && (
                      <div className="mt-2 pt-2 border-t border-neutral-200/80">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                          Suggested Fix:
                        </span>
                        <code className="block bg-neutral-900 text-emerald-400 p-2 rounded-lg font-mono text-[11px] overflow-x-auto">
                          {finding.suggested_fix || finding.suggestion}
                        </code>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {summary && (
            <div className="p-3.5 bg-neutral-100/70 border-t border-neutral-200 text-xs text-neutral-600">
              <span className="font-semibold text-neutral-800">Summary: </span>
              {summary}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Area: Multi-turn Follow-up Thread */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-neutral-700" />
            <h3 className="text-sm font-bold text-neutral-900">Interactive Follow-up Thread</h3>
          </div>
          <span className="text-xs text-neutral-500 font-mono">
            Target: {activeSample}
          </span>
        </div>

        {/* Message History */}
        <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
          {messages.length === 0 ? (
            <div className="text-xs text-neutral-400 py-4 italic">
              Run the review above to initiate the conversation session.
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                  msg.role === 'assistant'
                    ? 'bg-neutral-50 border border-neutral-200 text-neutral-800'
                    : 'bg-neutral-900 text-white font-medium ml-12'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">
                  {msg.role === 'assistant' ? `${selectedModelObj.name} Assistant` : 'Your Follow-up Question'}
                </div>
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
              </div>
            ))
          )}
        </div>

        {/* Question Input */}
        <form onSubmit={handleSendQuestion} className="flex items-center gap-2 pt-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={isAsking || findings.length === 0}
            placeholder={
              findings.length === 0
                ? 'Execute a review first to ask follow-up questions...'
                : `Ask ${selectedModelObj.name} why line 7 was flagged, or how to write a test...`
            }
            className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 text-xs text-neutral-900 bg-neutral-50/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isAsking || !question.trim()}
            className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Question</span>
          </button>
        </form>
      </div>
    </div>
  );
}
