// Firebase configuration - environment variables are injected at build time
// CACHE_BUST: 2025-12-23T06:30:00Z - Fix dynamic property access issue
export const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
] as const;

// Firebase configuration object - always create it, check validity at runtime
// Note: Must use direct property access, not process.env[varName], because
// Next.js only replaces direct property access at build time
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

// Get missing vars at runtime by checking the actual config object values
// This works because the config object has the actual replaced values
export function getMissingVars(): string[] {
  const missing: string[] = [];

  // Must check each property directly - cannot use dynamic property access
  if (!firebaseConfig.apiKey) missing.push('NEXT_PUBLIC_FIREBASE_API_KEY');
  if (!firebaseConfig.authDomain) missing.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  if (!firebaseConfig.projectId) missing.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  if (!firebaseConfig.storageBucket) missing.push('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET');
  if (!firebaseConfig.messagingSenderId) missing.push('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
  if (!firebaseConfig.appId) missing.push('NEXT_PUBLIC_FIREBASE_APP_ID');

  return missing;
}

// Check if Firebase is configured at runtime
export function getIsFirebaseConfigured(): boolean {
  return getMissingVars().length === 0;
}

// Legacy exports for backward compatibility - these now evaluate at runtime
export const missingVars = getMissingVars();
export const isFirebaseConfigured = getIsFirebaseConfigured();

// Log configuration status during development
if (process.env.NODE_ENV !== 'production' && typeof window === 'undefined') {
  const configured = getIsFirebaseConfigured();
  console.log('[Firebase Config] Configured:', configured);
  if (!configured) {
    console.log('[Firebase Config] Missing vars:', getMissingVars());
  }
}
