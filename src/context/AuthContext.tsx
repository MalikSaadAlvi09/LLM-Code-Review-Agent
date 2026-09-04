import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  auth, 
  googleProvider, 
  githubProvider,
  signInWithPopup, 
  signInWithRedirect,
  fbSignOut, 
  onAuthStateChanged, 
  db, 
  doc, 
  setDoc, 
  getDoc,
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  User 
} from '../lib/firebase';
import { OpenRouterConfig } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
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

  const syncSettingsFromFirestore = async (uid: string): Promise<OpenRouterConfig | null> => {
    try {
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
      console.warn('Could not load OpenRouter config from Firestore:', err);
    }
    return null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
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

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google Sign In Error:', error);
      const code = error?.code || 'unknown';
      const hostname = window.location.hostname;
      const messages: Record<string, string> = {
        'auth/popup-blocked': `The sign-in popup was blocked. Allow popups for ${hostname} and try again.`,
        'auth/unauthorized-domain': `${hostname} is not authorized in Firebase Authentication settings.`,
        'auth/operation-not-allowed': 'Google sign-in is not enabled in Firebase Authentication.',
        'auth/popup-closed-by-user': 'The Google sign-in window was closed before completing sign-in.',
      };
      const message = code.includes('api-key-not-valid')
        ? 'The Firebase web API key is invalid. Copy the Web API Key from Firebase Project settings into Vercel as VITE_FIREBASE_API_KEY, then redeploy.'
        : messages[code] || `Google sign-in failed (${code}). Check the browser console for details.`;
      throw new Error(message);
    }
  };

  const signOut = async () => {
    try {
      await fbSignOut(auth);
    } catch (error) {
      console.error('Sign Out Error:', error);
    }
  };

  const signInWithGitHub = async () => {
    try {
      await signInWithPopup(auth, githubProvider);
    } catch (error: any) {
      if (error?.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, githubProvider);
        return;
      }
      if (error?.code === 'auth/popup-closed-by-user') throw new Error('GitHub sign-in was cancelled.');
      if (error?.code === 'auth/account-exists-with-different-credential') throw new Error('This email already uses another sign-in provider. Sign in with that provider first.');
      throw new Error(error?.message || 'GitHub sign-in failed.');
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
        signInWithGoogle,
        signInWithGitHub,
        signOut,
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

