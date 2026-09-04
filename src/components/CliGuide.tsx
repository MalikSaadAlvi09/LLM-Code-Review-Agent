import React, { useState } from 'react';
import { Terminal, Copy, Check, GitBranch, Play, ShieldAlert, Cpu, Sparkles, Key } from 'lucide-react';

export function CliGuide() {
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Architecture & Flow Banner */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-neutral-900" />
            <h3 className="text-base font-semibold text-neutral-900">CLI Execution Pipeline</h3>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            OpenRouter Free Nemotron 70B Supported
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
            <span className="font-mono font-bold text-neutral-900">1. Clone & Enumerate</span>
            <p className="text-neutral-500 mt-1 text-[11px] leading-relaxed">
              Shallow clone via subprocess git, walk files, exclude venvs, cache, and respect target .gitignore.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
            <span className="font-mono font-bold text-neutral-900">2. Boundary Chunking</span>
            <p className="text-neutral-500 mt-1 text-[11px] leading-relaxed">
              Sliding-window line-boundary splitting with token proxy and guaranteed lossless reconstruction.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
            <span className="font-mono font-bold text-neutral-900">3. Nemotron / Claude Review</span>
            <p className="text-neutral-500 mt-1 text-[11px] leading-relaxed">
              OpenRouter NVIDIA Nemotron Free tier or Claude structured JSON validation, fuzzy deduplication, and severity ranking.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200">
            <span className="font-mono font-bold text-neutral-900">4. Report & Follow-up</span>
            <p className="text-neutral-500 mt-1 text-[11px] leading-relaxed">
              Ordered Markdown report written to disk and serialized per-file session store for follow-up REPL.
            </p>
          </div>
        </div>
      </div>

      {/* Terminal Commands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Installation & Configuration */}
        <div className="bg-neutral-950 text-neutral-100 rounded-2xl p-5 border border-neutral-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <span className="text-xs font-mono font-semibold text-neutral-300">1. Install & Configure OpenRouter Free Key</span>
              <button
                onClick={() => copyText('install', 'git clone https://github.com/your-username/code-review-agent.git\ncd code-review-agent\npython -m venv .venv\nsource .venv/bin/activate\npip install -e ".[dev]"\nexport OPENROUTER_API_KEY="sk-or-v1-..."')}
                className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
              >
                {copiedCmd === 'install' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <pre className="p-3 font-mono text-xs text-neutral-300 leading-relaxed overflow-x-auto">
{`# Create virtualenv and install package
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -e ".[dev]"

# Configure OpenRouter Free Key (https://openrouter.ai/keys)
export OPENROUTER_API_KEY="sk-or-v1-your-openrouter-key"

# (Optional: Or use Anthropic Claude)
# export ANTHROPIC_API_KEY="sk-ant-..."`}
            </pre>
          </div>
        </div>

        {/* Run Full Review */}
        <div className="bg-neutral-950 text-neutral-100 rounded-2xl p-5 border border-neutral-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <span className="text-xs font-mono font-semibold text-neutral-300">2. Run Review with NVIDIA Nemotron 70B</span>
              <button
                onClick={() => copyText('review', 'reviewagent review https://github.com/encode/httpx.git --output ./httpx_report.md --model nvidia/llama-3.1-nemotron-70b-instruct:free')}
                className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
              >
                {copiedCmd === 'review' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <pre className="p-3 font-mono text-xs text-neutral-300 leading-relaxed overflow-x-auto">
{`# Execute review using OpenRouter Free Nemotron 70B
reviewagent review https://github.com/encode/httpx.git \\
  --output ./httpx_report.md \\
  --model nvidia/llama-3.1-nemotron-70b-instruct:free \\
  --max-tokens 3000 \\
  --overlap-tokens 300`}
            </pre>
          </div>
        </div>

        {/* Follow-up Turn */}
        <div className="bg-neutral-950 text-neutral-100 rounded-2xl p-5 border border-neutral-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <span className="text-xs font-mono font-semibold text-neutral-300">3. Interactive Follow-Up via Nemotron</span>
              <button
                onClick={() => copyText('followup', 'reviewagent followup "src/httpx/_client.py" "Why was line 180 flagged as a socket leak?"')}
                className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
              >
                {copiedCmd === 'followup' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <pre className="p-3 font-mono text-xs text-neutral-300 leading-relaxed overflow-x-auto">
{`# Reopen the saved conversation session for a file
reviewagent followup "src/httpx/_client.py" \\
  "Why is the connection pool cleanup flagged as a leak on line 180?"`}
            </pre>
          </div>
        </div>

        {/* Run Property Tests */}
        <div className="bg-neutral-950 text-neutral-100 rounded-2xl p-5 border border-neutral-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <span className="text-xs font-mono font-semibold text-neutral-300">4. Run Hypothesis Property Tests</span>
              <button
                onClick={() => copyText('pytest', 'pytest -v')}
                className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
              >
                {copiedCmd === 'pytest' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <pre className="p-3 font-mono text-xs text-neutral-300 leading-relaxed overflow-x-auto">
{`# Run full offline test suite
pytest -v

# Run chunker line invariant tests specifically
pytest tests/test_chunker.py -v`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

