// Server login, allocation and admin routes, called directly against the
// Firestore and Auth emulators: npm test
import { after, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithCustomToken } from 'firebase/auth';
import { POST as login } from '../src/app/api/auth/login/route';
import { POST as allocate } from '../src/app/api/allocations/route';
import { POST as createUsers } from '../src/app/api/admin/users/route';
import { DELETE as deleteUser, PATCH as resetPin } from '../src/app/api/admin/users/[id]/route';
import { getAdminDb } from '../src/lib/server/firebaseAdmin';

const projectId = process.env.GCLOUD_PROJECT || 'demo-lottery';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
assert.ok(firestoreHost && authHost, 'Run with the emulators: npm test');

const db = getAdminDb();
const clientApps: FirebaseApp[] = [];

async function resetEmulators() {
  await fetch(`http://${firestoreHost}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`http://${authHost}/emulator/v1/projects/${projectId}/accounts`, { method: 'DELETE' });
}

const post = (url: string, body: unknown, token?: string, method = 'POST') =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function doLogin(firstName: string, lastName: string, facilityName: string, pin: string, extra = {}) {
  const res = await login(post('/api/auth/login', { firstName, lastName, facilityName, pin, ...extra }));
  return { status: res.status, body: await res.json() };
}

// Exchanges the server's custom token for an ID token, as the browser does.
async function idTokenFor(customToken: string) {
  const app = initializeApp({ apiKey: 'demo-key', projectId }, `client-${clientApps.length}`);
  clientApps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  const cred = await signInWithCustomToken(auth, customToken);
  return { token: await cred.user.getIdToken(), claims: (await cred.user.getIdTokenResult()).claims };
}

async function loginToken(firstName: string, lastName: string, facilityName: string, pin: string) {
  const { status, body } = await doLogin(firstName, lastName, facilityName, pin);
  assert.equal(status, 200, JSON.stringify(body));
  return idTokenFor(body.token);
}

// A user created before this change: plain PIN on the doc, PIN in the ID.
async function seedLegacyUser(id: string, data: Record<string, unknown>) {
  await db.collection('users').doc(id).set({ status: 'working', tickets: 10, ...data });
}

beforeEach(resetEmulators);
after(async () => {
  await Promise.all(clientApps.map((app) => deleteApp(app)));
});

describe('login', () => {
  test('migrates a legacy plain-text PIN on first login', async () => {
    await seedLegacyUser('u1', {
      firstName: 'Mary Ann', lastName: 'Lee', facilityName: 'Main Office', pin: '4821',
      employeeId: 'user_mary_ann_lee_main_office_4821',
    });

    // Case and spaces don't matter (the old login page also stripped spaces).
    const ok = await doLogin('mary ann', 'LEE', 'MainOffice', '4821');
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.id, 'u1');
    assert.equal(ok.body.user.isAdmin, false);
    assert.equal(ok.body.user.pin, undefined);

    const user = (await db.collection('users').doc('u1').get()).data()!;
    assert.equal(user.pin, undefined, 'plain PIN removed from the public doc');
    assert.equal(user.employeeId, 'user_mary_ann_lee_main_office_u1');
    assert.equal(user.loginKey, 'maryann|lee|mainoffice');
    const secret = (await db.collection('userSecrets').doc('u1').get()).data()!;
    assert.match(secret.pinHash, /^scrypt\$/);
    assert.ok(!secret.pinHash.includes('4821'));

    // Works again from the hash; wrong PIN still fails.
    assert.equal((await doLogin('Mary Ann', 'Lee', 'Main Office', '4821')).status, 200);
    assert.equal((await doLogin('Mary Ann', 'Lee', 'Main Office', '0000')).status, 401);
  });

  test('finds users added later without a login key (e.g. in the Firebase console)', async () => {
    await seedLegacyUser('u1', { firstName: 'First', lastName: 'One', facilityName: 'HQ', pin: '1' });
    assert.equal((await doLogin('First', 'One', 'HQ', '1')).status, 200);
    await seedLegacyUser('u3', { firstName: 'Console', lastName: 'Added', facilityName: 'HQ', pin: '3' });
    assert.equal((await doLogin('Console', 'Added', 'HQ', '3')).status, 200);
  });

  test('handles a PIN stored as a number', async () => {
    await seedLegacyUser('u1', { firstName: 'Num', lastName: 'Pin', facilityName: 'X', pin: 1234 });
    assert.equal((await doLogin('Num', 'Pin', 'X', '1234')).status, 200);
  });

  test('rejects unknown users and missing fields with no detail', async () => {
    const res = await doLogin('Nobody', 'Here', 'Nowhere', '1');
    assert.equal(res.status, 401);
    assert.equal((await doLogin('', 'Here', 'Nowhere', '1')).status, 400);
  });

  test('tells two people with the same name and facility apart by PIN', async () => {
    await seedLegacyUser('a', { firstName: 'Sam', lastName: 'Smith', facilityName: 'HQ', pin: '1111' });
    await seedLegacyUser('b', { firstName: 'Sam', lastName: 'Smith', facilityName: 'HQ', pin: '2222' });
    assert.equal((await doLogin('Sam', 'Smith', 'HQ', '1111')).body.user.id, 'a');
    assert.equal((await doLogin('Sam', 'Smith', 'HQ', '2222')).body.user.id, 'b');
  });

  test('locks the account after 10 wrong PINs, until an admin resets it', async () => {
    await seedLegacyUser('u1', { firstName: 'Lock', lastName: 'Me', facilityName: 'HQ', pin: '9999' });
    await seedLegacyUser('adm', { firstName: 'Ada', lastName: 'Admin', facilityName: 'HQ', pin: '5555', role: 'admin' });
    for (let i = 0; i < 10; i++) {
      assert.equal((await doLogin('Lock', 'Me', 'HQ', `000${i}`)).status, 401);
    }
    const locked = await doLogin('Lock', 'Me', 'HQ', '9999');
    assert.equal(locked.status, 429, 'correct PIN refused while locked');

    const { token } = await loginToken('Ada', 'Admin', 'HQ', '5555');
    const res = await resetPin(post('/api/admin/users/u1', { pin: '2468' }, token, 'PATCH'), { params: Promise.resolve({ id: 'u1' }) });
    assert.equal(res.status, 200);
    assert.equal((await doLogin('Lock', 'Me', 'HQ', '9999')).status, 401, 'old PIN no longer works');
    assert.equal((await doLogin('Lock', 'Me', 'HQ', '2468')).status, 200);
  });

  test('admin rights come from role, via the sign-in token', async () => {
    await seedLegacyUser('adm', { firstName: 'Ada', lastName: 'Admin', facilityName: 'HQ', pin: '5555', role: 'admin', employeeId: 'ADMIN001' });
    await seedLegacyUser('u1', { firstName: 'Reg', lastName: 'User', facilityName: 'HQ', pin: '1111', employeeId: 'DEV007' });
    assert.equal((await loginToken('Ada', 'Admin', 'HQ', '5555')).claims.admin, true);
    // The old hard-coded admin IDs mean nothing on their own any more.
    assert.equal((await loginToken('Reg', 'User', 'HQ', '1111')).claims.admin, false);
  });

  test('party check-in marks the user as at the party', async () => {
    await seedLegacyUser('u1', { firstName: 'Pat', lastName: 'Y', facilityName: 'HQ', pin: '1', status: 'inactive' });
    const res = await doLogin('Pat', 'Y', 'HQ', '1', { partyCheckIn: true });
    assert.equal(res.body.user.status, 'at_party');
  });
});

