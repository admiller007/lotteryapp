/**
 * Dry-run helper: seed test users and prizes, allocate their tickets, inspect,
 * and clean up — without touching real users or prizes.
 *
 *   npm run dry-run -- seed       create TEST-001..TEST-010 users and 3 "TEST Prize" prizes
 *   npm run dry-run -- allocate   spread each test user's tickets across the test prizes
 *   npm run dry-run -- status     show test prizes, their entries and winners
 *   npm run dry-run -- clean      delete all test users, prizes, allocations and winners
 *
 * Reads the Firebase config from .env.local (same NEXT_PUBLIC_FIREBASE_* vars
 * as the app). Allocations go through the app's real allocateTickets()
 * transaction, all users at once, so `allocate` also exercises concurrency.
 *
 * Test users can log in on the site with:
 *   First name "Test", last name "User 01" … "User 10", facility "Test Facility", PIN 1111
 */
import { config } from 'dotenv';
import * as firestore from 'firebase/firestore';
config({ path: '.env.local' });

const TEST_EMPLOYEE_PREFIX = 'TEST-';
const TEST_PRIZE_PREFIX = 'TEST Prize';
const TEST_FACILITY = 'Test Facility';
const TEST_PIN = '1111';
const USER_COUNT = 10;
const TICKETS_PER_USER = 10;

const TEST_PRIZES = [
  { name: `${TEST_PRIZE_PREFIX} A - Grand`, description: 'Dry-run prize (safe to delete)', numberOfWinners: 1 },
  { name: `${TEST_PRIZE_PREFIX} B - Two winners`, description: 'Dry-run prize (safe to delete)', numberOfWinners: 2 },
  { name: `${TEST_PRIZE_PREFIX} C - Standard`, description: 'Dry-run prize (safe to delete)', numberOfWinners: 1 },
];

