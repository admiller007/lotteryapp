import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { FirebaseStorage } from 'firebase/storage';
import { FirebaseApp } from 'firebase/app';
import {
  getFirestoreInstance,
  getAuthInstance,
  getStorageInstance,
  getAppInstance
} from './initialize';

// Export lazy-initialized instances using Proxy for deferred initialization
export const db = new Proxy({} as Firestore, {
  get(target, prop) {
    const instance = getFirestoreInstance();
    const value = instance[prop as keyof Firestore];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export const auth = new Proxy({} as Auth, {
  get(target, prop) {
    const instance = getAuthInstance();
    const value = instance[prop as keyof Auth];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export const storage = new Proxy({} as FirebaseStorage, {
  get(target, prop) {
    const instance = getStorageInstance();
    const value = instance[prop as keyof FirebaseStorage];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

const app = new Proxy({} as FirebaseApp, {
  get(target, prop) {
    const instance = getAppInstance();
    const value = instance[prop as keyof FirebaseApp];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

export default app;