describe('allocations', () => {
  const seedLottery = async () => {
    await seedLegacyUser('alice', { firstName: 'Alice', lastName: 'A', facilityName: 'HQ', pin: '1', tickets: 10 });
    await seedLegacyUser('bob', { firstName: 'Bob', lastName: 'B', facilityName: 'HQ', pin: '2', tickets: 10 });
    await seedLegacyUser('adm', { firstName: 'Ada', lastName: 'Admin', facilityName: 'HQ', pin: '5', role: 'admin' });
    await db.collection('prizes').doc('p1').set({ name: 'TV', entries: [], totalTicketsInPrize: 0 });
    await db.collection('prizes').doc('p2').set({ name: 'Spa', entries: [], totalTicketsInPrize: 0 });
  };
  const call = async (body: unknown, token?: string) => {
    const res = await allocate(post('/api/allocations', body, token));
    return { status: res.status, body: await res.json() };
  };

  test('enforces the ticket limit on the server', async () => {
    await seedLottery();
    const { token } = await loginToken('Alice', 'A', 'HQ', '1');
    assert.equal((await call({ prizeId: 'p1', tickets: 6 }, token)).status, 200);
    const over = await call({ prizeId: 'p2', tickets: 5 }, token);
    assert.equal(over.status, 400);
    assert.match(over.body.error, /4 left/);
    assert.equal((await call({ prizeId: 'p2', tickets: 4 }, token)).status, 200);
    // Moving tickets off a prize frees them up.
    assert.equal((await call({ prizeId: 'p1', tickets: 0 }, token)).status, 200);
    assert.equal((await call({ prizeId: 'p2', tickets: 10 }, token)).status, 200);

    const p2 = (await db.collection('prizes').doc('p2').get()).data()!;
    assert.deepEqual(p2.entries, [{ userId: 'alice', numTickets: 10 }]);
    assert.equal((await db.collection('prizes').doc('p1').get()).data()!.totalTicketsInPrize, 0);
  });

  test('requires a login and rejects bad input', async () => {
    await seedLottery();
    assert.equal((await call({ prizeId: 'p1', tickets: 1 })).status, 401);
    assert.equal((await call({ prizeId: 'p1', tickets: 1 }, 'forged-token')).status, 401);
    const { token } = await loginToken('Alice', 'A', 'HQ', '1');
    assert.equal((await call({ prizeId: 'p1', tickets: -1 }, token)).status, 400);
    assert.equal((await call({ prizeId: 'p1', tickets: 1.5 }, token)).status, 400);
    assert.equal((await call({ prizeId: 'nope', tickets: 1 }, token)).status, 404);
  });

  test('only admins can allocate for someone else', async () => {
    await seedLottery();
    const alice = await loginToken('Alice', 'A', 'HQ', '1');
    assert.equal((await call({ prizeId: 'p1', tickets: 1, userId: 'bob' }, alice.token)).status, 403);
    const admin = await loginToken('Ada', 'Admin', 'HQ', '5');
    assert.equal((await call({ prizeId: 'p1', tickets: 3, userId: 'bob' }, admin.token)).status, 200);
  });

  test('respects the admin "allocation closed" switch', async () => {
    await seedLottery();
    await db.collection('settings').doc('lottery').set({ allocationsOpen: false });
    const { token } = await loginToken('Alice', 'A', 'HQ', '1');
    assert.equal((await call({ prizeId: 'p1', tickets: 1 }, token)).status, 409);
  });

  test('concurrent allocations to one prize all land', async () => {
    await db.collection('prizes').doc('p1').set({ name: 'TV', entries: [], totalTicketsInPrize: 0 });
    const people = Array.from({ length: 8 }, (_, i) => ({ id: `u${i}`, firstName: `User${i}`, lastName: 'C', facilityName: 'HQ', pin: `${i}` }));
    await Promise.all(people.map((p) => seedLegacyUser(p.id, { ...p, tickets: 5 })));
    const tokens = await Promise.all(people.map((p) => loginToken(p.firstName, 'C', 'HQ', p.pin)));
    const results = await Promise.all(tokens.map(({ token }, i) => call({ prizeId: 'p1', tickets: i % 5 + 1 }, token)));
    assert.ok(results.every((r) => r.status === 200), JSON.stringify(results));

    const prize = (await db.collection('prizes').doc('p1').get()).data()!;
    assert.equal(prize.entries.length, 8);
    assert.equal(prize.totalTicketsInPrize, people.reduce((s, _, i) => s + (i % 5 + 1), 0));
  });
});