async function main() {
  const command = process.argv[2];
  // Import the app's Firebase modules after dotenv so the config sees the env vars.
  // (firebase/firestore itself is imported statically above: a dynamic import
  // would load a second copy of the SDK that rejects the app's db instance.)
  const { db } = await import('../src/lib/firebase/index');
  const svc = await import('../src/lib/firebaseService');
  const { collection, getDocs, writeBatch, query, where } = firestore;

  const isTestUser = (u: { employeeId?: string }) => !!u.employeeId?.startsWith(TEST_EMPLOYEE_PREFIX);
  const isTestPrize = (p: { name?: string }) => !!p.name?.startsWith(TEST_PRIZE_PREFIX);

  const loadTestData = async () => {
    const [users, prizes] = await Promise.all([svc.getUsers(), svc.getPrizes()]);
    return { users: users.filter(isTestUser), prizes: prizes.filter(isTestPrize), allPrizes: prizes };
  };

  switch (command) {
    case 'seed': {
      const { users, prizes } = await loadTestData();
      if (users.length === 0) {
        await svc.addUsers(Array.from({ length: USER_COUNT }, (_, i) => {
          const n = String(i + 1).padStart(2, '0');
          return {
            firstName: 'Test',
            lastName: `User ${n}`,
            employeeId: `${TEST_EMPLOYEE_PREFIX}0${n}`,
            facilityName: TEST_FACILITY,
            tickets: TICKETS_PER_USER,
            pin: TEST_PIN,
            status: 'working' as const,
          };
        }));
        console.log(`Created ${USER_COUNT} test users.`);
      } else {
        console.log(`${users.length} test users already exist, skipping.`);
      }
      if (prizes.length === 0) {
        for (const p of TEST_PRIZES) {
          await svc.addPrize({ ...p, imageUrl: '', entries: [], totalTicketsInPrize: 0 });
        }
        console.log(`Created ${TEST_PRIZES.length} test prizes.`);
      } else {
        console.log(`${prizes.length} test prizes already exist, skipping.`);
      }
      console.log(`Log in as: Test / User 01 / ${TEST_FACILITY} / PIN ${TEST_PIN}`);
      break;
    }

    case 'allocate': {
      const { users, prizes } = await loadTestData();
      if (users.length === 0 || prizes.length === 0) {
        console.log('No test users or prizes found. Run `npm run dry-run -- seed` first.');
        break;
      }
      // Each user splits all their tickets randomly across the test prizes.
      const jobs = users.flatMap((user) => {
        const split = new Array(prizes.length).fill(0);
        for (let t = 0; t < user.tickets; t++) split[Math.floor(Math.random() * prizes.length)]++;
        return prizes.map((prize, i) => svc.allocateTickets({
          lotteryId: 'default',
          prizeId: prize.id!,
          userId: user.employeeId,
          userName: `${user.firstName} ${user.lastName}`,
          tickets: split[i],
          timestamp: new Date().toISOString(),
        }));
      });
      await Promise.all(jobs);
      console.log(`Allocated tickets for ${users.length} test users across ${prizes.length} test prizes (${jobs.length} concurrent writes).`);
      // fall through to show the result
    }
    // eslint-disable-next-line no-fallthrough
    case 'status': {
      const { users, prizes } = await loadTestData();
      const winnersSnap = await getDocs(collection(db, 'winners'));
      const userName = (id: string) => {
        const u = users.find((x) => x.employeeId === id || x.id === id);
        return u ? `${u.firstName} ${u.lastName}` : id;
      };
      console.log(`\nTest users: ${users.length}   Test prizes: ${prizes.length}`);
      for (const p of prizes) {
        const winners = winnersSnap.docs.filter((d) => d.data().prizeId === p.id).map((d) => userName(d.data().winnerId));
        const entries = (p.entries || []).map((e) => `${userName(e.userId).replace('Test ', '')}:${e.numTickets}`).join(', ');
        console.log(`\n${p.name}  (${p.entries?.length || 0} entrants, ${p.totalTicketsInPrize} tickets, ${p.numberOfWinners || 1} winner slot(s))`);
        console.log(`  entries: ${entries || '-'}`);
        console.log(`  winners: ${winners.join(', ') || '-'}`);
      }
      const expected = users.reduce((s, u) => s + u.tickets, 0);
      const actual = prizes.reduce((s, p) => s + (p.totalTicketsInPrize || 0), 0);
      if (command === 'allocate') {
        console.log(`\nTicket check: ${actual} allocated of ${expected} expected ${actual === expected ? 'OK' : 'MISMATCH'}`);
      }
      break;
    }

    case 'clean': {
      const { users, prizes, allPrizes } = await loadTestData();
      const testUserIds = new Set(users.flatMap((u) => [u.employeeId, u.id].filter(Boolean) as string[]));
      const testPrizeIds = new Set(prizes.map((p) => p.id!));
      const refs: firestore.DocumentReference[] = [];

      users.forEach((u) => refs.push(firestore.doc(db, 'users', u.id!)));
      prizes.forEach((p) => refs.push(firestore.doc(db, 'prizes', p.id!)));

      const allocs = await getDocs(collection(db, 'allocations'));
      allocs.forEach((d) => {
        const a = d.data();
        if (testUserIds.has(a.userId) || testPrizeIds.has(a.prizeId)) refs.push(d.ref);
      });
      const winners = await getDocs(collection(db, 'winners'));
      winners.forEach((d) => {
        const w = d.data();
        if (testUserIds.has(w.winnerId) || testPrizeIds.has(w.prizeId)) refs.push(d.ref);
      });

      // Firestore batches are capped at 500 writes.
      for (let i = 0; i < refs.length; i += 450) {
        const batch = writeBatch(db);
        refs.slice(i, i + 450).forEach((r) => batch.delete(r));
        await batch.commit();
      }

      // If someone logged in as a test user and allocated to a real prize, drop those entries.
      let realPrizesFixed = 0;
      for (const p of allPrizes.filter((x) => !testPrizeIds.has(x.id!))) {
        const kept = (p.entries || []).filter((e) => !testUserIds.has(e.userId));
        if (kept.length !== (p.entries || []).length) {
          await svc.updatePrizeEntries(p.id!, kept);
          realPrizesFixed++;
        }
      }

      const leftover = await getDocs(query(collection(db, 'users'), where('facilityName', '==', TEST_FACILITY)));
      console.log(`Deleted ${users.length} test users, ${prizes.length} test prizes, and ${refs.length - users.length - prizes.length} allocation/winner docs.`);
      if (realPrizesFixed) console.log(`Removed test-user entries from ${realPrizesFixed} real prize(s).`);
      if (!leftover.empty) console.log(`Note: ${leftover.size} user(s) with facility "${TEST_FACILITY}" remain (not TEST- employee IDs, left untouched).`);
      break;
    }

    default:
      console.log('Usage: npm run dry-run -- <seed|allocate|status|clean>');
      process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error('Dry run failed:', e?.message || e);
    process.exit(1);
  });
