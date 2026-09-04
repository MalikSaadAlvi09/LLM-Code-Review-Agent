import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Trash2, 
  Copy, 
  Check, 
  Cloud, 
  ShieldAlert, 
  Cpu, 
  Zap, 
  Settings2, 
  FileCode,
  RotateCcw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

const ROLES = [
  {
    id: 'Senior Python Architect',
    name: 'Senior Python Architect',
    desc: 'Python 3.11+, asyncio, SOLID principles, type annotations & design patterns',
    icon: Bot,
    color: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  {
    id: 'Security Auditor',
    name: 'Security Auditor',
    desc: 'OWASP Top 10, CWE vulnerability checks, injection & race conditions',
    icon: ShieldAlert,
    color: 'text-rose-600 bg-rose-50 border-rose-200',
  },
  {
    id: 'Performance Optimizer',
    name: 'Performance Optimizer',
    desc: 'Memory profiling, GIL mitigation, Big-O analysis & I/O throughput',
    icon: Cpu,
    color: 'text-amber-600 bg-amber-50 border-amber-200',
  },
  {
    id: 'Clean Code Coach',
    name: 'Clean Code Coach',
    desc: 'PEP 8 compliance, descriptive naming, modular design & Hypothesis testing',
    icon: Sparkles,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  }
];

const MODELS = [
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct:free',
    name: 'Nemotron 70B (Free)',
    tag: 'OpenRouter Free',
    desc: 'NVIDIA Nemotron 70B Instruct via OpenRouter free tier API',
    badgeColor: 'bg-emerald-100 text-emerald-800',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    tag: 'General Tasks',
    desc: 'Fast, highly accurate general coding & review assistance',
    badgeColor: 'bg-blue-100 text-blue-800',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    tag: 'Complex Reasoning',
    desc: 'Deep reasoning, intricate architecture and complex refactoring',
    badgeColor: 'bg-purple-100 text-purple-800',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    tag: 'Fast Tasks',
    desc: 'Low latency instant queries and syntax clarifications',
    badgeColor: 'bg-neutral-100 text-neutral-800',
  }
];

const STARTER_PROMPTS = [
  "How can I refactor a sliding window chunker to handle Python multi-line docstrings cleanly?",
  "Audit the subprocess git clone execution for potential command injection vectors.",
  "Write a Hypothesis property-based test checking that chunk union covers 100% of lines.",
  "What are the memory trade-offs between yield generator chunks vs in-memory lists in Python?"
];

