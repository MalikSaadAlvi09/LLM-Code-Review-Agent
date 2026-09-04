import React, { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { Archive, Check, ChevronDown, ChevronRight, FileCode, FolderOpen, Github, Loader2, Search, Trash2, UploadCloud } from 'lucide-react';
import { IMPORT_LIMITS, ImportedCodeFile, ImportedProject, ProjectSourceType } from '../types';

interface CodebaseImportProps {
  project: ImportedProject | null;
  onProjectChange: (project: ImportedProject | null) => void;
  onReviewProject?: () => void;
}

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.py': 'python', '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
  '.java': 'java', '.c': 'c', '.h': 'c', '.cc': 'cpp', '.cpp': 'cpp', '.hpp': 'cpp', '.cs': 'csharp',
  '.go': 'go', '.rs': 'rust', '.php': 'php', '.rb': 'ruby', '.swift': 'swift', '.kt': 'kotlin', '.dart': 'dart',
  '.html': 'html', '.css': 'css', '.scss': 'scss', '.sql': 'sql', '.sh': 'shell', '.bash': 'shell', '.ps1': 'powershell',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.xml': 'xml', '.md': 'markdown', '.toml': 'toml', '.tf': 'terraform',
};

const IGNORED_PARTS = new Set(['.git', '.github', 'node_modules', 'vendor', 'dist', 'build', 'coverage', '.next', '.nuxt', '.cache', 'venv', '.venv', 'env', '__pycache__', '.pytest_cache', '.mypy_cache', '.idea', '.vscode', 'target', 'bin', 'obj', 'pods', 'deriveddata']);
const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.mp4', '.mov', '.avi', '.exe', '.dll', '.so', '.dylib', '.db', '.sqlite', '.woff', '.woff2', '.ttf', '.class', '.pyc', '.map', '.lock', '.log']);

function extensionFor(path: string) {
  const name = path.split('/').pop() || path;
  if (name.toLowerCase() === 'dockerfile' || name.toLowerCase().startsWith('docker-compose')) return '';
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function classifyPath(path: string) {
  const normalized = path.replaceAll('\\', '/');
  const parts = normalized.split('/');
  const name = parts.at(-1)?.toLowerCase() || '';
  if (parts.some(part => IGNORED_PARTS.has(part.toLowerCase()))) return { status: 'ignored' as const, reason: 'Generated, dependency, cache, or metadata directory.' };
  if (name === '.env' || (name !== '.env.example' && (name.includes('secret') || name.includes('credentials') || name.endsWith('.pem') || name.endsWith('.key')))) return { status: 'ignored' as const, reason: 'Potential secret or credential file.' };
  if (name.endsWith('.min.js') || name.endsWith('.map') || name.endsWith('.lock') || name.endsWith('.log') || name.endsWith('.pyc') || name.endsWith('.class')) return { status: 'ignored' as const, reason: 'Generated or lock file excluded from normal review.' };
  const extension = extensionFor(normalized);
  if (BINARY_EXTENSIONS.has(extension)) return { status: 'unsupported' as const, reason: 'Binary or generated file cannot be reviewed as source.' };
  if (!LANGUAGE_BY_EXTENSION[extension] && name !== 'dockerfile' && !name.startsWith('docker-compose')) return { status: 'unsupported' as const, reason: 'File type is not a supported source or configuration format.' };
  return { status: 'ready' as const };
}

async function fileToImported(file: File, path = file.name, selected = true): Promise<ImportedCodeFile> {
  const extension = extensionFor(path);
  const classification = classifyPath(path);
  if (file.size > IMPORT_LIMITS.maxSingleFileBytes) {
    return { id: crypto.randomUUID(), path, name: path.split('/').pop() || path, extension, language: LANGUAGE_BY_EXTENSION[extension] || 'unknown', size: file.size, content: '', selected: false, status: 'error', reason: `File exceeds the ${IMPORT_LIMITS.maxSingleFileBytes / 1024 / 1024} MB limit.` };
  }
  if (classification.status !== 'ready') {
    return { id: crypto.randomUUID(), path, name: path.split('/').pop() || path, extension, language: LANGUAGE_BY_EXTENSION[extension] || 'unknown', size: file.size, content: '', selected: false, ...classification };
  }
  const content = await file.text();
  if (content.includes('\0')) return { id: crypto.randomUUID(), path, name: path.split('/').pop() || path, extension, language: 'unknown', size: file.size, content: '', selected: false, status: 'unsupported', reason: 'Binary content detected.' };
  return { id: crypto.randomUUID(), path, name: path.split('/').pop() || path, extension, language: LANGUAGE_BY_EXTENSION[extension] || (path.toLowerCase().includes('dockerfile') ? 'dockerfile' : 'text'), size: file.size, content, selected, status: 'ready' };
}

async function collectEntries(items: DataTransferItemList) {
  const files: { file: File; path: string }[] = [];
  const walk = async (entry: any, parent = ''): Promise<void> => {
    if (entry.isFile) {
      await new Promise<void>((resolve) => entry.file((file: File) => { files.push({ file, path: `${parent}${file.name}` }); resolve(); }));
      return;
    }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      await new Promise<void>((resolve) => reader.readEntries(async (entries: any[]) => { for (const child of entries) await walk(child, `${parent}${entry.name}/`); resolve(); }));
    }
  };
  for (let index = 0; index < items.length; index++) {
    const entry = items[index].webkitGetAsEntry?.();
    if (entry) await walk(entry);
  }
  return files;
}

