import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { 
  auth, 
  googleProvider, 
  createGitHubProvider,
  signInWithPopup, 
  signInWithRedirect,
  linkWithPopup,
  linkWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
  unlink,
  fbSignOut, 
  onAuthStateChanged, 
  functions,
  httpsCallable,
  db, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc,
  query, 
  orderBy, 
  serverTimestamp,
  User 
} from '../lib/firebase';
import { OpenRouterConfig, AppTheme, ThemeOption, AVAILABLE_THEMES } from '../types';
import { UserCredential } from 'firebase/auth';

export interface GitHubConnectionState {
  connected: boolean;
  username: string | null;
  avatarUrl: string | null;
  status: 'idle' | 'connecting' | 'redirecting' | 'connected' | 'error';
  error: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  availableThemes: ThemeOption[];
  signInWithGoogle: () => Promise<void>;
  signInToAppWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  connectGitHubAccount: () => Promise<void>;
  disconnectGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
  githubConnection: GitHubConnectionState;
  saveReviewToCloud: (title: string, sampleName: string, findings: any[], code: string, model: string) => Promise<string | null>;
  saveChatToCloud: (title: string, role: string, model: string, messages: any[]) => Promise<string | null>;
  saveDiagramToCloud: (prompt: string, model: string, resolution: string, imageUrl: string) => Promise<string | null>;
  getUserSavedReviews: () => Promise<any[]>;
  getUserSavedChats: () => Promise<any[]>;
  getUserSavedDiagrams: () => Promise<any[]>;
  openRouterConfig: OpenRouterConfig;
  saveOpenRouterConfig: (newConfig: Partial<OpenRouterConfig>) => Promise<boolean>;
  syncSettingsFromFirestore: (uid: string) => Promise<OpenRouterConfig | null>;
}