export function GeminiChat() {
  const { user, saveChatToCloud, signInWithGoogle, openRouterConfig } = useAuth();
  const [selectedRole, setSelectedRole] = useState(ROLES[0].id);
  const [selectedModel, setSelectedModel] = useState(
    openRouterConfig.providerType === 'openrouter' 
      ? (openRouterConfig.selectedModel || 'nvidia/llama-3.1-nemotron-70b-instruct:free') 
      : MODELS[1].id
  );
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hello! I am your AI **${selectedRole}**.\n\nAsk me anything about Python architecture, reviewing code files, fixing bugs, or writing tests with **NVIDIA Nemotron 70B** or **Google Gemini**!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: selectedModel,
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const isOpenRouter = selectedModel.includes('/') || selectedModel.includes('nemotron') || selectedModel.includes('free');

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      let data: any = null;

      if (isOpenRouter) {
        const effectiveModel = selectedModel.includes(':free') ? selectedModel : (openRouterConfig.customModelName || openRouterConfig.selectedModel || selectedModel);
        const res = await fetch('/api/openrouter/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: openRouterConfig.apiKey,
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            role: selectedRole,
            model: effectiveModel,
            systemInstruction: customSystemPrompt,
            temperature: openRouterConfig.temperature ?? 0.3
          })
        });

        data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to get OpenRouter response');
        }
      } else {
        const res = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            role: selectedRole,
            model: selectedModel,
            systemInstruction: customSystemPrompt,
          })
        });

        data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to get Gemini response');
        }
      }

      const assistantMsg: Message = {
        role: 'assistant',
        content: data.reply || 'No response returned.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: data.modelUsed || selectedModel,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      let rawMsg = err.message || 'Error communicating with AI engine';
      
      // Clean up stringified JSON if present
      try {
        if (rawMsg.includes('{') && rawMsg.includes('}')) {
          const jsonStart = rawMsg.indexOf('{');
          const parsed = JSON.parse(rawMsg.slice(jsonStart));
          if (parsed.error?.message) {
            rawMsg = parsed.error.message;
          } else if (parsed.message) {
            rawMsg = parsed.message;
          }
        }
      } catch (_) {}

      const isKeyError = rawMsg.toLowerCase().includes('api key') || rawMsg.toLowerCase().includes('unauthenticated') || rawMsg.toLowerCase().includes('invalid_argument');

      let formattedContent = '';
      if (isKeyError) {
        formattedContent = `ℹ️ **API Key Notice**: ${rawMsg}\n\n💡 **Tip**: Switch to **NVIDIA Nemotron 70B (Free)** in the Model dropdown above, or configure your OpenRouter / Gemini API key in **Model Config**.`;
      } else {
        formattedContent = `⚠️ **AI Engine Response**: ${rawMsg}\n\n*Tip: Switch model or check network connection.*`;
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: formattedContent,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: selectedModel,
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        role: 'assistant',
        content: `Chat session reset. Ready for a new discussion with the **${selectedRole}**.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: selectedModel,
      }
    ]);
  };

  const handleSaveToCloud = async () => {
    if (!user) {
      signInWithGoogle();
      return;
    }
    const title = `${selectedRole} - ${messages[1]?.content?.slice(0, 30) || 'Session'}`;
    const id = await saveChatToCloud(title, selectedRole, selectedModel, messages);
    if (id) {
      setSavedStatus('Saved to Firestore!');
      setTimeout(() => setSavedStatus(null), 3000);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs flex flex-col h-[780px] overflow-hidden">
      {/* Header Bar */}
      <div className="p-4 border-b border-neutral-200 bg-neutral-50/70 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
            <Bot className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-neutral-900">Gemini Code Chatbot</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">
                Multi-Turn
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Role: <span className="font-semibold text-neutral-700">{selectedRole}</span> • Engine: <span className="font-semibold text-neutral-700">{MODELS.find(m => m.id === selectedModel)?.name}</span>
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-2 rounded-xl text-xs font-medium border transition flex items-center gap-1.5 ${
              showConfig ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
            }`}
            title="Configure System Role & Model"
          >
            <Settings2 className="w-4 h-4" />
            <span className="hidden sm:inline">Role & Model</span>
          </button>

          <button
            onClick={handleSaveToCloud}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-800 transition flex items-center gap-1.5 shadow-2xs"
            title={user ? "Save conversation thread to Firestore" : "Sign in to save"}
          >
            <Cloud className="w-3.5 h-3.5 text-blue-600" />
            <span>{savedStatus || (user ? 'Save to Cloud' : 'Sign in to Save')}</span>
          </button>

          <button
            onClick={handleClear}
            className="p-2 rounded-xl text-xs text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 border border-neutral-200 transition"
            title="Clear Chat History"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Role & Model Configuration Panel */}
      {showConfig && (
        <div className="p-4 bg-neutral-100/70 border-b border-neutral-200 text-xs space-y-3 animate-in fade-in duration-200">
          <div>
            <label className="font-bold text-neutral-700 block mb-1.5">Select Chatbot Role & Personality:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const isSelected = selectedRole === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRole(r.id)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected 
                        ? 'bg-white border-neutral-900 shadow-xs ring-1 ring-neutral-900' 
                        : 'bg-white/80 border-neutral-200 hover:bg-white text-neutral-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                      <Icon className="w-4 h-4 text-neutral-700" />
                      <span>{r.name}</span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">{r.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div>
              <label className="font-bold text-neutral-700 block mb-1.5">Gemini Model Selector:</label>
              <div className="space-y-1.5">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id)}
                    className={`w-full p-2 rounded-xl border text-left flex items-center justify-between transition ${
                      selectedModel === m.id
                        ? 'bg-white border-neutral-900 shadow-xs font-semibold'
                        : 'bg-white/80 border-neutral-200 hover:bg-white text-neutral-600'
                    }`}
                  >
                    <div>
                      <span className="font-medium text-neutral-900">{m.name}</span>
                      <span className="text-[10px] text-neutral-500 ml-2">{m.desc}</span>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.badgeColor}`}>
                      {m.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-bold text-neutral-700 block mb-1.5">Custom System Instruction (Optional):</label>
              <textarea
                value={customSystemPrompt}
                onChange={(e) => setCustomSystemPrompt(e.target.value)}
                placeholder="e.g. Always output code formatted in Python 3.12 with async/await and strict pydantic v2 schemas..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-neutral-300 bg-white text-xs text-neutral-800 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
          </div>
        </div>
      )}

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-neutral-50/40">
        {messages.map((msg, idx) => {
          const isAssistant = msg.role === 'assistant';
          return (
            <div
              key={idx}
              className={`flex gap-3 max-w-3xl ${isAssistant ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                  isAssistant ? 'bg-neutral-900 text-white' : 'bg-blue-600 text-white'
                }`}
              >
                {isAssistant ? <Bot className="w-4 h-4 text-amber-300" /> : <div className="text-xs font-bold">U</div>}
              </div>

              <div
                className={`rounded-2xl p-4 shadow-2xs text-xs leading-relaxed relative group ${
                  isAssistant
                    ? 'bg-white border border-neutral-200 text-neutral-800'
                    : 'bg-neutral-900 text-white'
                }`}
              >
                <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-neutral-100 text-[10px] text-neutral-400">
                  <span className="font-semibold">{isAssistant ? selectedRole : 'You'}</span>
                  <div className="flex items-center gap-2">
                    {msg.model && <span className="font-mono bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">{msg.model}</span>}
                    <span>{msg.timestamp}</span>
                    <button
                      onClick={() => handleCopy(msg.content, idx)}
                      className="opacity-0 group-hover:opacity-100 hover:text-neutral-900 transition p-0.5"
                      title="Copy message"
                    >
                      {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="whitespace-pre-wrap font-sans">
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 mr-auto max-w-3xl">
            <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shrink-0 animate-pulse">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-2xs flex items-center gap-2 text-xs text-neutral-600">
              <span className="animate-spin text-amber-500">✦</span>
              <span>Gemini is analyzing & drafting response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Starter Prompts */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 bg-white border-t border-neutral-100 flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-neutral-400 font-semibold shrink-0">Ideas:</span>
          {STARTER_PROMPTS.map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSend(prompt)}
              className="px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 whitespace-nowrap transition"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <div className="p-3.5 bg-white border-t border-neutral-200">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message here..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 text-xs text-neutral-900 bg-neutral-50/50"
          />

          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
