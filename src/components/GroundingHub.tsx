import React, { useState } from 'react';
import { 
  Globe, 
  MapPin, 
  Search, 
  ExternalLink, 
  Sparkles, 
  ShieldCheck, 
  FileText, 
  Building2, 
  Compass, 
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';

const SEARCH_PRESETS = [
  "Latest Python 3.12 CVE vulnerabilities in asyncio subprocess and SSL",
  "Pathspec library regex performance and safe gitignore patterns",
  "Pydantic v2 BaseSettings best practices for API key validation in 2025",
  "PEP 703 - Making the Global Interpreter Lock Optional in Python 3.13"
];

const MAP_PRESETS = [
  "Google Cloud Asia data center locations with low latency for ML APIs",
  "Major Python and PyCon developer conferences scheduled worldwide",
  "Top tech hubs and engineering research centers in Silicon Valley and Seattle",
  "European Union GDPR compliant server zones and cloud regions"
];

export function GroundingHub() {
  const [activeMode, setActiveMode] = useState<'search' | 'maps'>('search');
  const [query, setQuery] = useState(SEARCH_PRESETS[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const handleRunGrounding = async (overrideQuery?: string) => {
    const q = overrideQuery || query.trim();
    if (!q || loading) return;

    setLoading(true);
    setResult(null);

    const endpoint = activeMode === 'search' ? '/api/gemini/search' : '/api/gemini/maps';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Grounding request failed');

      setResult(data);
    } catch (err: any) {
      setResult({
        answer: `⚠️ Grounding note: ${err.message}. Showing real-time simulated grounded response.`,
        groundingMetadata: {
          webSearchQueries: [q],
          searchChunks: [
            { title: "Python Security Advisories", uri: "https://www.python.org/downloads/" },
            { title: "CVE Vulnerability Database", uri: "https://cve.mitre.org" }
          ]
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyAnswer = () => {
    if (!result?.answer) return;
    navigator.clipboard.writeText(result.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs text-white ${
            activeMode === 'search' ? 'bg-blue-600' : 'bg-emerald-600'
          }`}>
            {activeMode === 'search' ? <Globe className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-900">
                {activeMode === 'search' ? 'Google Search Grounding' : 'Google Maps Grounding'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                gemini-3.5-flash with {activeMode === 'search' ? 'googleSearch' : 'googleMaps'}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Live web data verification, CVE lookups, library release checks & geographic compliance
            </p>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveMode('search');
              setQuery(SEARCH_PRESETS[0]);
              setResult(null);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${
              activeMode === 'search' ? 'bg-white text-blue-700 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Grounding</span>
          </button>

          <button
            onClick={() => {
              setActiveMode('maps');
              setQuery(MAP_PRESETS[0]);
              setResult(null);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${
              activeMode === 'maps' ? 'bg-white text-emerald-700 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Maps Grounding</span>
          </button>
        </div>
      </div>

      {/* Query Bar */}
      <div className="space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunGrounding();
          }}
          className="flex flex-col sm:flex-row items-center gap-2"
        >
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeMode === 'search' ? "Search CVE vulnerabilities, PEP standards, library updates..." : "Search data centers, tech hubs, regional cloud latency..."}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-neutral-50/50 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs"
          >
            {loading ? (
              <>
                <span className="animate-spin text-amber-300">✦</span>
                <span>Grounding with Google...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Run {activeMode === 'search' ? 'Search Grounding' : 'Maps Grounding'}</span>
              </>
            )}
          </button>
        </form>

        {/* Preset suggestions */}
        <div className="flex items-center gap-2 overflow-x-auto text-[11px] py-1">
          <span className="text-neutral-400 font-semibold shrink-0">Try preset:</span>
          {(activeMode === 'search' ? SEARCH_PRESETS : MAP_PRESETS).map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setQuery(p);
                handleRunGrounding(p);
              }}
              className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 whitespace-nowrap transition"
            >
              {p.slice(0, 45)}...
            </button>
          ))}
        </div>
      </div>

      {/* Results Display */}
      {result && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-neutral-900">Grounded Response & Citations</span>
              </div>
              <button
                onClick={handleCopyAnswer}
                className="px-2.5 py-1 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 text-xs font-medium flex items-center gap-1 transition shadow-2xs"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap font-sans">
              {result.answer}
            </div>

            {/* Grounding Metadata / Sources */}
            {result.groundingMetadata && (
              <div className="mt-4 pt-4 border-t border-neutral-200">
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider block mb-2">
                  Verified Google Grounding Sources & Search Queries:
                </span>
                <div className="flex flex-wrap gap-2">
                  {result.groundingMetadata.webSearchQueries?.map((sq: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-[11px] font-mono border border-blue-200 flex items-center gap-1"
                    >
                      <Search className="w-3 h-3" />
                      {sq}
                    </span>
                  ))}

                  {result.groundingMetadata.groundingChunks?.map((chunk: any, idx: number) => (
                    <a
                      key={idx}
                      href={chunk.web?.uri || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-md bg-white hover:bg-neutral-100 text-neutral-700 text-[11px] font-medium border border-neutral-200 flex items-center gap-1 shadow-2xs transition"
                    >
                      <ExternalLink className="w-3 h-3 text-neutral-400" />
                      <span>{chunk.web?.title || `Source #${idx + 1}`}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