const DEFAULT_OPENROUTER_CONFIG: OpenRouterConfig = {
  apiKey: '',
  selectedModel: 'nvidia/llama-3.1-nemotron-70b-instruct',
  customModelName: '',
  temperature: 0.2,
  maxTokens: 2048,
  topP: 0.95,
  isEnabled: false,
  providerType: 'gemini',
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [githubConnection, setGithubConnection] = useState<GitHubConnectionState>({
    connected: false,
    username: null,
    avatarUrl: null,
    status: 'idle',
    error: null,
  });

  const redirectProcessedRef = useRef(false);

  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const savedTheme = localStorage.getItem('app_theme') as AppTheme;
      if (savedTheme && ['light', 'dark', 'midnight', 'emerald', 'cyberpunk', 'sunset'].includes(savedTheme)) {
        return savedTheme;
      }
    } catch (e) {
      console.warn('Failed to parse app_theme from localStorage', e);
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme !== 'light') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('app_theme', newTheme);
    } catch (e) {
      console.warn('Failed to save app_theme to localStorage', e);
    }
    if (user?.uid) {
      const appearanceDocRef = doc(db, 'users', user.uid, 'settings', 'appearance');
      setDoc(appearanceDocRef, { theme: newTheme, updatedAt: serverTimestamp() }, { merge: true }).catch(err => {
        console.warn('Failed to sync theme to Firestore:', err);
      });
    }
  };

  const [openRouterConfig, setOpenRouterConfig] = useState<OpenRouterConfig>(() => {
    try {
      const saved = localStorage.getItem('openrouter_config');
      if (saved) {
        return { ...DEFAULT_OPENROUTER_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to parse local openrouter_config', e);
    }
    return DEFAULT_OPENROUTER_CONFIG;
  });

  const completeGitHubConnection = async (result: UserCredential) => {
    const credential = (result as any)?.credential || undefined;
    const accessToken = credential?.accessToken;
    const profile = getAdditionalUserInfo(result)?.profile as any;
    const username = typeof profile?.login === 'string'
      ? profile.login
      : result.user.displayName || 'GitHub User';
    const avatarUrl = typeof profile?.avatar_url === 'string'
      ? profile.avatar_url
      : result.user.photoURL || undefined;

    if (accessToken) {
      try {
        const registerFn = httpsCallable(functions, 'registerGitHubConnection');
        await registerFn({ accessToken });
      } catch (err: any) {
        console.warn('registerGitHubConnection call note:', err?.message);
      }
    }

    setGithubConnection({
      connected: true,
      username,
      avatarUrl: avatarUrl || null,
      status: 'connected',
      error: null,
    });

    if (sessionStorage.getItem('pendingGitHubImport')) {
      window.dispatchEvent(new Event('pending-github-import-ready'));
    }
  };

  const handleAuthenticationRedirect = async () => {
    try {
      const result = await getRedirectResult(auth);
      if (!result) return;

      const pendingConnection = sessionStorage.getItem('pendingGitHubConnection');
      if (result.providerId === 'github.com' || (result.user && pendingConnection)) {
        await completeGitHubConnection(result);
        if (pendingConnection) {
          try {
            const parsed = JSON.parse(pendingConnection);
            sessionStorage.removeItem('pendingGitHubConnection');
            if (parsed?.returnPath) {
              window.history.replaceState({}, '', parsed.returnPath);
            }
          } catch {
            sessionStorage.removeItem('pendingGitHubConnection');
          }
        }
      }
    } catch (error: any) {
      sessionStorage.removeItem('pendingGitHubConnection');
      let errorMsg = error?.message || 'Redirect authentication failed.';
      if (error?.code === 'auth/unauthorized-domain') {
        const hostname = window.location.hostname;
        errorMsg = `This deployment domain (${hostname}) is not authorized in Firebase.`;
      }
      setGithubConnection(prev => ({
        ...prev,
        status: 'error',
        error: errorMsg,
      }));
    }
  };

  useEffect(() => {
    if (!redirectProcessedRef.current) {
      redirectProcessedRef.current = true;
      void handleAuthenticationRedirect();
    }
  }, []);

  const syncSettingsFromFirestore = async (uid: string): Promise<OpenRouterConfig | null> => {
    try {
      // Sync Appearance Settings
      const appearanceRef = doc(db, 'users', uid, 'settings', 'appearance');
      const appearanceSnap = await getDoc(appearanceRef);
      if (appearanceSnap.exists() && appearanceSnap.data()?.theme) {
        const cloudTheme = appearanceSnap.data().theme as AppTheme;
        if (['light', 'dark', 'midnight', 'emerald', 'cyberpunk', 'sunset'].includes(cloudTheme)) {
          setThemeState(cloudTheme);
          localStorage.setItem('app_theme', cloudTheme);
        }
      }

      // Sync OpenRouter Settings
      const settingsDocRef = doc(db, 'users', uid, 'settings', 'openrouter');
      const snap = await getDoc(settingsDocRef);
      if (snap.exists()) {
        const cloudData = snap.data() as Partial<OpenRouterConfig>;
        const merged: OpenRouterConfig = {
          ...DEFAULT_OPENROUTER_CONFIG,
          ...openRouterConfig,
          ...cloudData
        };
        setOpenRouterConfig(merged);
        localStorage.setItem('openrouter_config', JSON.stringify(merged));
        return merged;
      }
    } catch (err) {
      console.warn('Could not load settings from Firestore:', err);
    }
    return null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        const ghProviderData = currentUser.providerData.find(p => p.providerId === 'github.com');
        let isConnected = Boolean(ghProviderData);
        let ghUsername = ghProviderData?.displayName || ghProviderData?.email || 'GitHub User';
        let ghAvatar = ghProviderData?.photoURL || null;

        try {
          const connSnap = await getDoc(doc(db, 'users', currentUser.uid, 'connections', 'github'));
          const primarySnap = await getDoc(doc(db, 'users', currentUser.uid, 'githubConnections', 'primary'));

          if (primarySnap.exists() && primarySnap.data()?.status === 'connected') {
            isConnected = true;
            ghUsername = primarySnap.data()?.login || primarySnap.data()?.username || ghUsername;
            ghAvatar = primarySnap.data()?.avatarUrl || ghAvatar;
          } else if (connSnap.exists() && connSnap.data()?.connected) {
            isConnected = true;
            ghUsername = connSnap.data()?.username || ghUsername;
            ghAvatar = connSnap.data()?.avatarUrl || ghAvatar;
          }
        } catch (err) {
          console.warn('Could not check GitHub connections in Firestore:', err);
        }

        if (isConnected) {
          setGithubConnection(prev => ({
            ...prev,
            connected: true,
            username: ghUsername,
            avatarUrl: ghAvatar,
            status: 'connected',
          }));
        }

        // Sync user profile to Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        setDoc(userRef, {
          uid: currentUser.uid,
          displayName: currentUser.displayName,
          email: currentUser.email,
          photoURL: currentUser.photoURL,
          lastLoginAt: serverTimestamp(),
        }, { merge: true }).catch(err => {
          console.warn('Firestore user profile sync note:', err);
        });

        // Load persisted OpenRouter settings from Firestore
        await syncSettingsFromFirestore(currentUser.uid);
      } else {
        setGithubConnection({
          connected: false,
          username: null,
          avatarUrl: null,
          status: 'idle',
          error: null,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const saveOpenRouterConfig = async (newConfig: Partial<OpenRouterConfig>): Promise<boolean> => {
    const updated: OpenRouterConfig = {
      ...openRouterConfig,
      ...newConfig,
      updatedAt: new Date().toISOString()
    };
    
    setOpenRouterConfig(updated);
    try {
      localStorage.setItem('openrouter_config', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }

    if (user) {
      try {
        const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'openrouter');
        await setDoc(settingsDocRef, {
          ...updated,
          cloudSyncedAt: serverTimestamp()
        }, { merge: true });
        return true;
      } catch (err) {
        console.error('Error saving OpenRouter settings to Firestore:', err);
        return false;
      }
    }
    return true;
  };

  const signInToAppWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google Sign In Error:', error);
      const code = error?.code || 'unknown';
      const hostname = window.location.hostname;
      const messages: Record<string, string> = {
        'auth/popup-blocked': `The sign-in popup was blocked. Allow popups for ${hostname} and try again.`,
        'auth/unauthorized-domain': `This deployment domain (${hostname}) is not authorized in Firebase Authentication settings.`,
        'auth/operation-not-allowed': 'Google sign-in is not enabled in Firebase Authentication.',
        'auth/popup-closed-by-user': 'The Google sign-in window was closed before completing sign-in.',
      };
      const message = code.includes('api-key-not-valid')
        ? 'The Firebase web API key is invalid. Copy the Web API Key from Firebase Project settings into Vercel as VITE_FIREBASE_API_KEY, then redeploy.'
        : messages[code] || `Google sign-in failed (${code}). Check the browser console for details.`;
      throw new Error(message);
    }
  };

  const connectGitHubAccount = async () => {
    const currentUser = auth.currentUser;

    if (currentUser?.providerData.some(p => p.providerId === 'github.com')) {
      setGithubConnection(prev => ({
        ...prev,
        connected: true,
        status: 'connected',
        error: 'GitHub is already connected.',
      }));
      return;
    }

    const provider = createGitHubProvider();
    setGithubConnection(prev => ({ ...prev, status: 'connecting', error: null }));

    try {
      let result: UserCredential;
      if (currentUser) {
        result = await linkWithPopup(currentUser, provider);
      } else {
        result = await signInWithPopup(auth, provider);
      }
      await completeGitHubConnection(result);
    } catch (error: any) {
      const fallbackErrors = [
        'auth/popup-blocked',
        'auth/popup-closed-by-user',
        'auth/cancelled-popup-request',
        'auth/operation-not-supported-in-this-environment',
      ];

      if (fallbackErrors.includes(error?.code)) {
        try {
          sessionStorage.setItem(
            'pendingGitHubConnection',
            JSON.stringify({
              returnPath: window.location.pathname + window.location.search + window.location.hash,
              startedAt: Date.now(),
            })
          );
        } catch {
          // sessionStorage disabled or unavailable
        }

        setGithubConnection(prev => ({ ...prev, status: 'redirecting', error: null }));

        if (auth.currentUser) {
          await linkWithRedirect(auth.currentUser, provider);
        } else {
          await signInWithRedirect(auth, provider);
        }
        return;
      }

      let errorMsg = error?.message || 'GitHub connection failed.';
      if (error?.code === 'auth/unauthorized-domain') {
        const hostname = window.location.hostname;
        errorMsg = `This deployment domain (${hostname}) is not authorized in Firebase Authentication settings.`;
      } else if (error?.code === 'auth/credential-already-in-use' || error?.code === 'auth/provider-already-linked') {
        errorMsg = 'This GitHub account is already linked to another user account.';
      } else if (error?.code === 'auth/account-exists-with-different-credential') {
        errorMsg = 'This email address is already linked to another sign-in provider.';
      }

      setGithubConnection(prev => ({
        ...prev,
        status: 'error',
        error: errorMsg,
      }));

      throw new Error(errorMsg);
    }
  };

  const disconnectGitHub = async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const ghProviderData = currentUser.providerData.find(p => p.providerId === 'github.com');
      if (ghProviderData) {
        try {
          await unlink(currentUser, 'github.com');
        } catch (err) {
          console.warn('Unlink github error:', err);
        }
      }
      try {
        await setDoc(doc(db, 'users', currentUser.uid, 'connections', 'github'), {
          connected: false,
          updatedAt: serverTimestamp(),
        }, { merge: true });
        await setDoc(doc(db, 'users', currentUser.uid, 'githubConnections', 'primary'), {
          status: 'disconnected',
          updatedAt: serverTimestamp(),
        }, { merge: true });
        await deleteDoc(doc(db, 'users', currentUser.uid, 'secretConnections', 'github'));
      } catch {
        // ignore
      }
    }
    setGithubConnection({
      connected: false,
      username: null,
      avatarUrl: null,
      status: 'idle',
      error: null,
    });
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
      setGithubConnection({
        connected: false,
        username: null,
        avatarUrl: null,
        status: 'idle',
        error: null,
      });
    } catch (error) {
      console.error('Sign Out Error:', error);
    }
  };

  const saveReviewToCloud = async (title: string, sampleName: string, findings: any[], code: string, model: string): Promise<string | null> => {
    if (!user) return null;
    try {
      const reviewsCol = collection(db, 'users', user.uid, 'reviews');
      const docRef = await addDoc(reviewsCol, {
        title: title || `Review for ${sampleName}`,
        sampleName,
        findings,
        code,
        model,
        findingsCount: findings.length,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (err) {
      console.error('Error saving review to Firestore:', err);
      return null;
    }
  };

  const saveChatToCloud = async (title: string, role: string, model: string, messages: any[]): Promise<string | null> => {
    if (!user) return null;
    try {
      const chatsCol = collection(db, 'users', user.uid, 'chats');
      const docRef = await addDoc(chatsCol, {
        title: title || `${role} Session`,
        role,
        model,
        messages,
        messageCount: messages.length,
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (err) {
      console.error('Error saving chat to Firestore:', err);
      return null;
    }
  };

  const saveDiagramToCloud = async (prompt: string, model: string, resolution: string, imageUrl: string): Promise<string | null> => {
    if (!user) return null;
    try {
      const diagramsCol = collection(db, 'users', user.uid, 'diagrams');
      const docRef = await addDoc(diagramsCol, {
        prompt,
        model,
        resolution,
        imageUrl,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (err) {
      console.error('Error saving diagram to Firestore:', err);
      return null;
    }
  };

  const getUserSavedReviews = async (): Promise<any[]> => {
    if (!user) return [];
    try {
      const reviewsCol = collection(db, 'users', user.uid, 'reviews');
      const q = query(reviewsCol, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error fetching reviews:', err);
      return [];
    }
  };

  const getUserSavedChats = async (): Promise<any[]> => {
    if (!user) return [];
    try {
      const chatsCol = collection(db, 'users', user.uid, 'chats');
      const q = query(chatsCol, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error fetching chats:', err);
      return [];
    }
  };

  const getUserSavedDiagrams = async (): Promise<any[]> => {
    if (!user) return [];
    try {
      const diagramsCol = collection(db, 'users', user.uid, 'diagrams');
      const q = query(diagramsCol, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error fetching diagrams:', err);
      return [];
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        theme,
        setTheme,
        availableThemes: AVAILABLE_THEMES,
        signInWithGoogle: signInToAppWithGoogle,
        signInToAppWithGoogle,
        signInWithGitHub: connectGitHubAccount,
        connectGitHubAccount,
        disconnectGitHub,
        signOut,
        githubConnection,
        saveReviewToCloud,
        saveChatToCloud,
        saveDiagramToCloud,
        getUserSavedReviews,
        getUserSavedChats,
        getUserSavedDiagrams,
        openRouterConfig,
        saveOpenRouterConfig,
        syncSettingsFromFirestore,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

