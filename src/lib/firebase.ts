import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Firebase Configuration - Updated 2025-12-22 to fix env var cache issue
// Check if all required Firebase environment variables are present
const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

// Check for missing environment variables at build time
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
const isFirebaseConfigured = missingVars.length === 0;

// Log configuration status during build (removed in production bundles)
if (process.env.NODE_ENV !== 'production' && typeof window === 'undefined') {
  console.log('[Firebase Config] Configured:', isFirebaseConfigured);
}

// Firebase configuration
const firebaseConfig = isFirebaseConfigured ? {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
} : null;

// Lazy initialization - only initialize when actually accessed
let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;
let _storage: FirebaseStorage | null = null;

function ensureFirebaseInitialized(): void {
  if (!isFirebaseConfigured) {
    const errorMessage =
      `Missing required Firebase environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env.local file or Vercel environment variables configuration.\n\n' +
      'To fix this:\n' +
      '1. Copy .env.example to .env.local\n' +
      '2. Fill in your Firebase configuration values\n' +
      '3. Restart your development server';

    console.error('Firebase Error:', errorMessage);
    throw new Error(errorMessage);
  }

  if (!_app && firebaseConfig) {
    _app = initializeApp(firebaseConfig);
    _db = getFirestore(_app);
    _auth = getAuth(_app);
    _storage = getStorage(_app);
  }
}

// Create a proxy object to enable lazy initialization
const createLazyProxy = <T extends object>(getter: () => T): T => {
  return new Proxy({} as T, {
    get(target, prop) {
      const instance = getter();
      return instance[prop as keyof T];
    }
  });
};

// Export lazy-initialized instances that only initialize when actually accessed
export const db = createLazyProxy<Firestore>(() => {
  ensureFirebaseInitialized();
  return _db!;
});

export const auth = createLazyProxy<Auth>(() => {
  ensureFirebaseInitialized();
  return _auth!;
});

export const storage = createLazyProxy<FirebaseStorage>(() => {
  ensureFirebaseInitialized();
  return _storage!;
});

const defaultApp = createLazyProxy<FirebaseApp>(() => {
  ensureFirebaseInitialized();
  return _app!;
});

export default defaultApp;