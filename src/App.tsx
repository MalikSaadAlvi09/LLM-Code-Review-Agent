import React, { useState } from 'react';
import { 
  Terminal, 
  FileCode, 
  Sparkles, 
  Layers, 
  FileText, 
  GitBranch, 
  ShieldCheck, 
  Copy, 
  Check,
  Cpu,
  Bot,
  MessageSquare,
  Mic,
  Globe,
  Image as ImageIcon,
  Cloud,
  User as UserIcon,
  LogOut,
  LogIn,
  Sliders,
  Settings as SettingsIcon,
  Key
} from 'lucide-react';
import { CodeExplorer } from './components/CodeExplorer';
import { ReviewRunner } from './components/ReviewRunner';
import { ChunkingLab } from './components/ChunkingLab';
import { ReportViewer } from './components/ReportViewer';
import { CliGuide } from './components/CliGuide';
import { GeminiChat } from './components/GeminiChat';
import { VoiceStudio } from './components/VoiceStudio';
import { GroundingHub } from './components/GroundingHub';
import { ImageStudio } from './components/ImageStudio';
import { CloudDrawer } from './components/CloudDrawer';
import { OpenRouterSettings } from './components/OpenRouterSettings';
import { CodebaseImport } from './components/CodebaseImport';
import { ImportedProject } from './types';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { user, signInWithGoogle, signInWithGitHub, signOut, openRouterConfig } = useAuth();
  const [activeTab, setActiveTab] = useState<'simulator' | 'chat' | 'voice' | 'grounding' | 'images' | 'chunking' | 'code' | 'report' | 'cli' | 'settings'>('simulator');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [importedProject, setImportedProject] = useState<ImportedProject | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      setAuthError(error.message || 'Google sign-in failed.');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-100/60 text-neutral-900 flex flex-col font-sans antialiased">
      {/* Top Header Navigation */}
      <header id="main-header" className="border-b border-neutral-200/90 bg-white/95 backdrop-blur sticky top-0 z-30 px-6 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-950 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-lilita text-lg tracking-wide text-neutral-900">LLM Code Review Agent</h1>
                <span className="text-[11px] font-baloo font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                  Gemini & Nemotron 70B
                </span>
              </div>
              <p className="text-xs font-fredoka text-neutral-500">
                Autonomous Python reviewer with Nemotron 70B, Gemini 3.5 Flash, Voice Live API & Cloud Sync
              </p>
            </div>
          </div>

          {/* User Auth, OpenRouter Config and Cloud Button */}
          <div className="flex items-center gap-2.5">
            <button
              id="openrouter-settings-header-btn"
              onClick={() => setActiveTab('settings')}
              className={`px-3.5 py-2 rounded-xl border text-xs font-baloo font-bold flex items-center gap-1.5 shadow-2xs transition ${
                activeTab === 'settings'
                  ? 'bg-neutral-950 text-white border-neutral-950'
                  : 'bg-white border-neutral-200 hover:bg-neutral-100 text-neutral-800'
              }`}
              title="Configure OpenRouter API Key & Nemotron 70B"
            >
              <Cpu className="w-4 h-4 text-amber-500" />
              <span>Model Config</span>
              {openRouterConfig.apiKey ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="OpenRouter Key Active" />
              ) : null}
            </button>

            <button
              id="cloud-storage-btn"
              onClick={() => setIsDrawerOpen(true)}
              className="px-3.5 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-800 text-xs font-baloo font-bold flex items-center gap-1.5 shadow-2xs transition"
            >
              <Cloud className="w-4 h-4 text-blue-600" />
              <span>Cloud Storage</span>
            </button>

            {user ? (
              <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 pl-1.5 pr-2.5 py-1.5 rounded-xl font-fredoka">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || 'User'} className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-neutral-900 text-white flex items-center justify-center text-[10px] font-bold">
                    {user.displayName?.[0] || 'U'}
                  </div>
                )}
                <span className="text-xs font-medium text-neutral-800 max-w-[120px] truncate">
                  {user.displayName?.split(' ')[0] || 'User'}
                </span>
                <button
                  onClick={signOut}
                  className="text-neutral-400 hover:text-rose-600 transition p-0.5 ml-1"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                id="google-signin-btn"
                onClick={handleGoogleSignIn}
                className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-baloo font-bold flex items-center gap-1.5 shadow-xs transition"
              >
                <LogIn className="w-4 h-4" />
                <span>Google Sign-In</span>
              </button>
            )}
          </div>
        </div>

        {authError && (
          <div className="max-w-7xl mx-auto mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert">
            {authError}
          </div>
        )}

        {/* View Navigation Tabs */}
        <div className="max-w-7xl mx-auto mt-3 pt-2 border-t border-neutral-100 flex items-center justify-start overflow-x-auto pb-1 gap-1.5 font-baloo font-bold">
          <button
            id="tab-simulator"
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              activeTab === 'simulator'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Review Playground</span>
          </button>

          <button
            id="tab-settings"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              activeTab === 'settings'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>OpenRouter & Models</span>
            {openRouterConfig.apiKey && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            id="tab-chat"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              activeTab === 'chat'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
            <span>Multi-Model Chatbot</span>
          </button>

          <button
            id="tab-voice"
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              activeTab === 'voice'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Mic className="w-3.5 h-3.5 text-rose-400" />
            <span>Voice Live API</span>
          </button>

          <button
            id="tab-grounding"
            onClick={() => setActiveTab('grounding')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              activeTab === 'grounding'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>Search & Grounding</span>
          </button>

          <button
            id="tab-images"
            onClick={() => setActiveTab('images')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              activeTab === 'images'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            <span>Diagram & Studio</span>
          </button>

          <button
            id="tab-chunking"
            onClick={() => setActiveTab('chunking')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              activeTab === 'chunking'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>Chunking Lab</span>
          </button>

          <button
            id="tab-code"
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              activeTab === 'code'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-neutral-400" />
            <span>Codebase Files</span>
          </button>

          <button
            id="tab-cli"
            onClick={() => setActiveTab('cli')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              activeTab === 'cli'
                ? 'bg-neutral-900 text-white shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-neutral-400" />
            <span>CLI Commands</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-6">
        <CodebaseImport project={importedProject} onProjectChange={setImportedProject} onReviewProject={() => setActiveTab('simulator')} userUid={user?.uid} onConnectGitHub={signInWithGitHub} />
        {activeTab === 'simulator' && <ReviewRunner project={importedProject} />}
        {activeTab === 'settings' && <OpenRouterSettings />}
        {activeTab === 'chat' && <GeminiChat />}
        {activeTab === 'voice' && <VoiceStudio />}
        {activeTab === 'grounding' && <GroundingHub />}
        {activeTab === 'images' && <ImageStudio />}
        {activeTab === 'chunking' && <ChunkingLab />}
        {activeTab === 'code' && <CodeExplorer />}
        {activeTab === 'report' && <ReportViewer />}
        {activeTab === 'cli' && <CliGuide />}
      </main>

      {/* Cloud Persistence Drawer */}
      <CloudDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

      {/* Clean Bottom Bar */}
      <footer className="border-t border-neutral-200 bg-white py-4 px-6 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-semibold text-neutral-800">code-review-agent</span>
            <span>• NVIDIA Nemotron 70B & Google Gemini 3.5 Flash • Firebase Firestore Persistence</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-neutral-400">
            <span>Live Audio & Search Grounding</span>
            <span>Cloud Persistence Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
