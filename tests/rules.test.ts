// Firestore security rules, run against the emulator: npm test
import { after, before, beforeEach, describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteField, doc, getDoc, getDocs, query, setDoc, updateDoc, collection, where, addDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: process.env.GCLOUD_PROJECT || 'demo-lottery',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/alice'), { firstName: 'Alice', lastName: 'A', facilityName: 'North', tickets: 10, status: 'working' });
    await setDoc(doc(db, 'users/bob'), { firstName: 'Bob', lastName: 'B', facilityName: 'South', tickets: 10, status: 'working' });
    await setDoc(doc(db, 'userSecrets/alice'), { pinHash: 'scrypt$x' });
    await setDoc(doc(db, 'prizes/p1'), { name: 'TV', entries: [], totalTicketsInPrize: 0 });
    await setDoc(doc(db, 'allocations/default_p1_alice'), { userId: 'alice', prizeId: 'p1', tickets: 3 });
    await setDoc(doc(db, 'allocations/default_p1_bob'), { userId: 'bob', prizeId: 'p1', tickets: 2 });
    await setDoc(doc(db, 'winners/w1'), { prizeId: 'p1', winnerId: 'bob' });
    await setDoc(doc(db, 'settings/lottery'), { allocationsOpen: true });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const alice = () => env.authenticatedContext('alice', { admin: false }).firestore();
// A user who edits their own token claims client-side still has a token signed
// by Firebase without them; only the server can mint { admin: true }.
const admin = () => env.authenticatedContext('admin1', { admin: true }).firestore();

describe('anyone (not logged in)', () => {
  test('can read the public data the winners screen needs', async () => {
    await assertSucceeds(getDoc(doc(anon(), 'prizes/p1')));
    await assertSucceeds(getDoc(doc(anon(), 'winners/w1')));
    await assertSucceeds(getDoc(doc(anon(), 'users/alice')));
    await assertSucceeds(getDoc(doc(anon(), 'settings/lottery')));
  });

  test('cannot read PINs or allocations', async () => {
    await assertFails(getDoc(doc(anon(), 'userSecrets/alice')));
    await assertFails(getDoc(doc(anon(), 'allocations/default_p1_alice')));
  });

  test('cannot write anything', async () => {
    await assertFails(addDoc(collection(anon(), 'winners'), { prizeId: 'p1', winnerId: 'mallory' }));
    await assertFails(updateDoc(doc(anon(), 'prizes/p1'), { entries: [{ userId: 'mallory', numTickets: 999 }] }));
    await assertFails(updateDoc(doc(anon(), 'users/alice'), { tickets: 999 }));
    await assertFails(setDoc(doc(anon(), 'settings/lottery'), { allocationsOpen: false }));
  });
});

describe('a logged-in user', () => {
  test('cannot pick winners, edit prizes or change settings', async () => {
    await assertFails(addDoc(collection(alice(), 'winners'), { prizeId: 'p1', winnerId: 'alice' }));
    await assertFails(updateDoc(doc(alice(), 'winners/w1'), { winnerId: 'alice' }));
    await assertFails(updateDoc(doc(alice(), 'prizes/p1'), { entries: [{ userId: 'alice', numTickets: 999 }] }));
    await assertFails(setDoc(doc(alice(), 'settings/lottery'), { allocationsOpen: false }));
  });

  test('cannot write allocations directly (must use the API)', async () => {
    await assertFails(setDoc(doc(alice(), 'allocations/default_p1_alice'), { userId: 'alice', prizeId: 'p1', tickets: 999 }));
  });

  test('cannot give themselves tickets or the admin role', async () => {
    await assertFails(updateDoc(doc(alice(), 'users/alice'), { tickets: 999 }));
    await assertFails(updateDoc(doc(alice(), 'users/alice'), { role: 'admin' }));
  });

  test('can change their own profile picture, not anyone else\'s', async () => {
    await assertSucceeds(updateDoc(doc(alice(), 'users/alice'), { profilePictureUrl: 'data:image/jpeg;base64,xyz' }));
    await assertFails(updateDoc(doc(alice(), 'users/bob'), { profilePictureUrl: 'data:image/jpeg;base64,xyz' }));
  });

  test('can read their own allocations only', async () => {
    await assertSucceeds(getDocs(query(collection(alice(), 'allocations'), where('userId', '==', 'alice'))));
    await assertFails(getDocs(query(collection(alice(), 'allocations'), where('userId', '==', 'bob'))));
    await assertFails(getDocs(collection(alice(), 'allocations')));
  });

  test('cannot read PINs, even their own', async () => {
    await assertFails(getDoc(doc(alice(), 'userSecrets/alice')));
  });
});

describe('an admin', () => {
  test('can run the draw and manage prizes and settings', async () => {
    await assertSucceeds(addDoc(collection(admin(), 'winners'), { prizeId: 'p1', winnerId: 'alice' }));
    await assertSucceeds(updateDoc(doc(admin(), 'prizes/p1'), { name: 'Big TV' }));
    await assertSucceeds(setDoc(doc(admin(), 'settings/lottery'), { allocationsOpen: false }, { merge: true }));
    await assertSucceeds(getDocs(collection(admin(), 'allocations')));
  });

  test('can edit users but never store a PIN on them', async () => {
    await assertSucceeds(updateDoc(doc(admin(), 'users/alice'), { tickets: 20, status: 'at_party' }));
    await assertFails(updateDoc(doc(admin(), 'users/alice'), { pin: '1234' }));
    await assertFails(setDoc(doc(admin(), 'users/carol'), { firstName: 'Carol', pin: '1234' }));
    await assertSucceeds(setDoc(doc(admin(), 'users/carol'), { firstName: 'Carol' }));
  });

  test('can still edit a not-yet-migrated user that has a legacy pin field', async () => {
    await env.withSecurityRulesDisabled((ctx) => updateDoc(doc(ctx.firestore(), 'users/bob'), { pin: '4321' }));
    await assertSucceeds(updateDoc(doc(admin(), 'users/bob'), { tickets: 5 }));
    // Changing or removing it is the server's job.
    await assertFails(updateDoc(doc(admin(), 'users/bob'), { pin: deleteField() }));
  });

  test('cannot read PINs', async () => {
    await assertFails(getDoc(doc(admin(), 'userSecrets/alice')));
  });
});
