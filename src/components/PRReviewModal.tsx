import React, { useState } from 'react';
import { GitPullRequest, GitCommit, FileCode, CheckCircle2, AlertTriangle, Send, X, ShieldAlert } from 'lucide-react';
import { PullRequestInfo, Finding } from '../types';

interface PRReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  prInfo?: PullRequestInfo | null;
  findings: Finding[];
  onPublishComments: (comments: { path: string; line: number; body: string }[]) => Promise<void>;
}

export function PRReviewModal({
  isOpen,
  onClose,
  prInfo,
  findings,
  onPublishComments
}: PRReviewModalProps) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedStatus, setPublishedStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const mockPR: PullRequestInfo = prInfo || {
    repoOwner: 'acme-org',
    repoName: 'backend-service',
    prNumber: 42,
    title: 'PR #42: Add Payment Webhook Retry Handler & Subprocess Guard',
    branch: 'feature/payment-retry',
    headSha: 'a1b2c3d4e5',
    baseSha: '9f8e7d6c5b',
    changedFiles: [
      { path: 'src/services/payment_gateway.py', status: 'modified', additions: 15, deletions: 4 },
      { path: 'src/workers/async_worker.py', status: 'modified', additions: 8, deletions: 2 }
    ]
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setPublishedStatus(null);
    try {
      const commentsToPublish = findings.map(f => ({
        path: f.file || 'module.py',
        line: f.startLine || f.line || 1,
        body: `**[${f.severity}] ${f.title}**\n\n${f.description}\n\nSuggested Fix:\n\`\`\`\n${f.suggested_fix}\n\`\`\``
      }));

      await onPublishComments(commentsToPublish);
      setPublishedStatus('Review comments published successfully to GitHub PR!');
      setTimeout(() => {
        setPublishedStatus(null);
        onClose();
      }, 2500);
    } catch (err: any) {
      setPublishedStatus(`Publish failed: ${err.message || 'Error occurred.'}`);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-neutral-200">
        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-200 bg-neutral-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-bold">{mockPR.title}</h3>
              <p className="text-[11px] font-mono text-neutral-400">
                {mockPR.repoOwner}/{mockPR.repoName} • Branch: {mockPR.branch} ({mockPR.headSha.slice(0, 7)})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PR Changed Files & Inline Findings Preview */}
        <div className="p-5 overflow-y-auto space-y-4 max-h-[60vh] text-xs">
          <div className="bg-neutral-50 border border-neutral-200 p-3 rounded-xl flex items-center justify-between">
            <span className="font-semibold text-neutral-800">Files Changed: {mockPR.changedFiles.length}</span>
            <span className="font-mono text-neutral-500">Tied Findings: {findings.length}</span>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-neutral-800 uppercase tracking-wider text-[11px]">Preview Review Comments ({findings.length})</h4>
            {findings.length === 0 ? (
              <p className="text-neutral-400 italic py-4 text-center">No findings to publish for this commit.</p>
            ) : (
              findings.map((f, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
                  <div className="flex items-center justify-between font-bold text-neutral-900">
                    <span className="font-mono text-[11px] text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                      {f.file || 'module.py'}:{f.startLine || f.line}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-neutral-500">{f.severity}</span>
                  </div>
                  <p className="font-semibold text-neutral-800">{f.title}</p>
                  <p className="text-neutral-600 leading-relaxed">{f.description}</p>
                  {f.suggested_fix && (
                    <pre className="bg-neutral-900 text-emerald-400 p-2 rounded text-[11px] font-mono overflow-x-auto">
                      {f.suggested_fix}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>

          {publishedStatus && (
            <div className={`p-3 rounded-xl text-xs font-semibold ${publishedStatus.includes('failed') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
              {publishedStatus}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500">
            Publishing requires explicit confirmation. Credentials remain server-side.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={isPublishing || findings.length === 0}
              className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isPublishing ? 'Publishing...' : 'Publish PR Comments'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
