import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  X, 
  Trash2, 
  FileCode, 
  MessageSquare, 
  Image as ImageIcon, 
  Sparkles, 
  ExternalLink, 
  Calendar,
  Layers,
  Bot
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface CloudDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectReview?: (review: any) => void;
}

export function CloudDrawer({ isOpen, onClose, onSelectReview }: CloudDrawerProps) {
  const { 
    user, 
    signInWithGoogle, 
    signOut, 
    getUserSavedReviews, 
    getUserSavedChats, 
    getUserSavedDiagrams 
  } = useAuth();

  const [activeSubTab, setActiveSubTab] = useState<'reviews' | 'chats' | 'diagrams'>('reviews');
  const [reviews, setReviews] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [diagrams, setDiagrams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      loadData();
    }
  }, [isOpen, user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [r, c, d] = await Promise.all([
        getUserSavedReviews(),
        getUserSavedChats(),
        getUserSavedDiagrams()
      ]);
      setReviews(r);
      setChats(c);
      setDiagrams(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col justify-between border-l border-neutral-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Cloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900">Firestore Cloud Storage</h3>
              <p className="text-[11px] text-neutral-500">
                {user ? `Connected as ${user.email}` : 'Sign in to access synchronized data'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Auth Banner */}
        <div className="p-4 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
          {user ? (
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-8 h-8 rounded-full border border-neutral-200" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold">
                  {user.displayName?.[0] || 'U'}
                </div>
              )}
              <div className="text-xs">
                <span className="font-semibold text-neutral-900 block">{user.displayName || 'Developer'}</span>
                <span className="text-[10px] text-neutral-500 truncate">{user.email}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-neutral-600">
              Sign in with Google to enable automatic cloud backup across devices.
            </div>
          )}

          {user ? (
            <button
              onClick={signOut}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:text-rose-600 hover:bg-rose-50 border border-neutral-200 transition"
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-white shadow-xs transition"
            >
              Google Sign-In
            </button>
          )}
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center px-4 pt-3 border-b border-neutral-200 gap-2 bg-white text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('reviews')}
            className={`pb-2.5 px-2 border-b-2 flex items-center gap-1.5 transition ${
              activeSubTab === 'reviews'
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Saved Reviews ({reviews.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('chats')}
            className={`pb-2.5 px-2 border-b-2 flex items-center gap-1.5 transition ${
              activeSubTab === 'chats'
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat Sessions ({chats.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('diagrams')}
            className={`pb-2.5 px-2 border-b-2 flex items-center gap-1.5 transition ${
              activeSubTab === 'diagrams'
                ? 'border-neutral-900 text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Diagrams ({diagrams.length})</span>
          </button>
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-xs text-neutral-500 gap-2">
              <span className="animate-spin text-amber-500">✦</span>
              <span>Syncing from Firestore...</span>
            </div>
          ) : !user ? (
            <div className="text-center py-16 text-neutral-500 space-y-2">
              <Cloud className="w-10 h-10 mx-auto text-neutral-300 stroke-1" />
              <p className="text-xs font-semibold text-neutral-700">Google Authentication Required</p>
              <p className="text-[11px] text-neutral-400">Please sign in to view your saved Cloud documents.</p>
              <button
                onClick={signInWithGoogle}
                className="mt-3 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold shadow-xs"
              >
                Sign In with Google
              </button>
            </div>
          ) : activeSubTab === 'reviews' ? (
            reviews.length === 0 ? (
              <div className="text-center py-16 text-neutral-400 text-xs">
                No saved reviews in Firestore yet. Run a review and click "Save to Cloud".
              </div>
            ) : (
              reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 truncate">{rev.title}</span>
                    <span className="text-[10px] font-mono bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded">
                      {rev.model}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-neutral-500">
                    <span>{rev.sampleName}</span>
                    <span>• {rev.findingsCount} finding(s)</span>
                  </div>
                  {onSelectReview && (
                    <button
                      onClick={() => {
                        onSelectReview(rev);
                        onClose();
                      }}
                      className="w-full py-1.5 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-200 text-xs font-medium text-neutral-800 transition"
                    >
                      Load into Playground
                    </button>
                  )}
                </div>
              ))
            )
          ) : activeSubTab === 'chats' ? (
            chats.length === 0 ? (
              <div className="text-center py-16 text-neutral-400 text-xs">
                No saved chats yet. Chat with Gemini and click "Save to Cloud".
              </div>
            ) : (
              chats.map((c) => (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-900 truncate">{c.title}</span>
                    <span className="text-[10px] font-semibold bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                      {c.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    {c.messageCount} messages • Model: {c.model}
                  </p>
                </div>
              ))
            )
          ) : (
            diagrams.length === 0 ? (
              <div className="text-center py-16 text-neutral-400 text-xs">
                No saved blueprints yet. Generate a diagram in Image Studio and save to cloud.
              </div>
            ) : (
              diagrams.map((d) => (
                <div
                  key={d.id}
                  className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/50 space-y-2"
                >
                  <div className="aspect-video rounded-lg overflow-hidden bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                    <img src={d.imageUrl} alt={d.prompt} className="max-h-32 object-contain" referrerPolicy="no-referrer" />
                  </div>
                  <div className="text-[11px] font-medium text-neutral-800 line-clamp-2">
                    "{d.prompt}"
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                    <span>{d.resolution}</span>
                    <span>{d.model}</span>
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between text-xs text-neutral-500">
          <span>Firestore Real-time Sync Active</span>
          <button
            onClick={loadData}
            className="text-neutral-700 hover:text-neutral-900 font-semibold"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
