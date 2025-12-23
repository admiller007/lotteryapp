/**
 * BROWSER CONSOLE DEBUG SCRIPT
 *
 * Paste this into your browser console (F12 → Console tab) while on your deployed app
 * to check Firebase configuration and diagnose loading issues.
 */

console.log('🔍 Firebase Debug Script Starting...\n');
console.log('='.repeat(60));

// Check 1: Environment Variables in Client Bundle
console.log('\n📋 Step 1: Checking Environment Variables in Bundle...\n');

const requiredVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID'
];

const envVars = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let missingCount = 0;
let foundCount = 0;

requiredVars.forEach(varName => {
  const value = envVars[varName];
  if (value) {
    console.log(`%c✅ ${varName}`, 'color: green', `${value.substring(0, 15)}...`);
    foundCount++;
  } else {
    console.log(`%c❌ ${varName}`, 'color: red', 'MISSING (undefined)');
    missingCount++;
  }
});

console.log('\n' + '-'.repeat(60));
console.log(`Found: ${foundCount} / ${requiredVars.length}`);
console.log(`Missing: ${missingCount} / ${requiredVars.length}`);
console.log('-'.repeat(60));

if (missingCount > 0) {
  console.log('\n%c❌ PROBLEM FOUND:', 'color: red; font-weight: bold; font-size: 14px');
  console.log('%cEnvironment variables are NOT in the client bundle!', 'color: red; font-size: 12px');
  console.log('\n%cThis means:', 'font-weight: bold');
  console.log('  1. Environment variables were not available during build');
  console.log('  2. Or build cache is serving old bundles without the vars');
  console.log('\n%cHow to fix:', 'font-weight: bold');
  console.log('  1. Check Vercel Dashboard → Settings → Environment Variables');
  console.log('  2. Ensure all Firebase vars are set for this environment');
  console.log('  3. Redeploy with build cache DISABLED');
  console.log('  4. Vercel: Deployments → Redeploy → Uncheck "Use existing build cache"');

  console.log('\n' + '='.repeat(60));
  console.log('%c⚠️  FIREBASE WILL NOT WORK until env vars are in the bundle', 'color: orange; font-weight: bold');
  console.log('='.repeat(60));
} else {
  console.log('\n%c✅ All environment variables present!', 'color: green; font-weight: bold; font-size: 14px');

  // Check 2: Test Firebase initialization
  console.log('\n📋 Step 2: Testing Firebase Initialization...\n');

  try {
    // Try to access the Firebase config module
    import('/src/lib/firebase/config.js').then(module => {
      console.log('✅ Firebase config module loaded');
      console.log('Configuration status:', module.isFirebaseConfigured ? '✅ Configured' : '❌ Not configured');

      if (!module.isFirebaseConfigured) {
        console.log('%c❌ Missing vars:', 'color: red', module.missingVars);
      }
    }).catch(err => {
      console.log('%c⚠️  Could not load Firebase config module:', 'color: orange', err.message);
    });

    // Try to access Firebase instance
    import('/src/lib/firebase/index.js').then(module => {
      console.log('✅ Firebase module loaded');

      // Try to access db
      try {
        const db = module.db;
        console.log('✅ Firestore instance accessible');
        console.log('   Type:', db.type);
      } catch (err) {
        console.log('%c❌ Failed to access Firestore:', 'color: red', err.message);
      }
    }).catch(err => {
      console.log('%c❌ Failed to load Firebase module:', 'color: red', err.message);
    });

  } catch (err) {
    console.log('%c❌ Firebase initialization check failed:', 'color: red', err.message);
  }
}

// Check 3: Look for Firebase errors in console
console.log('\n📋 Step 3: Checking for Firebase Errors...\n');
console.log('Look above in the console for any red error messages mentioning:');
console.log('  - "Missing required Firebase environment variables"');
console.log('  - "Firebase Error"');
console.log('  - "permission-denied"');
console.log('  - "auth/..."');
console.log('  - "firestore/..."');

console.log('\n' + '='.repeat(60));
console.log('Debug script complete!');
console.log('='.repeat(60));
console.log('\n💡 Next steps:');
console.log('  1. Review the output above');
console.log('  2. Visit /firebase-debug for more comprehensive testing');
console.log('  3. Visit /client-env-check to verify in a dedicated page');
console.log('  4. Check the Network tab for Firebase API requests');