function makeProject(name: string, sourceType: ProjectSourceType, files: ImportedCodeFile[], repository?: ImportedProject['repository']): ImportedProject {
  return { id: crypto.randomUUID(), name, sourceType, files, repository, createdAt: new Date().toISOString() };
}

export function CodebaseImport({ project, onProjectChange, onReviewProject }: CodebaseImportProps) {
  const folderInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const zipInput = useRef<HTMLInputElement>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [pastedCode, setPastedCode] = useState('');

  useEffect(() => {
    fetch('/api/github/repos').then(async response => response.ok ? setGithubRepos((await response.json()).repositories || []) : undefined).catch(() => undefined);
  }, []);

  const addFiles = async (entries: { file: File; path: string }[], sourceType: ProjectSourceType, name: string) => {
    setProcessing(true); setError(null);
    try {
      if (entries.length > IMPORT_LIMITS.maxFileCount) throw new Error(`This import contains more than ${IMPORT_LIMITS.maxFileCount} files.`);
      const imported = await Promise.all(entries.map(entry => fileToImported(entry.file, entry.path)));
      const existing = new Set(project?.files.map(file => file.path) || []);
      const files = [...(project?.files || []), ...imported.filter(file => !existing.has(file.path))];
      onProjectChange(makeProject(project?.name || name, sourceType, files, project?.repository));
    } catch (err: any) { setError(err.message || 'Could not import these files.'); }
    finally { setProcessing(false); }
  };

  const handleFileList = (list: FileList | null, sourceType: ProjectSourceType, name: string) => {
    if (!list) return;
    void addFiles(Array.from(list).map(file => ({ file, path: file.webkitRelativePath || file.name })), sourceType, name);
  };

  const handleZip = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > IMPORT_LIMITS.maxArchiveBytes) { setError(`ZIP exceeds the ${IMPORT_LIMITS.maxArchiveBytes / 1024 / 1024} MB limit.`); return; }
    setProcessing(true); setError(null);
    try {
      const archive = await JSZip.loadAsync(file, { checkCRC32: true });
      const entries: { file: File; path: string }[] = [];
      let extractedBytes = 0;
      for (const [path, entry] of Object.entries(archive.files)) {
        if (entry.dir) continue;
        const normalized = path.replaceAll('\\', '/');
        if (normalized.startsWith('/') || normalized.split('/').includes('..')) throw new Error(`Unsafe ZIP path rejected: ${path}`);
        const data = await entry.async('uint8array');
        extractedBytes += data.byteLength;
        if (extractedBytes > IMPORT_LIMITS.maxExtractedBytes) throw new Error('ZIP extracted content exceeds the 200 MB limit.');
        entries.push({ file: new File([data], path.split('/').pop() || 'file'), path });
        if (entries.length > IMPORT_LIMITS.maxFileCount) throw new Error(`ZIP contains more than ${IMPORT_LIMITS.maxFileCount} files.`);
      }
      await addFiles(entries, 'zip', file.name.replace(/\.zip$/i, ''));
    } catch (err: any) { setError(err.message || 'The ZIP archive is corrupted or unsupported.'); setProcessing(false); }
  };

  const importGithub = async () => {
    setError(null);
    try {
      const parsed = new URL(githubUrl.trim());
      if (parsed.hostname !== 'github.com') throw new Error('Enter a github.com repository URL.');
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length < 2) throw new Error('Use https://github.com/owner/repository.');
      const response = await fetch('/api/github/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: githubUrl.trim() }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || `GitHub import failed (HTTP ${response.status}).`);
      const files = (payload.files || []) as ImportedCodeFile[];
      onProjectChange(makeProject(payload.repository?.name || parts[1], 'github', files, payload.repository));
      setGithubUrl('');
    } catch (err: any) { setError(err.message || 'Could not import this GitHub repository.'); }
  };

  const visibleFiles = project?.files.filter(file => file.path.toLowerCase().includes(search.toLowerCase())) || [];
  const readyFiles = project?.files.filter(file => file.status === 'ready') || [];
  const selectedFiles = readyFiles.filter(file => file.selected);
  const lines = selectedFiles.reduce((total, file) => total + file.content.split('\n').length, 0);

  return <section className="bg-white rounded-2xl border border-neutral-200 shadow-xs p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-sm font-bold text-neutral-900">Import Codebase</h2><p className="text-xs text-neutral-500 mt-1">Bring a project into the same review workflow.</p></div>
      <span className="text-[10px] font-mono text-neutral-400">Max file {IMPORT_LIMITS.maxSingleFileBytes / 1024 / 1024} MB · ZIP {IMPORT_LIMITS.maxArchiveBytes / 1024 / 1024} MB</span>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
      <button onClick={() => folderInput.current?.click()} className="p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-semibold flex flex-col items-center gap-2"><FolderOpen className="w-4 h-4 text-blue-600" />Upload Folder</button>
      <button onClick={() => zipInput.current?.click()} className="p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-semibold flex flex-col items-center gap-2"><Archive className="w-4 h-4 text-amber-600" />Upload ZIP</button>
      <button onClick={() => filesInput.current?.click()} className="p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-semibold flex flex-col items-center gap-2"><UploadCloud className="w-4 h-4 text-emerald-600" />Upload Files</button>
      <button onClick={() => document.getElementById('github-url-import')?.focus()} className="p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-semibold flex flex-col items-center gap-2"><Github className="w-4 h-4 text-neutral-800" />Import GitHub</button>
      <button onClick={() => { window.location.href = '/api/github/auth'; }} className="p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-semibold flex flex-col items-center gap-2"><Github className="w-4 h-4 text-neutral-800" />Connect GitHub</button>
      <button onClick={() => document.getElementById('paste-code-import')?.focus()} className="p-3 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-semibold flex flex-col items-center gap-2"><FileCode className="w-4 h-4 text-purple-600" />Paste Code</button>
    </div>
    <input ref={folderInput} type="file" webkitdirectory="true" directory="true" multiple hidden onChange={event => handleFileList(event.target.files, 'folder', 'Imported folder')} />
    <input ref={filesInput} type="file" multiple hidden onChange={event => handleFileList(event.target.files, 'files', 'Imported files')} />
    <input ref={zipInput} type="file" accept=".zip,application/zip" hidden onChange={event => void handleZip(event.target.files?.[0])} />
    <div onDragOver={event => event.preventDefault()} onDrop={async event => { event.preventDefault(); const entries = await collectEntries(event.dataTransfer.items); await addFiles(entries, 'folder', 'Dropped folder'); }} className="border border-dashed border-neutral-300 rounded-xl p-5 text-center text-xs text-neutral-500 hover:bg-neutral-50"><UploadCloud className="w-6 h-6 mx-auto mb-2 text-neutral-400" />Drop a folder, ZIP, or files here</div>
    <div className="flex gap-2"><input id="github-url-import" value={githubUrl} onChange={event => setGithubUrl(event.target.value)} placeholder="https://github.com/owner/repository" className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 text-xs" /><button onClick={() => void importGithub()} disabled={!githubUrl.trim() || processing} className="px-3 py-2 rounded-lg bg-neutral-900 text-white text-xs font-semibold disabled:opacity-40">Import</button></div>
    {githubRepos.length > 0 && <div className="rounded-xl border border-neutral-200 p-3 space-y-2"><div className="flex items-center justify-between text-xs font-semibold"><span>Connected GitHub repositories</span><button onClick={() => { void fetch('/api/github/disconnect', { method: 'POST' }); setGithubRepos([]); }} className="text-rose-600">Disconnect</button></div><div className="max-h-28 overflow-y-auto space-y-1">{githubRepos.map(repo => <button key={repo.id} onClick={() => setGithubUrl(repo.url)} className="w-full text-left px-2 py-1 rounded hover:bg-neutral-50 text-xs"><span className="font-mono">{repo.fullName}</span>{repo.isPrivate && <span className="ml-2 text-[10px] text-amber-600">private</span>}</button>)}</div></div>}
    <div className="flex gap-2"><textarea id="paste-code-import" value={pastedCode} onChange={event => setPastedCode(event.target.value)} placeholder="Paste code here to import it as a project file..." rows={2} className="flex-1 px-3 py-2 rounded-lg border border-neutral-300 text-xs font-mono" /><button onClick={() => { const file = new File([pastedCode], 'pasted_code.py', { type: 'text/plain' }); void addFiles([{ file, path: 'pasted_code.py' }], 'pasted', 'Pasted code'); setPastedCode(''); }} disabled={!pastedCode.trim() || processing} className="px-3 py-2 rounded-lg border text-xs font-semibold disabled:opacity-40">Import pasted code</button></div>
    {processing && <div className="flex items-center gap-2 text-xs text-blue-700"><Loader2 className="w-3.5 h-3.5 animate-spin" />Processing import...</div>}
    {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700" role="alert">{error}</div>}
    {project && <div className="border-t border-neutral-200 pt-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="text-sm font-bold text-neutral-900">{project.name}</span><span className="ml-2 text-[10px] uppercase text-neutral-500">{project.sourceType}</span>{project.repository?.branch && <span className="ml-2 text-[10px] font-mono text-neutral-500">branch: {project.repository.branch}</span>}</div><button onClick={() => onProjectChange(null)} className="text-xs text-rose-600 flex items-center gap-1"><Trash2 className="w-3 h-3" />Clear Project</button></div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs"><span>{project.files.length} imported</span><span>{readyFiles.length} supported</span><span>{project.files.filter(file => file.status !== 'ready').length} ignored</span><span>{lines} selected lines</span><span>~{Math.ceil(selectedFiles.reduce((total, file) => total + file.content.length, 0) / 4)} tokens</span></div>
      <div className="flex flex-wrap gap-2"><div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-50 border border-neutral-200 flex-1 min-w-[180px]"><Search className="w-3.5 h-3.5 text-neutral-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search files" className="bg-transparent outline-none text-xs w-full" /></div><button onClick={() => onProjectChange({ ...project, files: project.files.map(file => ({ ...file, selected: file.status === 'ready' })) })} className="text-xs font-semibold px-2 py-1 rounded-lg border">Select all</button><button onClick={() => onProjectChange({ ...project, files: project.files.map(file => ({ ...file, selected: false })) })} className="text-xs font-semibold px-2 py-1 rounded-lg border">Clear selection</button><button onClick={onReviewProject} disabled={!selectedFiles.length || !onReviewProject} className="text-xs font-semibold px-2 py-1 rounded-lg bg-neutral-900 text-white disabled:opacity-40">Review selected files</button><button onClick={() => { onProjectChange({ ...project, files: project.files.map(file => ({ ...file, selected: file.status === 'ready' })) }); onReviewProject?.(); }} disabled={!readyFiles.length || !onReviewProject} className="text-xs font-semibold px-2 py-1 rounded-lg border disabled:opacity-40">Review complete codebase</button></div>
      <button onClick={() => setExpanded(!expanded)} className="text-xs font-semibold flex items-center gap-1">{expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}File tree</button>
      {expanded && <div className="max-h-48 overflow-y-auto space-y-1">{visibleFiles.map(file => <div key={file.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-neutral-50"><input type="checkbox" checked={file.selected} disabled={file.status !== 'ready'} onChange={() => onProjectChange({ ...project, files: project.files.map(item => item.id === file.id ? { ...item, selected: !item.selected } : item) })} /><span className="font-mono truncate flex-1">{file.path}</span><span className={file.status === 'ready' ? 'text-emerald-600' : 'text-neutral-400'}>{file.status === 'ready' ? <Check className="w-3 h-3" /> : file.reason}</span><button onClick={() => onProjectChange({ ...project, files: project.files.filter(item => item.id !== file.id) })} title="Remove file"><Trash2 className="w-3 h-3 text-rose-500" /></button></div>)}</div>}
    </div>}
  </section>;
}
