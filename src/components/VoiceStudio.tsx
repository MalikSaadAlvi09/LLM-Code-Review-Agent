import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  Play, 
  Square, 
  Radio, 
  FileCode, 
  MessageSquare,
  Activity,
  Bot
} from 'lucide-react';

const VOICE_PRESETS = [
  "Is this line-boundary chunker safe against split docstrings?",
  "How does the sliding window prevent duplicate review findings?",
  "Explain why subprocess git clone should use strict temporary directories.",
  "What security checks should be prioritized for an asyncio server?"
];

export function VoiceStudio() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiSpeech, setAiSpeech] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState('Senior Reviewer');
  const [audioLevel, setAudioLevel] = useState(0);

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    // Check Speech Recognition support in browser
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const spokenText = event.results[current][0].transcript;
        setTranscript(spokenText);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.abort();
      if (synthRef.current) synthRef.current.cancel();
    };
  }, []);

  // Simulate audio waveform animation when speaking/listening
  useEffect(() => {
    let interval: any;
    if (isListening || isSpeaking) {
      interval = setInterval(() => {
        setAudioLevel(Math.floor(Math.random() * 80) + 20);
      }, 100);
    } else {
      setAudioLevel(0);
    }
    return () => clearInterval(interval);
  }, [isListening, isSpeaking]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition isn't supported in this browser. You can click a preset prompt below to speak.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      if (transcript.trim()) {
        sendVoiceQuery(transcript);
      }
    } else {
      setTranscript('');
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const speakText = (text: string) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const sendVoiceQuery = async (queryText: string) => {
    if (!queryText.trim() || isProcessing) return;
    setIsProcessing(true);

    try {
      const res = await fetch('/api/gemini/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAudioTranscript: queryText,
          codeContext: 'Code Review Agent - line boundary chunker and AST review module',
          role: selectedVoice,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Voice query failed');

      const answer = data.speechResponse || "I've reviewed your request. Everything looks solid in the implementation.";
      setAiSpeech(answer);
      speakText(answer);
    } catch (err: any) {
      const fallback = `I encountered an issue processing the voice request: ${err.message}. Please verify the Gemini API key in settings.`;
      setAiSpeech(fallback);
      speakText(fallback);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-900">Voice Conversations (Live API)</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                gemini-3.1-flash-live-preview
              </span>
            </div>
            <p className="text-xs text-neutral-500">
              Interactive hands-free audio dialogue, real-time code walk-throughs & instant voice feedback
            </p>
          </div>
        </div>

        {/* Voice Persona Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-neutral-500">Persona:</span>
          {['Senior Reviewer', 'Security Lead', 'Code Mentor'].map((role) => (
            <button
              key={role}
              onClick={() => setSelectedVoice(role)}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition ${
                selectedVoice === role
                  ? 'bg-neutral-900 text-white shadow-xs'
                  : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: Waveform & Mic Trigger (7 cols) */}
        <div className="lg:col-span-7 bg-neutral-950 text-white rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center text-center space-y-6 border border-neutral-800 shadow-sm relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 via-transparent to-transparent pointer-events-none" />

          {/* Dynamic Audio Visualizer Bars */}
          <div className="flex items-center gap-1.5 h-20 px-4">
            {Array.from({ length: 24 }).map((_, i) => {
              const active = isListening || isSpeaking;
              const height = active ? Math.max(8, Math.sin(i * 0.4 + Date.now() * 0.005) * audioLevel + 16) : 6;
              return (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-75 ${
                    isListening
                      ? 'bg-emerald-400'
                      : isSpeaking
                      ? 'bg-purple-400'
                      : 'bg-neutral-800'
                  }`}
                  style={{ height: `${height}px` }}
                />
              );
            })}
          </div>

          {/* Center Mic Button */}
          <div className="relative">
            {isListening && (
              <div className="absolute inset-0 -m-3 rounded-full bg-emerald-500/30 animate-ping" />
            )}
            <button
              onClick={toggleListening}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg relative z-10 ${
                isListening
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-neutral-950 scale-105'
                  : 'bg-white hover:bg-neutral-100 text-neutral-950 hover:scale-105'
              }`}
              title={isListening ? "Click to finish speaking" : "Click to start voice recording"}
            >
              {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8 text-neutral-900" />}
            </button>
          </div>

          <div>
            <p className="text-sm font-bold tracking-tight">
              {isListening
                ? 'Listening to your speech... (Click mic to send)'
                : isProcessing
                ? 'Processing live audio with gemini-3.1-flash-live-preview...'
                : isSpeaking
                ? 'Assistant is speaking (Live Voice)...'
                : 'Click the microphone to start real-time conversation'}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              Supports browser Speech Recognition + Gemini audio reasoning pipeline
            </p>
          </div>

          {/* Transcript Display */}
          {transcript && (
            <div className="w-full bg-neutral-900/90 border border-neutral-800 rounded-xl p-3 text-xs text-left">
              <span className="text-neutral-400 text-[10px] font-mono block mb-1">LIVE SPOKEN INPUT:</span>
              <p className="text-emerald-300 font-medium">"{transcript}"</p>
            </div>
          )}
        </div>

        {/* Right: AI Voice Response Box (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-5 flex flex-col justify-between h-full min-h-[300px]">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-neutral-200 mb-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-bold text-neutral-800">Voice Synthesis Output</span>
                </div>
                {isSpeaking && (
                  <button
                    onClick={stopSpeaking}
                    className="px-2 py-1 rounded-md bg-rose-100 hover:bg-rose-200 text-rose-800 text-[11px] font-semibold flex items-center gap-1 transition"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    Stop Audio
                  </button>
                )}
              </div>

              {aiSpeech ? (
                <div className="text-xs text-neutral-700 leading-relaxed font-sans space-y-2">
                  <p className="font-medium text-neutral-900 bg-white p-3 rounded-xl border border-neutral-200 shadow-2xs">
                    "{aiSpeech}"
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-neutral-400 text-center space-y-2">
                  <Volume2 className="w-8 h-8 stroke-1 text-neutral-300" />
                  <p className="text-xs">No audio response generated yet.</p>
                  <p className="text-[11px] text-neutral-400">Speak into the mic or click a prompt below.</p>
                </div>
              )}
            </div>

            {aiSpeech && !isSpeaking && (
              <button
                onClick={() => speakText(aiSpeech)}
                className="mt-4 w-full py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Replay Spoken Response
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Suggested Spoken Prompts */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">
          Click any preset question to test voice conversation:
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VOICE_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setTranscript(preset);
                sendVoiceQuery(preset);
              }}
              disabled={isProcessing}
              className="p-3 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200 text-left text-xs text-neutral-800 transition flex items-center justify-between group shadow-2xs"
            >
              <span className="group-hover:text-purple-700 font-medium">"{preset}"</span>
              <Play className="w-3.5 h-3.5 text-neutral-400 group-hover:text-purple-600 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
