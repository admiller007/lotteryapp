import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig, isFirebaseConfigured, missingVars } from './config';

// Singleton instances
let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;
let _storage: FirebaseStorage | null = null;

export function ensureFirebaseInitialized(): void {
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

export function getFirestoreInstance(): Firestore {
  ensureFirebaseInitialized();
  if (!_db) {
    throw new Error('Firestore not initialized');
  }
  return _db;
}

export function getAuthInstance(): Auth {
  ensureFirebaseInitialized();
  if (!_auth) {
    throw new Error('Auth not initialized');
  }
  return _auth;
}

export function getStorageInstance(): FirebaseStorage {
  ensureFirebaseInitialized();
  if (!_storage) {
    throw new Error('Storage not initialized');
  }
  return _storage;
}

export function getAppInstance(): FirebaseApp {
  ensureFirebaseInitialized();
  if (!_app) {
    throw new Error('Firebase app not initialized');
  }
  return _app;
}
