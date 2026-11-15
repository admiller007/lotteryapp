import type { Firestore } from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { FirebaseStorage } from 'firebase/storage';
import type { FirebaseApp } from 'firebase/app';
import { isFirebaseConfigured, missingVars } from './config';
import {
  getFirestoreInstance,
  getAuthInstance,
  getStorageInstance,
  getAppInstance
} from './initialize';

// Firebase SDK functions (collection, doc, writeBatch, runTransaction, ...)
// type-check their first argument with `instanceof`, so `db` must be the real
// SDK instance — a Proxy wrapper is rejected with "Expected first argument to
// collection() to be ... FirebaseFirestore". When env vars are missing we
// export a stub that throws a clear error on first use instead of crashing at
// import time.
function missingConfigStub<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get() {
      throw new Error(
        `Firebase ${name} unavailable: missing environment variables ${missingVars.join(', ')}`
      );
    }
  });
}

export const db: Firestore = isFirebaseConfigured
  ? getFirestoreInstance()
  : missingConfigStub<Firestore>('Firestore');

export const auth: Auth = isFirebaseConfigured
  ? getAuthInstance()
  : missingConfigStub<Auth>('Auth');

export const storage: FirebaseStorage = isFirebaseConfigured
  ? getStorageInstance()
  : missingConfigStub<FirebaseStorage>('Storage');

const app: FirebaseApp = isFirebaseConfigured
  ? getAppInstance()
  : missingConfigStub<FirebaseApp>('App');

export default app;