describe('admin user management', () => {
  const adminToken = async () => {
    await seedLegacyUser('adm', { firstName: 'Ada', lastName: 'Admin', facilityName: 'HQ', pin: '5', role: 'admin' });
    return (await loginToken('Ada', 'Admin', 'HQ', '5')).token;
  };

  test('creates users with hashed PINs; non-admins cannot', async () => {
    await seedLegacyUser('u1', { firstName: 'Reg', lastName: 'User', facilityName: 'HQ', pin: '1' });
    const regular = (await loginToken('Reg', 'User', 'HQ', '1')).token;
    const newUser = { firstName: 'New', lastName: 'Person', facilityName: 'West Wing', tickets: 7, pin: '8642' };
    assert.equal((await createUsers(post('/api/admin/users', { users: [newUser] }, regular))).status, 403);

    const res = await createUsers(post('/api/admin/users', { users: [newUser] }, await adminToken()));
    assert.equal(res.status, 200);
    const [id] = (await res.json()).ids;
    const doc = (await db.collection('users').doc(id).get()).data()!;
    assert.equal(doc.pin, undefined);
    assert.ok(!doc.employeeId.includes('8642'));
    assert.equal(doc.tickets, 7);
    assert.equal((await doLogin('New', 'Person', 'West Wing', '8642')).status, 200);
  });

  test('validates rows', async () => {
    const res = await createUsers(post('/api/admin/users', { users: [{ firstName: 'X', lastName: 'Y', facilityName: 'Z', tickets: 1 }] }, await adminToken()));
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Row 1: PIN/);
  });

  test('deleting a user removes their PIN, entries and wins', async () => {
    const token = await adminToken();
    await seedLegacyUser('u1', { firstName: 'Del', lastName: 'Me', facilityName: 'HQ', pin: '1' });
    await db.collection('prizes').doc('p1').set({ name: 'TV', entries: [], totalTicketsInPrize: 0 });
    const userToken = (await loginToken('Del', 'Me', 'HQ', '1')).token;
    await allocate(post('/api/allocations', { prizeId: 'p1', tickets: 4 }, userToken));
    await db.collection('winners').add({ prizeId: 'p1', winnerId: 'u1' });

    const res = await deleteUser(post('/api/admin/users/u1', undefined, token, 'DELETE'), { params: Promise.resolve({ id: 'u1' }) });
    assert.equal(res.status, 200);
    assert.equal((await db.collection('users').doc('u1').get()).exists, false);
    assert.equal((await db.collection('userSecrets').doc('u1').get()).exists, false);
    assert.equal((await db.collection('allocations').where('userId', '==', 'u1').get()).size, 0);
    assert.equal((await db.collection('winners').where('winnerId', '==', 'u1').get()).size, 0);
    assert.equal((await db.collection('prizes').doc('p1').get()).data()!.totalTicketsInPrize, 0);
  });
});

