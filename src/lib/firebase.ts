import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyA1XMmRATBiGchdjhrbZGmOcfPH_jWNqgY",
  authDomain: "lottery-63320.firebaseapp.com",
  databaseURL: "https://lottery-63320-default-rtdb.firebaseio.com",
  projectId: "lottery-63320",
  storageBucket: "lottery-63320.firebasestorage.app",
  messagingSenderId: "517420395756",
  appId: "1:517420395756:web:2f44f9e96d1e5cde8b89c9",
  measurementId: "G-FN2CY6V6WB"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;