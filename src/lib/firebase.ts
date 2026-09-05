import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  connectAuthEmulator, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  linkWithPopup,
  linkWithRedirect,
  getRedirectResult, 
  getAdditionalUserInfo,
  unlink,
  signOut as fbSignOut, 
  onAuthStateChanged, 
  User 
} from 'firebase/auth';
import { getStorage, connectStorageEmulator, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { connectFirestoreEmulator } from 'firebase/firestore';

// Use local Vite variables when provided; keep the generated config as a fallback.
import firebaseConfig from '../../firebase-applet-config.json';

const configuredFirebase = {
  ...firebaseConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || firebaseConfig.measurementId,
};

const app = getApps().length > 0 ? getApp() : initializeApp(configuredFirebase);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'us-central1');
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function createGitHubProvider() {
  const provider = new GithubAuthProvider();
  provider.addScope('read:user');
  provider.addScope('user:email');
  provider.addScope('repo');
  return provider;
}

const githubProvider = createGitHubProvider();

if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

if (import.meta.env.PROD && import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY) {
  initializeAppCheck(app, { provider: new ReCaptchaV3Provider(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true });
}

export { 
  app, 
  auth, 
  db, 
  storage,
  functions,
  httpsCallable,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  googleProvider, 
  githubProvider,
  createGitHubProvider,
  GithubAuthProvider,
  signInWithPopup, 
  signInWithRedirect,
  linkWithPopup,
  linkWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
  unlink,
  fbSignOut,
  onAuthStateChanged,
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp 
};
export type { User };