describe('migration script', () => {
  test('hashes every PIN, scrubs IDs and grants admin', async () => {
    await seedLegacyUser('a1', { firstName: 'Ada', lastName: 'Admin', facilityName: 'HQ', pin: 'admin123', employeeId: 'ADMIN001' });
    await seedLegacyUser('u1', { firstName: 'Jo', lastName: 'Doe', facilityName: 'Main Office', pin: '1234', employeeId: 'user_jo_doe_main_office_1234' });
    await seedLegacyUser('u2', { firstName: 'Nopin', lastName: 'User', facilityName: 'HQ' });

    const run = (...args: string[]) =>
      spawnSync('npx', ['tsx', 'scripts/migrate-security.ts', ...args], { env: process.env, encoding: 'utf8' });

    const preview = run();
    assert.equal(preview.status, 0, preview.stderr);
    assert.match(preview.stdout, /2 plain-text PINs/);
    assert.match(preview.stdout, /1 users have no PIN/);
    assert.equal((await db.collection('users').doc('u1').get()).data()!.pin, '1234', 'preview changes nothing');

    const applied = run('--apply');
    assert.equal(applied.status, 0, applied.stderr);
    assert.match(applied.stdout, /No plain-text PINs remain/);

    const users = await db.collection('users').get();
    users.forEach((d) => assert.equal(d.data().pin, undefined));
    assert.equal((await db.collection('users').doc('a1').get()).data()!.role, 'admin');
    assert.equal((await db.collection('users').doc('u1').get()).data()!.employeeId, 'user_jo_doe_main_office_u1');
    assert.equal((await db.collection('users').doc('u2').get()).data()!.loginKey, 'nopin|user|hq');

    assert.equal((await loginToken('Ada', 'Admin', 'HQ', 'admin123')).claims.admin, true);
    assert.equal((await doLogin('Jo', 'Doe', 'Main Office', '1234')).status, 200);

    const again = run('--apply');
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /0 plain-text PINs/);
  });
});
