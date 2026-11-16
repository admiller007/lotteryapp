import { NextResponse } from 'next/server';
import { Timestamp, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebaseAdmin';
import { errorResponse, HttpError, readJson } from '@/lib/server/requestAuth';
import { isValidPin, legacyPinMatches, verifyPin } from '@/lib/server/pin';
import {
  backfillLoginKeys,
  legacyPinOf,
  migrateLegacyPin,
  toPublicUser,
  USER_SECRETS,
  USERS,
  type UserSecret,
} from '@/lib/server/users';
import { buildLoginKey } from '@/lib/loginKey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// After this many wrong PINs in a row the account is locked for LOCK_MINUTES.
const MAX_FAILED_ATTEMPTS = 10;
const LOCK_MINUTES = 5;

const INVALID = 'Invalid credentials. Please check your name, facility and PIN.';

const readName = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 100) {
    throw new HttpError(400, `Please enter your ${field}.`);
  }
  return value;
};

async function findCandidates(loginKey: string): Promise<QueryDocumentSnapshot[]> {
  const users = getAdminDb().collection(USERS);
  const byKey = () => users.where('loginKey', '==', loginKey).get();
  const snapshot = await byKey();
  if (!snapshot.empty) return snapshot.docs;

  // Users created before this change (or added in the Firebase console) have
  // no loginKey. Two cheap counts tell us whether any are missing one; only
  // then read all users and add it, so wrong names don't cause full scans.
  const [all, keyed] = await Promise.all([
    users.count().get(),
    users.where('loginKey', '>=', '').count().get(),
  ]);
  if (all.data().count === keyed.data().count) return [];
  await backfillLoginKeys(getAdminDb());
  return (await byKey()).docs;
}

async function pinMatches(userDoc: QueryDocumentSnapshot, secret: UserSecret | undefined, pin: string) {
  if (secret?.pinHash) return verifyPin(pin, secret.pinHash);
  // Not migrated yet: compare with the plain PIN, then migrate it.
  const legacyPin = legacyPinOf(userDoc.data());
  if (!legacyPin || !legacyPinMatches(pin, legacyPin)) return false;
  await migrateLegacyPin(getAdminDb(), userDoc);
  return true;
}

async function recordFailure(userId: string) {
  const db = getAdminDb();
  const ref = db.collection(USER_SECRETS).doc(userId);
  await db.runTransaction(async (tx) => {
    const secret = (await tx.get(ref)).data() as UserSecret | undefined;
    const attempts = (secret?.failedAttempts ?? 0) + 1;
    if (attempts >= MAX_FAILED_ATTEMPTS) {
      tx.set(ref, {
        failedAttempts: 0,
        lockedUntil: Timestamp.fromMillis(Date.now() + LOCK_MINUTES * 60_000),
      }, { merge: true });
    } else {
      tx.set(ref, { failedAttempts: attempts }, { merge: true });
    }
  });
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const firstName = readName(body.firstName, 'first name');
    const lastName = readName(body.lastName, 'last name');
    const facilityName = readName(body.facilityName, 'facility name');
    if (!isValidPin(body.pin)) throw new HttpError(400, 'Please enter your PIN.');
    const pin = body.pin;

    const db = getAdminDb();
    const candidates = await findCandidates(buildLoginKey(firstName, lastName, facilityName));
    if (candidates.length === 0) throw new HttpError(401, INVALID);

    // Two people can share a name and facility; the PIN tells them apart.
    let matched: QueryDocumentSnapshot | null = null;
    let lockedCount = 0;
    const unlockedMisses: string[] = [];
    for (const candidate of candidates) {
      const secret = (await db.collection(USER_SECRETS).doc(candidate.id).get()).data() as UserSecret | undefined;
      if (secret?.lockedUntil && secret.lockedUntil.toMillis() > Date.now()) {
        lockedCount++;
        continue;
      }
      if (await pinMatches(candidate, secret, pin)) {
        matched = candidate;
        if (secret?.failedAttempts || secret?.lockedUntil) {
          await db.collection(USER_SECRETS).doc(candidate.id).set(
            { failedAttempts: 0, lockedUntil: null },
            { merge: true }
          );
        }
        break;
      }
      unlockedMisses.push(candidate.id);
    }

    if (!matched) {
      await Promise.all(unlockedMisses.map(recordFailure));
      if (lockedCount > 0 && unlockedMisses.length === 0) {
        throw new HttpError(429, `Too many wrong PINs. Please wait ${LOCK_MINUTES} minutes and try again, or ask an admin to reset your PIN.`);
      }
      throw new HttpError(401, INVALID);
    }

    // The party QR code sends people here with partyCheckIn set.
    if (body.partyCheckIn === true && matched.data().status !== 'at_party') {
      await matched.ref.update({ status: 'at_party' });
    }

    const fresh = await matched.ref.get();
    const user = toPublicUser(fresh.id, fresh.data()!);
    // The browser signs in to Firebase with this token. The admin claim ends up
    // in every ID token for the session, and Firestore rules and the API
    // routes check it.
    const token = await getAdminAuth().createCustomToken(user.id, { admin: user.isAdmin });

    return NextResponse.json({ token, user });
  } catch (error) {
    return errorResponse(error, 'Login failed');
  }
}
