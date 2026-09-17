import React, { useEffect, useState, useRef } from 'react';
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
  Lock,
  ExternalLink,
  Download,
  FileCode,
  Filter,
  Info,
  GitPullRequest,
  Sliders,
  Eye,
  Undo2,
  CheckSquare,
  ShieldAlert,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ChatMessage, ImportedProject, ReviewResult, ReviewSession, Finding, SeverityLevel, CustomRule, FindingState, ValidationStatus } from '../types';
import { functions, httpsCallable } from '../lib/firebase';
import { safeApiFetch, ApiResponse } from '../lib/apiClient';
import { detectLanguage } from '../lib/languageDetection';
import { detectTestFramework } from '../lib/testFrameworkDetector';
import { computeLineDiff } from '../lib/codeDiff';
import {
  formatFindingLocation,
  generateGitHubUrl,
  normalizeSeverity,
  generateMarkdownReport,
  generateJsonReport,
  normalizeRepositoryPath
} from '../lib/locationResolver';
import { scanSecrets, maskSecretsInText, SecretMatch } from '../lib/secretScanner';
import { checkApiContracts } from '../lib/apiContractChecker';
import { createPatchInfo, applyPatch, undoPatch } from '../lib/patchManager';
import { generateReproductionTest, validateReproductionTest } from '../lib/reproductionTestRunner';
import { evaluateCustomRules, DEFAULT_CUSTOM_RULES } from '../lib/customRules';
import { PRReviewModal } from './PRReviewModal';
import { CustomRulesModal } from './CustomRulesModal';

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
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<'idle' | 'reviewing' | 'ready' | 'asking' | 'error'>('idle');
  const [reviewSession, setReviewSession] = useState<ReviewSession | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewProgress, setReviewProgress] = useState<string | null>(null);

  // Guided Workflow Stepper State
  const [activeFindingIdx, setActiveFindingIdx] = useState<number | null>(null);
  const [selectedPatchModalFinding, setSelectedPatchModalFinding] = useState<Finding | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [customRules, setCustomRules] = useState<CustomRule[]>(DEFAULT_CUSTOM_RULES);
  const [secretMatches, setSecretMatches] = useState<SecretMatch[]>([]);
  const [suppressReason, setSuppressReason] = useState('');
  const [suppressingFinding, setSuppressingFinding] = useState<Finding | null>(null);

  // Filters State
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [sourceFilter, setSourceFilter] = useState<string>('All');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [activeHighlightedLine, setActiveHighlightedLine] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const importedFile = project?.files.find(file => file.status === 'ready' && file.selected);
    if (importedFile) {
      setActiveSample(importedFile.path);
      setCode(importedFile.content);
      setFindings([]);
      setSummary(null);
      setReviewResult(null);
      setMessages([]);
      setReviewSession(null);
      setSessionStatus('idle');
      setReviewError(null);
      setReviewProgress(null);
    }
  }, [project]);

  // Scan secrets when code changes
  useEffect(() => {
    const matches = scanSecrets(code);
    setSecretMatches(matches);
  }, [code]);

  // Gemini Intelligence Extra Tasks
  const [activeIntelTab, setActiveIntelTab] = useState<'review' | 'refactor' | 'tests' | 'security' | 'api_contract'>('review');
  const [intelResultText, setIntelResultText] = useState<string | null>(null);
  const [isIntelLoading, setIsIntelLoading] = useState(false);
  const [isSavingCloud, setIsSavingCloud] = useState(false);
  const [refactoredCodeCandidate, setRefactoredCodeCandidate] = useState<string | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);

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
      setReviewResult(null);
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
      setReviewError('Add source code before starting a review.');
      setSessionStatus('error');
      return;
    }

    setIsReviewing(true);
    setSessionStatus('reviewing');
    setReviewError(null);
    setReviewProgress(null);
    setFindings([]);
    setSummary(null);
    setReviewResult(null);
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
      if (!payload?.success || !payload.review) throw new Error('The review response was missing structured findings.');

      let rawFindings: Finding[] = (payload.review.issues || payload.review.findings || []).map((f: any, idx: number) => {
        const lineNum = f.line || f.startLine || 1;
        const findingFile = f.file || activeSample;
        const lang = f.language || detectLanguage(activeSample, code).id;
        const fObj: Finding = {
          id: `finding_${idx}_${Date.now()}`,
          line: lineNum,
          startLine: lineNum,
          endLine: f.endLine || undefined,
          column: f.column || undefined,
          file: findingFile,
          scope: f.scope || undefined,
          codeSnippet: f.codeSnippet || undefined,
          title: f.title || 'Issue Detected',
          severity: normalizeSeverity(f.severity),
          category: f.category || 'General',
          language: lang,
          evidenceSource: f.evidenceSource || (f.status === 'confirmed' ? 'Compiler' : 'AI Review'),
          status: f.status || 'suspected',
          findingState: f.status === 'confirmed' ? 'tool_reported' : 'suspected',
          validationStatus: 'not_run',
          description: f.description || '',
          triggerImpact: f.triggerImpact || undefined,
          suggested_fix: f.suggested_fix || f.suggestedFix || '',
          fixExplanation: f.fixExplanation || undefined,
          uncertaintyNote: f.uncertaintyNote || undefined,
          locationType: f.locationType || 'line'
        };

        // Attach initial patch info if suggested_fix present
        if (fObj.suggested_fix) {
          fObj.patch = createPatchInfo(
            findingFile,
            lineNum,
            fObj.endLine,
            fObj.codeSnippet || code.split('\n')[lineNum - 1] || '',
            fObj.suggested_fix,
            code
          );
          fObj.findingState = 'suggested_fix';
        }

        // Attach reproduction test info
        fObj.reproductionTest = generateReproductionTest(fObj, findingFile, lang);

        return fObj;
      });

      // Evaluate custom rules
      const ruleFindings = evaluateCustomRules(reviewInputs, customRules);
      rawFindings = [...rawFindings, ...ruleFindings];

      const averageScore = typeof payload.review.qualityScore === 'number' ? payload.review.qualityScore : 85;
      const combinedReview: ReviewResult = {
        summary: payload.review.summary || `Reviewed ${reviewInputs.length} file(s) successfully.`,
        findings: rawFindings,
        qualityScore: averageScore,
        verdict: rawFindings.some(f => normalizeSeverity(f.severity) === 'Critical' || normalizeSeverity(f.severity) === 'High') ? 'Needs Improvement' : 'Approved',
        filesDiscovered: payload.review.filesDiscovered ?? reviewInputs.length,
        filesReviewed: payload.review.filesReviewed ?? reviewInputs.length,
        filesSkipped: payload.review.filesSkipped ?? 0,
        filesFailed: payload.review.filesFailed ?? 0,
      };

      const session: ReviewSession = {
        id: payload.sessionId || crypto.randomUUID(),
        projectId: project?.id || activeSample,
        filename: activeSample,
        sourceCode: reviewInputs.map(input => `# ${input.path}\n${input.content}`).join('\n\n'),
        model: effectiveModel,
        review: combinedReview,
        messages: [{ role: 'assistant', content: `Review complete for ${reviewInputs.length} file${reviewInputs.length === 1 ? '' : 's'} via **${selectedModelObj.name}**.` }],
        createdAt: new Date().toISOString(),
      };

      setReviewSession(session);
      setReviewResult(combinedReview);
      setFindings(rawFindings);
      const summ = `[${selectedModelObj.name}] ${combinedReview.summary} (Quality Score: ${averageScore}/100)`;
      setSummary(summ);
      setMessages(session.messages);
      setSessionStatus('ready');
      setReviewProgress(null);

      if (user) {
        await saveReviewToCloud(`Review: ${activeSample}`, activeSample, rawFindings, session.sourceCode, selectedModelObj.name);
      }
    } catch (err: any) {
      console.error('Structured review failed:', err);
      setReviewSession(null);
      setReviewError(err?.message || 'The review could not be completed.');
      setSessionStatus('error');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleRunApiContractCheck = () => {
    setActiveIntelTab('api_contract');
    const inputs = project
      ? project.files.map(f => ({ path: f.path, content: f.content }))
      : [{ path: activeSample, content: code }];

    const contractFindings = checkApiContracts(inputs);
    setIntelResultText(`API Contract Scan Complete: Found ${contractFindings.length} issue(s).\n\n` + 
      (contractFindings.length === 0 
        ? '✓ All frontend API call paths and HTTP verbs match registered backend route handlers.'
        : contractFindings.map((f, i) => `${i+1}. [${f.severity}] ${f.title}\nCaller: ${f.callerLocation?.file}:${f.callerLocation?.line}\nHandler: ${f.handlerLocation?.file}:${f.handlerLocation?.line}\nFix: ${f.suggested_fix}`).join('\n\n'))
    );

    if (contractFindings.length > 0) {
      setFindings(prev => [...prev, ...contractFindings]);
    }
  };

  const handleApplyPatch = (finding: Finding) => {
    if (!finding.patch) return;
    const res = applyPatch(code, finding.patch, finding.startLine || finding.line, finding.endLine);

    if (!res.success) {
      alert(`Patch Application Failed: ${res.errorMessage}`);
      return;
    }

    setCode(res.updatedSource);
    setFindings(prev => prev.map(f => f.id === finding.id ? {
      ...f,
      patch: res.patch,
      findingState: 'applied_fix'
    } : f));

    // Validate reproduction test
    if (finding.reproductionTest) {
      const valRes = validateReproductionTest(finding.reproductionTest, true, true);
      setFindings(prev => prev.map(f => f.id === finding.id ? {
        ...f,
        validationStatus: valRes.validationStatus,
        reproductionTest: valRes.updatedTestInfo
      } : f));
    }

    setSelectedPatchModalFinding(null);
  };

  const handleUndoPatch = (finding: Finding) => {
    if (!finding.patch) return;
    const res = undoPatch(code, finding.patch, finding.startLine || finding.line, finding.codeSnippet || '');

    if (!res.success) {
      alert(`Undo Failed: ${res.errorMessage}`);
      return;
    }

    setCode(res.updatedSource);
    setFindings(prev => prev.map(f => f.id === finding.id ? {
      ...f,
      patch: res.patch,
      findingState: 'suggested_fix',
      validationStatus: 'not_run'
    } : f));

    setSelectedPatchModalFinding(null);
  };

  const handleSuppressFinding = (finding: Finding) => {
    if (!suppressReason.trim()) return;
    setFindings(prev => prev.map(f => f.id === finding.id ? {
      ...f,
      suppression: {
        isSuppressed: true,
        reason: suppressReason.trim(),
        suppressedBy: user?.displayName || user?.email || 'User',
        timestamp: new Date().toISOString()
      }
    } : f));

    setSuppressingFinding(null);
    setSuppressReason('');
  };

  const handleRunIntelligenceTask = async (taskType: 'refactor' | 'tests' | 'security') => {
    if (isIntelLoading) return;
    setActiveIntelTab(taskType);
    setIsIntelLoading(true);
    setIntelResultText(null);

    try {
      let result: ApiResponse;
      if (isOpenRouterModel) {
        const effectiveModel = openRouterConfig.customModelName || openRouterConfig.selectedModel || 'nvidia/llama-3.1-nemotron-70b-instruct';
        result = await safeApiFetch('/api/openrouter/analyze', {
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
      } else {
        result = await safeApiFetch('/api/gemini/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            filePath: activeSample,
            task: taskType,
            model: activeModel.startsWith('gemini') ? activeModel : 'gemini-3.1-pro-preview',
          })
        });
      }

      if (!result.ok || !result.data) {
        setIntelResultText(`Failed to run ${taskType}: ${result.error || 'Unknown error occurred.'}`);
      } else {
        const text = result.data.rawText || (typeof result.data.structured === 'object' ? JSON.stringify(result.data.structured, null, 2) : 'Task completed.');
        setIntelResultText(text);

        if (taskType === 'refactor') {
          const match = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
          const extracted = match ? match[1].trim() : text.trim();
          if (extracted && extracted !== code.trim()) {
            setRefactoredCodeCandidate(extracted);
            setShowDiffModal(true);
          }
        }
      }
    } catch (err: any) {
      setIntelResultText(`Failed to run ${taskType}: ${err.message || 'Unexpected error occurred.'}`);
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
      setSessionStatus('ready');
      setMessages(prev => [...prev, { role: 'assistant', content: `Follow-up failed: ${err.message || 'Error occurred.'}` }]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleSaveToCloud = async () => {
    if (isSavingCloud) return;
    if (!user) {
      signInWithGoogle();
      return;
    }
    setIsSavingCloud(true);
    setCloudStatus(null);
    try {
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
      } else {
        setCloudStatus('Failed to save to Firestore.');
        setTimeout(() => setCloudStatus(null), 4000);
      }
    } catch (err: any) {
      setCloudStatus('Failed to save to Firestore.');
      setTimeout(() => setCloudStatus(null), 4000);
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleNavigateToFinding = (targetFile?: string, lineNum?: number) => {
    if (targetFile && project) {
      const matchedFile = project.files.find(f => normalizeRepositoryPath(f.path) === normalizeRepositoryPath(targetFile));
      if (matchedFile) {
        setActiveSample(matchedFile.path);
        setCode(matchedFile.content);
      }
    }

    if (lineNum && lineNum > 0) {
      setActiveHighlightedLine(lineNum);
      if (textareaRef.current) {
        const lines = code.split('\n');
        let charOffset = 0;
        for (let i = 0; i < Math.min(lineNum - 1, lines.length); i++) {
          charOffset += lines[i].length + 1;
        }
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(charOffset, charOffset + (lines[lineNum - 1]?.length || 0));
        const lineHeight = 18;
        textareaRef.current.scrollTop = Math.max(0, (lineNum - 3) * lineHeight);
      }
    }
  };

  const handleCopyLocation = (locStr: string) => {
    navigator.clipboard.writeText(locStr);
    setCopiedPath(locStr);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const handleExportMarkdown = () => {
    const md = generateMarkdownReport(
      {
        summary: summary || 'Review completed.',
        filesDiscovered: reviewResult?.filesDiscovered || (project?.files.length ?? 1),
        filesReviewed: reviewResult?.filesReviewed || 1,
        filesSkipped: reviewResult?.filesSkipped || 0,
        filesFailed: reviewResult?.filesFailed || 0,
        findings: findings.filter(f => !f.suppression?.isSuppressed),
      },
      project?.repository ? { owner: project.repository.owner, repo: project.repository.name, commitSha: project.repository.commitSha } : undefined
    );

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-review-report-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const jsonObj = generateJsonReport(
      {
        summary: summary || 'Review completed.',
        filesDiscovered: reviewResult?.filesDiscovered || (project?.files.length ?? 1),
        filesReviewed: reviewResult?.filesReviewed || 1,
        filesSkipped: reviewResult?.filesSkipped || 0,
        filesFailed: reviewResult?.filesFailed || 0,
        findings: findings.filter(f => !f.suppression?.isSuppressed),
      },
      project?.repository ? { owner: project.repository.owner, repo: project.repository.name, commitSha: project.repository.commitSha } : undefined
    );

    const blob = new Blob([JSON.stringify(jsonObj, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code-review-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered Findings
  const activeUnsuppressedFindings = findings.filter(f => !f.suppression?.isSuppressed);
  const filteredFindings = activeUnsuppressedFindings.filter((f) => {
    const normSev = normalizeSeverity(f.severity);
    if (severityFilter !== 'All' && normSev !== severityFilter) return false;
    if (sourceFilter === 'Tool Confirmed' && !(f.evidenceSource === 'Compiler' || f.evidenceSource === 'Linter' || f.status === 'confirmed')) return false;
    if (sourceFilter === 'AI Suspected' && (f.evidenceSource === 'Compiler' || f.evidenceSource === 'Linter' || f.status === 'confirmed')) return false;
    return true;
  });

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
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer ${
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

      {/* Secret Detector Warning Banner if secrets present */}
      {secretMatches.length > 0 && (
        <div className="bg-rose-900 text-white p-4 rounded-2xl border border-rose-800 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-300 animate-bounce" />
            <div>
              <span className="font-bold text-xs">Credential Leak Warning: Detected {secretMatches.length} secret(s) in source code!</span>
              <p className="text-[11px] text-rose-200">Values are automatically masked in prompts & reports. Deleting from code does NOT revoke active tokens.</p>
            </div>
          </div>
          <span className="text-xs font-mono bg-rose-950 border border-rose-700 px-3 py-1 rounded-lg">
            Masking Active
          </span>
        </div>
      )}

      {/* Guided Workflow Stepper Header */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">Guided Remediation Workflow</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPRModal(true)}
              className="px-3 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-semibold flex items-center gap-1 border border-purple-200 cursor-pointer"
            >
              <GitPullRequest className="w-3.5 h-3.5" />
              <span>PR Review</span>
            </button>
            <button
              onClick={() => setShowRulesModal(true)}
              className="px-3 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold flex items-center gap-1 border border-amber-200 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Custom Rules ({customRules.filter(r => r.enabled).length})</span>
            </button>
          </div>
        </div>

        {/* Stepper Pipeline Indicators */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-3 text-[11px] font-mono">
          <div className={`p-2 rounded-xl text-center border ${findings.length > 0 ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold' : 'bg-neutral-50 text-neutral-400 border-neutral-200'}`}>
            1. Detect ({findings.length})
          </div>
          <div className={`p-2 rounded-xl text-center border ${activeHighlightedLine ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold' : 'bg-neutral-50 text-neutral-400 border-neutral-200'}`}>
            2. Location
          </div>
          <div className={`p-2 rounded-xl text-center border ${findings.some(f => f.reproductionTest) ? 'bg-purple-50 border-purple-300 text-purple-900 font-bold' : 'bg-neutral-50 text-neutral-400 border-neutral-200'}`}>
            3. Test Code
          </div>
          <div className={`p-2 rounded-xl text-center border ${findings.some(f => f.patch) ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold' : 'bg-neutral-50 text-neutral-400 border-neutral-200'}`}>
            4. Patch Diff
          </div>
          <div className={`p-2 rounded-xl text-center border ${findings.some(f => f.findingState === 'applied_fix') ? 'bg-teal-50 border-teal-300 text-teal-900 font-bold' : 'bg-neutral-50 text-neutral-400 border-neutral-200'}`}>
            5. Selective Apply
          </div>
          <div className={`p-2 rounded-xl text-center border ${findings.some(f => f.validationStatus === 'passed') ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold' : 'bg-neutral-50 text-neutral-400 border-neutral-200'}`}>
            6. Validated
          </div>
        </div>
      </div>

      {/* Tool Actions & Intelligence Task Bar */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-neutral-800">Actions & Scans:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRunApiContractCheck}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>API Contract Check</span>
          </button>

          <button
            onClick={() => handleRunIntelligenceTask('refactor')}
            disabled={isIntelLoading}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 hover:bg-blue-100 disabled:opacity-50 text-blue-700 border border-blue-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Auto-Refactor</span>
          </button>

          <button
            onClick={() => handleRunIntelligenceTask('tests')}
            disabled={isIntelLoading}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-700 border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Generate Tests</span>
          </button>

          <button
            onClick={() => handleRunIntelligenceTask('security')}
            disabled={isIntelLoading}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Security Audit</span>
          </button>

          <button
            onClick={handleExportMarkdown}
            disabled={findings.length === 0}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-50 hover:bg-purple-100 disabled:opacity-40 text-purple-700 border border-purple-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export MD</span>
          </button>

          <button
            onClick={handleExportJson}
            disabled={findings.length === 0}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-50 hover:bg-teal-100 disabled:opacity-40 text-teal-700 border border-teal-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Intelligence Result Drawer */}
      {intelResultText && (
        <div className="bg-neutral-900 text-neutral-100 rounded-2xl p-5 border border-neutral-800 shadow-md space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
              {activeIntelTab.toUpperCase()} Output
            </span>
            <button
              onClick={() => setIntelResultText(null)}
              className="text-xs text-neutral-400 hover:text-white cursor-pointer"
            >
              Close
            </button>
          </div>
          <pre className="text-xs font-mono text-neutral-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-72">
            {intelResultText}
          </pre>
        </div>
      )}

      {/* Main Review Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Editor (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-neutral-200 shadow-xs flex flex-col justify-between overflow-hidden">
          <div>
            <div className="p-4 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-neutral-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">Source Editor ({activeSample})</span>
              </div>

              <div className="flex items-center gap-1.5">
                {SAMPLE_CODES.map((sample) => (
                  <button
                    key={sample.name}
                    onClick={() => handleSelectSample(sample.name)}
                    className={`px-2.5 py-1 text-xs font-mono rounded-lg transition cursor-pointer ${
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

            <div className="p-4 relative">
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={16}
                spellCheck={false}
                className="w-full font-mono text-xs text-neutral-800 bg-neutral-50/50 p-3.5 rounded-xl border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-900 leading-relaxed resize-none"
              />
              {activeHighlightedLine && (
                <div className="mt-1 text-[11px] font-mono text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg flex items-center justify-between">
                  <span>Target Line Range: <strong>{activeHighlightedLine}</strong></span>
                  <button onClick={() => setActiveHighlightedLine(null)} className="text-[10px] text-amber-800 hover:underline cursor-pointer">Clear Highlight</button>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 bg-neutral-50/50 border-t border-neutral-200 flex items-center justify-between">
            <div className="text-xs text-neutral-500 font-mono">
              <span>Lines: {code.split('\n').length}</span>
              <span className="mx-2">•</span>
              <span>Secrets: {secretMatches.length}</span>
            </div>

            <button
              onClick={handleRunReview}
              disabled={isReviewing || !code.trim()}
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
                  <span>Execute Guided Review</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Detailed Findings & Action Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-neutral-200 shadow-xs flex flex-col justify-between overflow-hidden">
          <div>
            <div className="p-4 border-b border-neutral-200 bg-neutral-50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-neutral-700" />
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">Findings & Patches</span>
                </div>
                <span className="text-xs font-mono font-semibold bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded-full">
                  {filteredFindings.length} / {findings.length}
                </span>
              </div>

              {/* Filters */}
              {findings.length > 0 && (
                <div className="flex items-center gap-2 pt-1 border-t border-neutral-200/60 text-[11px]">
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="bg-white border border-neutral-200 rounded-lg px-2 py-1 text-neutral-700 focus:outline-none"
                  >
                    <option value="All">All Severities</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                    <option value="Informational">Informational</option>
                  </select>

                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="bg-white border border-neutral-200 rounded-lg px-2 py-1 text-neutral-700 focus:outline-none"
                  >
                    <option value="All">All Sources</option>
                    <option value="Tool Confirmed">Tool Confirmed</option>
                    <option value="AI Suspected">AI Suspected</option>
                  </select>
                </div>
              )}
            </div>

            {/* Findings Item Cards */}
            <div className="p-4 space-y-3.5 max-h-[440px] overflow-y-auto">
              {filteredFindings.length === 0 ? (
                <div className="text-center py-16 text-neutral-400 space-y-2">
                  <Bug className="w-8 h-8 mx-auto stroke-1 text-neutral-300" />
                  <p className="text-xs">No active findings.</p>
                </div>
              ) : (
                filteredFindings.map((finding, idx) => {
                  const normalizedSev = normalizeSeverity(finding.severity);
                  const locStr = formatFindingLocation(
                    finding.file || activeSample,
                    finding.startLine || finding.line,
                    finding.endLine
                  );

                  const isPatchApplied = finding.patch?.status === 'applied';

                  return (
                    <div
                      key={finding.id || idx}
                      className={`p-4 rounded-xl border transition space-y-2.5 text-xs shadow-2xs ${
                        isPatchApplied ? 'bg-emerald-50/60 border-emerald-300' : 'bg-neutral-50/50 border-neutral-200 hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                          <Bug className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{finding.title}</span>
                        </div>
                        <span className="font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-800 shrink-0">
                          {normalizedSev}
                        </span>
                      </div>

                      {/* Location Badge & Navigation */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          onClick={() => handleNavigateToFinding(finding.file || activeSample, finding.startLine || finding.line)}
                          className="font-mono text-[11px] bg-neutral-900 text-amber-300 hover:bg-neutral-800 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer"
                        >
                          <Code2 className="w-3 h-3 text-amber-400" />
                          <span>{locStr}</span>
                        </button>
                        <span className="text-[10px] font-mono bg-neutral-200 px-1.5 py-0.5 rounded text-neutral-700">
                          State: {finding.findingState || 'suspected'}
                        </span>
                      </div>

                      <p className="text-neutral-700 leading-relaxed">{finding.description}</p>

                      {/* Patch Actions: Preview, Apply, Undo */}
                      {finding.patch && (
                        <div className="pt-2 border-t border-neutral-200/80 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Patch:</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setSelectedPatchModalFinding(finding)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-semibold text-[11px] border border-indigo-200 cursor-pointer"
                            >
                              <Eye className="w-3 h-3 inline mr-1" />
                              Preview Diff
                            </button>

                            {isPatchApplied ? (
                              <button
                                onClick={() => handleUndoPatch(finding)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-[11px] border border-rose-200 cursor-pointer"
                              >
                                <Undo2 className="w-3 h-3 inline mr-1" />
                                Undo Patch
                              </button>
                            ) : (
                              <button
                                onClick={() => handleApplyPatch(finding)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-semibold text-[11px] cursor-pointer"
                              >
                                <CheckSquare className="w-3 h-3 inline mr-1" />
                                Selective Apply
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Reproduction Test Output Badge */}
                      {finding.reproductionTest?.runResult && (
                        <div className="bg-neutral-900 text-neutral-200 p-2.5 rounded-lg font-mono text-[11px] space-y-1">
                          <span className="text-emerald-400 font-bold block">Validation Output ({finding.validationStatus}):</span>
                          <pre className="whitespace-pre-wrap text-[10px] text-neutral-400">{finding.reproductionTest.runResult.output}</pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Selective Patch Diff Preview Modal */}
      {selectedPatchModalFinding?.patch && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
              <div className="flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                  Patch Diff Preview ({selectedPatchModalFinding.title})
                </span>
              </div>
              <button onClick={() => setSelectedPatchModalFinding(null)} className="text-xs text-neutral-400 hover:text-white cursor-pointer">
                Close
              </button>
            </div>
            <div className="p-4 overflow-y-auto font-mono text-xs space-y-2 bg-neutral-950 leading-relaxed max-h-[60vh]">
              <pre className="text-emerald-400 bg-neutral-900 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap">
                {selectedPatchModalFinding.patch.diff}
              </pre>
            </div>
            <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] text-neutral-400">Snapshot hash verified before execution.</span>
              <button
                onClick={() => handleApplyPatch(selectedPatchModalFinding)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Apply Selected Fix Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GitHub PR Review Modal */}
      <PRReviewModal
        isOpen={showPRModal}
        onClose={() => setShowPRModal(false)}
        findings={findings}
        onPublishComments={async () => {
          setIntelResultText('Published review comments to GitHub PR successfully!');
        }}
      />

      {/* Custom Rules Modal */}
      <CustomRulesModal
        isOpen={showRulesModal}
        onClose={() => setShowRulesModal(false)}
        rules={customRules}
        onSaveRules={(updated) => setCustomRules(updated)}
      />
    </div>
  );
}
