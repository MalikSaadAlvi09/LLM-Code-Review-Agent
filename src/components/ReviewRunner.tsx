import React, { useEffect, useState } from 'react';
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
import { ChatMessage, ImportedProject, ReviewResult, ReviewSession } from '../types';
import { functions, httpsCallable } from '../lib/firebase';

interface Finding {
  line: number;
  severity: 'bug' | 'logic' | 'style';
  title: string;
  description: string;
  suggested_fix?: string;
  suggestion?: string;
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

export function ReviewRunner({ project }: { project?: ImportedProject | null }) {
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
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'reviewing' | 'ready' | 'asking' | 'error'>('idle');
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewProgress, setReviewProgress] = useState<string | null>(null);

  useEffect(() => {
    const importedFile = project?.files.find(file => file.status === 'ready' && file.selected);
    if (importedFile) {
      setActiveSample(importedFile.path);
      setCode(importedFile.content);
      setFindings([]);
      setSummary(null);
      setMessages([]);
      setReviewSession(null);
      setSessionStatus('idle');
      setReviewError(null);
      setReviewProgress(null);
    }
  }, [project]);

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
      setReviewSession(null);
      setSessionStatus('idle');
      setReviewError(null);
      setIntelResultText(null);
    }
  };

  const handleRunReview = async () => {
    if (isReviewing) return;
    if (!code.trim()) {
      setReviewError('Add Python source code before starting a review.');
      setSessionStatus('error');
      return;
    }
    if (!AVAILABLE_MODELS.some(model => model.id === activeModel)) {
      setReviewError('Select a supported review model before starting.');
      setSessionStatus('error');
      return;
    }

    setIsReviewing(true);
    setSessionStatus('reviewing');
    setReviewError(null);
    setReviewProgress(null);
    setFindings([]);
    setSummary(null);
    setIntelResultText(null);

    try {
      const effectiveModel = isOpenRouterModel
        ? (openRouterConfig.customModelName || openRouterConfig.selectedModel || activeModel)
        : activeModel;
      const reviewInputs = project
        ? project.files.filter(file => file.status === 'ready' && file.selected).slice(0, 100).map(file => ({ path: file.path, content: file.content }))
        : [{ path: activeSample, content: code }];
      if (!reviewInputs.length) throw new Error('Select at least one supported file to review.');

      const startStructuredReview = httpsCallable(functions, 'startStructuredReview');
      setReviewProgress(`Reviewing files: 0/${reviewInputs.length}`);
      const result = await startStructuredReview({
        projectId: project?.id || crypto.randomUUID(),
        projectName: project?.name || activeSample,
        sourceType: project?.sourceType || 'pasted',
        scope: project ? 'selected-files' : 'single-file',
        files: reviewInputs.map(input => ({ path: input.path, language: project?.files.find(file => file.path === input.path)?.language || 'python', content: input.content })),
        model: effectiveModel,
      });
      const payload: any = result.data;
      if (!payload?.success || !payload.review || !Array.isArray(payload.review.issues)) throw new Error('The review response was missing structured findings.');
      const reviews = [{ path: activeSample, review: { ...payload.review, findings: payload.review.issues }, sessionId: payload.sessionId }];

      const combinedFindings = reviews.flatMap(item => item.review.findings.map((finding: Finding) => ({ ...finding, title: reviews.length > 1 ? `[${item.path}] ${finding.title}` : finding.title })));
      const averageScore = Math.round(reviews.reduce((total, item) => total + (item.review.qualityScore || 0), 0) / reviews.length);
      const combinedReview = {
        summary: reviews.length > 1 ? `Reviewed ${reviews.length} files successfully.` : reviews[0].review.summary,
        findings: combinedFindings,
        qualityScore: averageScore,
        verdict: combinedFindings.some(finding => finding.severity === 'bug') ? 'Needs Improvement' : (reviews[0].review.verdict || 'Approved'),
      };

      const session: ReviewSession = {
        id: reviews[0].sessionId || crypto.randomUUID(),
        projectId: project?.id || activeSample,
        filename: activeSample,
        sourceCode: reviewInputs.map(input => `# ${input.path}\n${input.content}`).join('\n\n'),
        model: effectiveModel,
        review: combinedReview as ReviewResult,
        messages: [{ role: 'assistant', content: `Review complete for ${reviews.length} file${reviews.length === 1 ? '' : 's'} via **${selectedModelObj.name}**.` }],
        createdAt: new Date().toISOString(),
      };
      setReviewSession(session);
      setFindings(combinedFindings);
      const summ = `[${selectedModelObj.name}] ${combinedReview.summary} (Quality Score: ${averageScore}/100)`;
      setSummary(summ);
      setMessages(session.messages);
      setSessionStatus('ready');
      setReviewProgress(null);

      if (user) {
        const savedId = await saveReviewToCloud(`Review: ${activeSample}`, activeSample, combinedFindings, session.sourceCode, selectedModelObj.name);
        if (!savedId) setCloudStatus('Review completed, but cloud synchronization failed.');
      }
    } catch (err: any) {
      console.error('Structured review failed:', {
        code: err?.code,
        message: err?.message,
        details: err?.details,
      });
      setReviewSession(null);
      let errorMsg = err?.message || 'The review could not be completed.';
      if (err?.code === 'functions/not-found' || (typeof err?.message === 'string' && err.message.includes('404'))) {
        errorMsg = 'The review service is not deployed or the Firebase region is incorrect.';
      } else if (err?.code === 'functions/unauthenticated') {
        errorMsg = 'Sign in before starting a review.';
      } else if (err?.code === 'functions/unavailable') {
        errorMsg = 'The review service is temporarily unavailable.';
      } else if (err?.code === 'functions/deadline-exceeded') {
        errorMsg = 'The review timed out. Try fewer files.';
      }
      setReviewError(errorMsg);
      setSessionStatus('error');
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
    if (!question.trim() || isAsking || sessionStatus !== 'ready' || !reviewSession) return;

    const userQ = question.trim();
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userQ }];
    setMessages(newMessages);
    setIsAsking(true);
    setSessionStatus('asking');

    try {
      const sendReviewFollowUp = httpsCallable(functions, 'sendReviewFollowUp');
      const result = await sendReviewFollowUp({
        projectId: project?.id || reviewSession.filename,
        sessionId: reviewSession.id,
        question: userQ,
        model: reviewSession.model,
      });
      const payload: any = result.data;
      if (!payload?.success || !payload.answer) throw new Error(payload?.error || 'Follow-up request failed.');
      setQuestion('');
      setMessages(prev => [...prev, { role: 'assistant', content: payload.answer }]);
      setReviewSession(prev => prev ? { ...prev, messages: [...prev.messages, { role: 'user', content: userQ }, { role: 'assistant', content: payload.answer }] } : prev);
      setSessionStatus('ready');
    } catch (err: any) {
      console.error('Follow-up request failed:', {
        code: err?.code,
        message: err?.message,
        details: err?.details,
      });
      setSessionStatus('ready');
      let errorMsg = err?.message || 'Follow-up request failed.';
      if (err?.code === 'functions/not-found' || (typeof err?.message === 'string' && err.message.includes('404'))) {
        errorMsg = 'The follow-up service is not deployed or the Firebase region is incorrect.';
      } else if (err?.code === 'functions/unauthenticated') {
        errorMsg = 'Sign in before sending follow-up questions.';
      } else if (err?.code === 'functions/unavailable') {
        errorMsg = 'The follow-up service is temporarily unavailable.';
      }
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Follow-up failed: ${errorMsg}`
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
                onChange={(e) => {
                  setCode(e.target.value);
                  if (reviewSession) {
                    setReviewSession(null);
                    setMessages([]);
                    setSessionStatus('idle');
                  }
                }}
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
              disabled={isReviewing || !code.trim()}
              className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-2 shadow-xs cursor-pointer"
            >
              {isReviewing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{reviewProgress || `Reviewing with ${selectedModelObj.name}...`}</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Structured Review</span>
                </>
              )}
            </button>
          </div>
          {reviewError && (
            <div className="p-3.5 border-t border-rose-200 bg-rose-50 text-xs text-rose-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2" role="alert">
              <div>{reviewError}</div>
              <div className="flex items-center gap-3">
                {reviewError.includes('Sign in') && !user && (
                  <button type="button" onClick={() => signInWithGoogle()} className="font-bold underline text-rose-800 hover:text-rose-950">Sign In with Google</button>
                )}
                <button type="button" onClick={handleRunReview} className="font-semibold underline">Retry Review</button>
              </div>
            </div>
          )}
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
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            disabled={isAsking || sessionStatus !== 'ready' || !reviewSession}
            placeholder={reviewSession ? 'Ask a question about this review...' : 'Execute a review first to ask follow-up questions...'}
            rows={2}
            className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 text-xs text-neutral-900 bg-neutral-50/50 disabled:opacity-50 resize-none"
          />
          <button
            type="submit"
            disabled={isAsking || sessionStatus !== 'ready' || !reviewSession || !question.trim()}
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
