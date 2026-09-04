import React, { useState } from 'react';
import { REPO_FILES, RepoFile } from '../data/mockFiles';
import { FileCode, Copy, Check, Folder, Shield, BookOpen, Terminal, Sparkles } from 'lucide-react';

export function CodeExplorer() {
  const [selectedFile, setSelectedFile] = useState<RepoFile>(REPO_FILES[1]); // clone.py
  const [copied, setCopied] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredFiles = REPO_FILES.filter(f => {
    if (filterCategory === 'all') return true;
    return f.category === filterCategory;
  });

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-xs overflow-hidden flex flex-col md:flex-row min-h-[640px]">
      {/* File Tree Sidebar */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-neutral-200 bg-neutral-50/70 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Repository Files</span>
            <span className="text-xs font-mono bg-neutral-200/70 text-neutral-700 px-2 py-0.5 rounded-md">
              {REPO_FILES.length} files
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1 text-xs">
            {['all', 'core', 'test', 'config', 'doc'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-2.5 py-1 rounded-lg capitalize transition font-medium ${
                  filterCategory === cat
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-200/60 border border-neutral-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* File List */}
          <div className="space-y-1 overflow-y-auto max-h-[500px] pr-1">
            {filteredFiles.map((file) => {
              const isSelected = selectedFile.path === file.path;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-neutral-900 text-white shadow-xs font-medium'
                      : 'text-neutral-700 hover:bg-neutral-200/60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-amber-300' : 'text-neutral-400'}`} />
                    <span className="truncate">{file.path}</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono uppercase ${
                      isSelected
                        ? 'bg-neutral-800 text-neutral-300'
                        : 'bg-neutral-200/70 text-neutral-600'
                    }`}
                  >
                    {file.category}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-neutral-200 text-xs text-neutral-500 mt-4 px-1">
          <div className="flex items-center gap-1.5 font-medium text-neutral-700">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Human-Written Style Guard</span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-400 leading-relaxed">
            Written without boilerplates or artificial comments. Ready for git commits and production CLI use.
          </p>
        </div>
      </div>

      {/* Code Content Panel */}
      <div className="flex-1 flex flex-col bg-neutral-950 text-neutral-100">
        {/* Panel Header */}
        <div className="px-5 py-3.5 border-b border-neutral-800 bg-neutral-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <div>
              <p className="text-xs font-mono font-semibold text-neutral-200">{selectedFile.path}</p>
              <p className="text-[11px] text-neutral-400">{selectedFile.description}</p>
            </div>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Code Content with Line Numbers */}
        <div className="flex-1 p-4 overflow-auto font-mono text-xs leading-relaxed max-h-[580px]">
          <pre className="text-neutral-300">
            {selectedFile.content.split('\n').map((line, idx) => (
              <div key={idx} className="flex hover:bg-neutral-900/70 py-0.5 px-1 rounded">
                <span className="w-10 select-none text-neutral-600 text-right pr-4 font-mono text-[11px]">
                  {idx + 1}
                </span>
                <span className="flex-1 whitespace-pre-wrap">{line}</span>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}
