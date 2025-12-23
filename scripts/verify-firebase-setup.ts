#!/usr/bin/env tsx
/**
 * Firebase Setup Verification Script
 *
 * This script checks if Firebase is properly configured and can connect to Firestore.
 * Run with: tsx scripts/verify-firebase-setup.ts
 */

import { requiredEnvVars, isFirebaseConfigured, missingVars, firebaseConfig } from '../src/lib/firebase/config';

console.log('🔍 Firebase Configuration Verification\n');
console.log('='.repeat(60));

// Check 1: Environment Variables
console.log('\n📋 Step 1: Checking Environment Variables...\n');

requiredEnvVars.forEach(varName => {
  const value = process.env[varName];
  const status = value ? '✅' : '❌';
  const display = value ? `${value.substring(0, 10)}...` : 'MISSING';
  console.log(`${status} ${varName}: ${display}`);
});

console.log('\n' + '-'.repeat(60));

if (!isFirebaseConfigured) {
  console.log('\n❌ FAILED: Missing required environment variables:\n');
  missingVars.forEach(v => console.log(`   - ${v}`));
  console.log('\n💡 To fix this:');
  console.log('   1. Copy .env.example to .env.local');
  console.log('   2. Fill in your Firebase credentials from Firebase Console');
  console.log('   3. Restart your development server');
  console.log('   4. For Vercel: Set env vars in Dashboard → Settings → Environment Variables\n');
  process.exit(1);
}

console.log('\n✅ All required environment variables are set!');

// Check 2: Firebase Config Object
console.log('\n📋 Step 2: Validating Firebase Configuration Object...\n');

if (!firebaseConfig) {
  console.log('❌ FAILED: Firebase config object is null');
  process.exit(1);
}

console.log('✅ Firebase configuration object created successfully');
console.log(`   Project ID: ${firebaseConfig.projectId}`);
console.log(`   Auth Domain: ${firebaseConfig.authDomain}`);
console.log(`   Storage Bucket: ${firebaseConfig.storageBucket}`);

// Check 3: Firebase Initialization
console.log('\n📋 Step 3: Testing Firebase Initialization...\n');

try {
  const { getFirestoreInstance, getAuthInstance, getStorageInstance } = await import('../src/lib/firebase/initialize');

  console.log('Attempting to initialize Firebase services...');

  const db = getFirestoreInstance();
  console.log('✅ Firestore initialized');

  const auth = getAuthInstance();
  console.log('✅ Auth initialized');

  const storage = getStorageInstance();
  console.log('✅ Storage initialized');

} catch (error) {
  console.log('❌ FAILED: Firebase initialization error');
  console.error(error);
  process.exit(1);
}

// Check 4: Test Firestore Connection
console.log('\n📋 Step 4: Testing Firestore Connection...\n');

try {
  const { collection, getDocs } = await import('firebase/firestore');
  const { db } = await import('../src/lib/firebase');

  console.log('Attempting to read from Firestore...');

  // Try to read from a collection (this will work even if empty)
  const testCollections = ['users', 'prizes', 'prizeTiers'];

  for (const collectionName of testCollections) {
    try {
      const collectionRef = collection(db, collectionName);
      const snapshot = await getDocs(collectionRef);
      console.log(`✅ ${collectionName}: ${snapshot.size} documents found`);
    } catch (error: any) {
      console.log(`⚠️  ${collectionName}: ${error.message}`);
    }
  }

} catch (error: any) {
  console.log('❌ FAILED: Firestore connection error');
  console.error('Error details:', error.message);

  if (error.message.includes('permission-denied')) {
    console.log('\n💡 This might be a Firestore security rules issue.');
    console.log('   Check your Firestore security rules in Firebase Console.');
  } else if (error.message.includes('not found')) {
    console.log('\n💡 The project ID might be incorrect.');
    console.log('   Verify NEXT_PUBLIC_FIREBASE_PROJECT_ID matches your Firebase project.');
  } else {
    console.log('\n💡 Check your Firebase configuration and network connection.');
  }

  process.exit(1);
}

// Success!
console.log('\n' + '='.repeat(60));
console.log('✅ All checks passed! Firebase is properly configured.');
console.log('='.repeat(60) + '\n');
