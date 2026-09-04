import React, { useState } from 'react';
import { 
  Sparkles, 
  Image as ImageIcon, 
  Wand2, 
  Download, 
  Cloud, 
  Maximize2, 
  RefreshCw, 
  Layers, 
  Sliders, 
  Check, 
  Copy,
  PenTool
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PRESET_HQ_PROMPTS = [
  "Comprehensive microservices code review pipeline architecture blueprint with AST token chunking and AST validation gates",
  "Cyber security threat analysis topology for Python asyncio socket connection pool",
  "Property-based testing coverage matrix and line boundary overlap graph",
  "High-concurrency worker queue architecture diagram with Redis and Celery"
];

const PRESET_EDIT_INSTRUCTIONS = [
  "Add a dedicated Security Gate before the LLM Review stage",
  "Highlight the Line Boundary Overlap window in amber accent",
  "Insert an automated pytest execution box after the Refactoring block",
  "Convert the layout from vertical pipeline to horizontal microservices mesh"
];

export function ImageStudio() {
  const { user, saveDiagramToCloud, signInWithGoogle } = useAuth();
  const [tab, setTab] = useState<'hq' | 'edit'>('hq');
  
  // HQ Generation States
  const [hqPrompt, setHqPrompt] = useState(PRESET_HQ_PROMPTS[0]);
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('2K');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | '1:1'>('16:9');
  const [styleTheme, setStyleTheme] = useState('technical blueprint');

  // Edit / Create States
  const [editPrompt, setEditPrompt] = useState('Python Code Review Pipeline with Sliding Window Token Chunker');
  const [editInstruction, setEditInstruction] = useState(PRESET_EDIT_INSTRUCTIONS[0]);
  
  // Shared States
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string>('gemini-3-pro-image-preview');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const handleGenerateHQ = async () => {
    if (!hqPrompt.trim() || loading) return;
    setLoading(true);
    setImageUrl(null);
    setActiveModel('gemini-3-pro-image-preview');

    try {
      const res = await fetch('/api/gemini/image/generate-hq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: hqPrompt,
          resolution,
          aspectRatio,
          style: styleTheme,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate image');
      setImageUrl(data.imageUrl);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrEdit = async () => {
    if ((!editPrompt.trim() && !editInstruction.trim()) || loading) return;
    setLoading(true);
    setImageUrl(null);
    setActiveModel('gemini-3.1-flash-image-preview');

    try {
      const res = await fetch('/api/gemini/image/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: editPrompt,
          editInstruction: editInstruction,
          style: 'flowchart',
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to edit image');
      setImageUrl(data.imageUrl);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToFirestore = async () => {
    if (!imageUrl) return;
    if (!user) {
      signInWithGoogle();
      return;
    }

    const currentPrompt = tab === 'hq' ? hqPrompt : `${editPrompt} [Edit: ${editInstruction}]`;
    const docId = await saveDiagramToCloud(currentPrompt, activeModel, resolution, imageUrl);
    if (docId) {
      setSaveStatus('Saved to Firestore!');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `architecture-diagram-${resolution.toLowerCase()}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-950 text-white flex items-center justify-center shadow-xs">
            <ImageIcon className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-900">Architecture Diagram & Image Studio</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {tab === 'hq' ? 'gemini-3-pro-image-preview' : 'gemini-3.1-flash-image-preview'}
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Generate 1K/2K/4K technical blueprints & iteratively edit system flowcharts via natural language
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200 text-xs font-semibold">
          <button
            onClick={() => {
              setTab('hq');
              setImageUrl(null);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${
              tab === 'hq' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-purple-600" />
            <span>HQ Generation (1K/2K/4K)</span>
          </button>

          <button
            onClick={() => {
              setTab('edit');
              setImageUrl(null);
            }}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${
              tab === 'edit' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <PenTool className="w-3.5 h-3.5 text-amber-600" />
            <span>Create & Edit Flowcharts</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Controls + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {tab === 'hq' ? (
            <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900">1. Blueprint Prompt</span>
                <span className="text-[10px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded">gemini-3-pro-image-preview</span>
              </div>

              <textarea
                value={hqPrompt}
                onChange={(e) => setHqPrompt(e.target.value)}
                placeholder="Describe your architecture diagram or blueprint..."
                rows={3}
                className="w-full p-3 rounded-xl border border-neutral-300 text-xs text-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />

              {/* Resolution Affordance (1K, 2K, 4K) */}
              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1.5">
                  Resolution Affordance (High Quality Spec):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['1K', '2K', '4K'] as const).map((res) => (
                    <button
                      key={res}
                      type="button"
                      onClick={() => setResolution(res)}
                      className={`py-2 rounded-xl text-xs font-bold transition border ${
                        resolution === res
                          ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                          : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                      }`}
                    >
                      {res} Ultra-HD
                    </button>
                  ))}
                </div>
              </div>

              {/* Aspect Ratio & Style */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1.5">Aspect Ratio:</label>
                  <select
                    value={aspectRatio}
                    onChange={(e: any) => setAspectRatio(e.target.value)}
                    className="w-full p-2 rounded-xl border border-neutral-300 text-xs bg-white text-neutral-900"
                  >
                    <option value="16:9">16:9 Landscape</option>
                    <option value="4:3">4:3 Standard</option>
                    <option value="1:1">1:1 Square</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-neutral-700 block mb-1.5">Aesthetic Style:</label>
                  <select
                    value={styleTheme}
                    onChange={(e) => setStyleTheme(e.target.value)}
                    className="w-full p-2 rounded-xl border border-neutral-300 text-xs bg-white text-neutral-900"
                  >
                    <option value="technical blueprint">Technical Blueprint</option>
                    <option value="dark architecture">Dark Microservices</option>
                    <option value="clean vector">Clean Minimal Vector</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerateHQ}
                disabled={loading || !hqPrompt.trim()}
                className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs"
              >
                {loading ? (
                  <>
                    <span className="animate-spin text-amber-300">✦</span>
                    <span>Rendering {resolution} Diagram...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Generate {resolution} Image with Gemini 3 Pro</span>
                  </>
                )}
              </button>

              {/* Presets */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                  Try Prompt Preset:
                </span>
                <div className="space-y-1">
                  {PRESET_HQ_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setHqPrompt(p)}
                      className="w-full text-left p-2 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-200 text-[11px] text-neutral-700 truncate"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-900">Create & Edit with Text Prompts</span>
                <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded">gemini-3.1-flash-image-preview</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">Base Architecture Subject:</label>
                <input
                  type="text"
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs bg-white text-neutral-900"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-700 block mb-1">
                  Natural Language Edit Instruction:
                </label>
                <textarea
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  placeholder="e.g. Add a Security Gate before the LLM Review stage..."
                  rows={3}
                  className="w-full p-2.5 rounded-xl border border-neutral-300 text-xs bg-white text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <button
                onClick={handleCreateOrEdit}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">✦</span>
                    <span>Applying Image Edit...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Apply Edit with Flash Image Preview</span>
                  </>
                )}
              </button>

              {/* Edit Presets */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                  Preset Edit Instructions:
                </span>
                <div className="space-y-1">
                  {PRESET_EDIT_INSTRUCTIONS.map((inst, i) => (
                    <button
                      key={i}
                      onClick={() => setEditInstruction(inst)}
                      className="w-full text-left p-2 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-200 text-[11px] text-neutral-700 truncate"
                    >
                      {inst}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Visual Canvas & Actions (7 cols) */}
        <div className="lg:col-span-7 bg-neutral-950 text-neutral-100 rounded-2xl p-5 border border-neutral-800 flex flex-col justify-between min-h-[480px]">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-neutral-300">Generated Architecture Canvas</span>
                <span className="text-[10px] font-mono bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
                  {activeModel}
                </span>
              </div>

              {imageUrl && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveToFirestore}
                    className="px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center gap-1.5 transition"
                    title={user ? "Save diagram to Firestore" : "Sign in to save"}
                  >
                    <Cloud className="w-3 h-3 text-blue-400" />
                    <span>{saveStatus || (user ? 'Save Cloud' : 'Sign in')}</span>
                  </button>

                  <button
                    onClick={handleDownload}
                    className="px-2.5 py-1 rounded-md bg-white text-neutral-950 hover:bg-neutral-200 text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </button>
                </div>
              )}
            </div>

            {/* Display Box */}
            {imageUrl ? (
              <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900 flex items-center justify-center p-2">
                <img
                  src={imageUrl}
                  alt="Architecture Blueprint"
                  className="max-h-[380px] w-full object-contain rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-3 text-neutral-500">
                <ImageIcon className="w-12 h-12 stroke-1 text-neutral-700" />
                <p className="text-xs">No diagram rendered yet.</p>
                <p className="text-[11px] text-neutral-600">
                  Select a prompt and click Generate HQ or Apply Edit to produce visual blueprints.
                </p>
              </div>
            )}
          </div>

          {imageUrl && (
            <div className="pt-3 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between">
              <span>Resolution: {resolution} • Model: {activeModel}</span>
              <span>Vector Scalable • Cloud Persist Enabled</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
