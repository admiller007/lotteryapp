// Firebase configuration - environment variables are injected at build time
// CACHE_BUST: 2025-12-23T06:00:00Z - Fix runtime env var evaluation
export const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
] as const;

// Get missing vars at runtime (not build time)
export function getMissingVars(): string[] {
  return requiredEnvVars.filter(varName => !process.env[varName]);
}

// Check if Firebase is configured at runtime
export function getIsFirebaseConfigured(): boolean {
  return getMissingVars().length === 0;
}

// Legacy exports for backward compatibility - these now evaluate at runtime
export const missingVars = getMissingVars();
export const isFirebaseConfigured = getIsFirebaseConfigured();

// Firebase configuration object - always create it, check validity at runtime
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Log configuration status during development
if (process.env.NODE_ENV !== 'production' && typeof window === 'undefined') {
  const configured = getIsFirebaseConfigured();
  console.log('[Firebase Config] Configured:', configured);
  if (!configured) {
    console.log('[Firebase Config] Missing vars:', getMissingVars());
  }
}
