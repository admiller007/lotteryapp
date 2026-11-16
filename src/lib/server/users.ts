import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { buildLoginKey } from '../loginKey';
import { hashPin } from './pin';

// users/{id}        public profile: names, facility, tickets, status, role, loginKey
// userSecrets/{id}  server-only: pinHash, failedAttempts, lockedUntil
export const USERS = 'users';
export const USER_SECRETS = 'userSecrets';

export type UserStatus = 'inactive' | 'working' | 'at_party';
export const USER_STATUSES: UserStatus[] = ['inactive', 'working', 'at_party'];

export interface UserSecret {
  pinHash?: string;
  failedAttempts?: number;
  lockedUntil?: Timestamp | null;
}

const slug = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '_');

// Generated IDs used to end in the user's PIN. They now end in part of the
// (random) document ID instead.
export const generateEmployeeId = (firstName: string, lastName: string, facilityName: string, docId: string) =>
  `user_${slug(`${firstName} ${lastName}`)}_${slug(facilityName)}_${docId.slice(0, 6).toLowerCase()}`;

export function scrubEmployeeId(employeeId: unknown, pin: string, docId: string): string | null {
  if (typeof employeeId !== 'string' || !pin) return null;
  const suffix = `_${pin.trim()}`;
  if (!employeeId.startsWith('user_') || !employeeId.endsWith(suffix)) return null;
  return `${employeeId.slice(0, -suffix.length)}_${docId.slice(0, 6).toLowerCase()}`;
}

// A pre-migration plain-text PIN on a user doc (string, or a number if it was
// typed into the Firebase console), or null.
export function legacyPinOf(data: DocumentData | undefined): string | null {
  const pin = data?.pin;
  if (typeof pin === 'number') return String(pin);
  return typeof pin === 'string' && pin.trim() !== '' ? pin : null;
}

export function loginKeyFor(data: DocumentData): string | null {
  if (typeof data.firstName !== 'string' || typeof data.lastName !== 'string' || typeof data.facilityName !== 'string') {
    return null;
  }
  return buildLoginKey(data.firstName, data.lastName, data.facilityName);
}

/**
 * Moves a pre-migration user's plain-text PIN into userSecrets as a hash,
 * removes it from the public user doc, and strips it from a generated
 * employeeId. Returns the new hash, or null if the user had no plain PIN.
 */
export async function migrateLegacyPin(db: Firestore, userSnap: DocumentSnapshot): Promise<string | null> {
  const data = userSnap.data();
  const legacyPin = legacyPinOf(data);
  if (!data || !legacyPin) return null;

  const secretRef = db.collection(USER_SECRETS).doc(userSnap.id);
  const existing = (await secretRef.get()).data() as UserSecret | undefined;
  const pinHash = existing?.pinHash ?? (await hashPin(legacyPin));

  const userUpdate: Record<string, unknown> = { pin: FieldValue.delete() };
  const loginKey = loginKeyFor(data);
  if (loginKey && data.loginKey !== loginKey) userUpdate.loginKey = loginKey;
  const scrubbed = scrubEmployeeId(data.employeeId, legacyPin, userSnap.id);
  if (scrubbed) userUpdate.employeeId = scrubbed;

  const batch = db.batch();
  if (!existing?.pinHash) batch.set(secretRef, { pinHash }, { merge: true });
  batch.update(userSnap.ref as DocumentReference, userUpdate);
  await batch.commit();
  return pinHash;
}

export async function backfillLoginKeys(db: Firestore): Promise<number> {
  const snapshot = await db.collection(USERS).get();
  let updated = 0;
  let batch = db.batch();
  let ops = 0;
  for (const doc of snapshot.docs) {
    // Docs missing a name get '' so they still count as keyed (see login route).
    const key = loginKeyFor(doc.data()) ?? '';
    if (doc.data().loginKey === key) continue;
    batch.update(doc.ref, { loginKey: key });
    updated++;
    if (++ops === 450) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();
  return updated;
}

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  facilityName: string;
  tickets: number;
  status: UserStatus;
  profilePictureUrl?: string;
  isAdmin: boolean;
}

export function toPublicUser(id: string, data: DocumentData): PublicUser {
  return {
    id,
    firstName: data.firstName ?? '',
    lastName: data.lastName ?? '',
    employeeId: data.employeeId ?? id,
    facilityName: data.facilityName ?? '',
    tickets: typeof data.tickets === 'number' ? data.tickets : 0,
    status: USER_STATUSES.includes(data.status) ? data.status : 'inactive',
    profilePictureUrl: data.profilePictureUrl || undefined,
    isAdmin: data.role === 'admin',
  };
}

export interface NewUser {
  firstName: string;
  lastName: string;
  facilityName: string;
  employeeId?: string;
  tickets: number;
  pin: string;
  status: UserStatus;
}

/** Creates users with their PINs hashed into userSecrets. Returns the new IDs. */
export async function createUsers(db: Firestore, users: NewUser[]): Promise<string[]> {
  const pinHashes = await Promise.all(users.map((u) => hashPin(u.pin)));
  const ids: string[] = [];
  // Two writes per user; a batch holds 500.
  for (let start = 0; start < users.length; start += 200) {
    const batch = db.batch();
    users.slice(start, start + 200).forEach((user, offset) => {
      const ref = db.collection(USERS).doc();
      ids.push(ref.id);
      batch.set(ref, {
        firstName: user.firstName,
        lastName: user.lastName,
        facilityName: user.facilityName,
        employeeId: user.employeeId ?? generateEmployeeId(user.firstName, user.lastName, user.facilityName, ref.id),
        tickets: user.tickets,
        status: user.status,
        loginKey: buildLoginKey(user.firstName, user.lastName, user.facilityName),
        createdAt: Timestamp.now(),
      });
      batch.set(db.collection(USER_SECRETS).doc(ref.id), { pinHash: pinHashes[start + offset] });
    });
    await batch.commit();
  }
  return ids;
}
