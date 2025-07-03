import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA1XMmRATBiGchdjhrbZGmOcfPH_jWNqgY",
  authDomain: "lottery-63320.firebaseapp.com",
  projectId: "lottery-63320",
  storageBucket: "lottery-63320.firebasestorage.app",
  messagingSenderId: "517420395756",
  appId: "1:517420395756:web:2f44f9e96d1e5cde8b89c9",
  measurementId: "G-FN2CY6V6WB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;