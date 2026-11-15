// Firebase configuration - environment variables are injected at build time.
//
// Next.js only inlines NEXT_PUBLIC_* variables into the browser bundle when
// they are referenced literally (process.env.NEXT_PUBLIC_FOO). A dynamic
// lookup like process.env[name] is empty in the browser, so every value is
// read literally here and the "missing" check runs on these values.
const env = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const requiredEnvVars = Object.keys(env) as Array<keyof typeof env>;

export const missingVars = requiredEnvVars.filter(varName => !env[varName]);
export const isFirebaseConfigured = missingVars.length === 0;

// Firebase configuration object
export const firebaseConfig = isFirebaseConfigured ? {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
} : null;

// Log configuration status during development
if (process.env.NODE_ENV !== 'production' && typeof window === 'undefined') {
  console.log('[Firebase Config] Configured:', isFirebaseConfigured);
  if (!isFirebaseConfigured) {
    console.log('[Firebase Config] Missing vars:', missingVars);
  }
}
