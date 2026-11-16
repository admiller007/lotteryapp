// Firebase Admin SDK for server code only (API routes and scripts). It
// bypasses Firestore security rules, so never import this from a client
// component.
import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

let app: App | null = null;

// FIREBASE_SERVICE_ACCOUNT_KEY holds the service-account JSON downloaded from
// Firebase console > Project settings > Service accounts, either as raw JSON
// or base64-encoded (easier to paste into Vercel).
function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;
  const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
  const parsed = JSON.parse(json);
  if (typeof parsed.private_key === 'string') {
    // Env var UIs often store the key's newlines as literal "\n".
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
  };
}

function getAdminApp(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  const serviceAccount = loadServiceAccount();
  const projectId =
    serviceAccount?.projectId ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT;

  if (serviceAccount) {
    app = initializeApp({ credential: cert(serviceAccount), projectId });
  } else if (process.env.FIRESTORE_EMULATOR_HOST || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Emulators need no credentials; GOOGLE_APPLICATION_CREDENTIALS is picked
    // up automatically by the SDK.
    app = initializeApp({ projectId });
  } else {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY is not set. Add the Firebase service-account JSON ' +
        '(raw or base64) to the server environment, e.g. in Vercel project settings.'
    );
  }
  return app;
}

export const getAdminDb = (): Firestore => getFirestore(getAdminApp());
export const getAdminAuth = (): Auth => getAuth(getAdminApp());
