// Firebase configuration - environment variables are injected at build time
// CACHE_BUST: 2025-12-22T16:42:00Z - Force complete rebuild
export const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
] as const;

// Validate environment variables at build time
export const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
export const isFirebaseConfigured = missingVars.length === 0;

// Firebase configuration object
export const firebaseConfig = isFirebaseConfigured ? {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
} : null;

// Log configuration status during development
if (process.env.NODE_ENV !== 'production' && typeof window === 'undefined') {
  console.log('[Firebase Config] Configured:', isFirebaseConfigured);
  if (!isFirebaseConfigured) {
    console.log('[Firebase Config] Missing vars:', missingVars);
  }
}
