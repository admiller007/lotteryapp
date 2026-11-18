/**
 * Dry-run helper: seed test users and prizes, allocate their tickets, inspect,
 * and clean up — without touching real users or prizes.
 *
 *   npm run dry-run -- seed       create TEST-001..TEST-010 users and 3 "TEST Prize" prizes
 *   npm run dry-run -- allocate   spread each test user's tickets across the test prizes
 *   npm run dry-run -- draw       draw winners for the test prizes only (weighted by tickets)
 *   npm run dry-run -- status     show test prizes, their entries and winners
 *   npm run dry-run -- clean      delete all test users, prizes, allocations and winners
 *
 * Uses the Firebase Admin SDK with FIREBASE_SERVICE_ACCOUNT_KEY from
 * .env.local (or the emulators when FIRESTORE_EMULATOR_HOST is set).
 * Allocations go through the same server transaction as the /api/allocations
 * route, all users at once, so `allocate` also exercises concurrency.
 *
 * Test users can log in on the site with:
 *   First name "Test", last name "User 01" … "User 10", facility "Test Facility", PIN 1111
 */
import { config } from 'dotenv';
import { Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { getAdminDb } from '../src/lib/server/firebaseAdmin';
import { createUsers, USER_SECRETS, USERS } from '../src/lib/server/users';
import { setAllocation } from '../src/lib/server/allocations';
import { winnerDocId } from '../src/lib/winnerSync';

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

interface Entry { userId: string; numTickets: number }

async function main() {
  const command = process.argv[2];
  const db = getAdminDb();

  const loadTestData = async () => {
    const [usersSnap, prizesSnap] = await Promise.all([db.collection(USERS).get(), db.collection('prizes').get()]);
    const users = usersSnap.docs
      .filter((d) => String(d.data().employeeId || '').startsWith(TEST_EMPLOYEE_PREFIX))
      .map((d) => ({ id: d.id, ...(d.data() as { firstName: string; lastName: string; employeeId: string; tickets: number }) }));
    const allPrizes = prizesSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { name: string; entries?: Entry[]; totalTicketsInPrize?: number; numberOfWinners?: number }),
    }));
    return { users, prizes: allPrizes.filter((p) => p.name?.startsWith(TEST_PRIZE_PREFIX)), allPrizes };
  };

  switch (command) {
    case 'seed': {
      const { users, prizes } = await loadTestData();
      if (users.length === 0) {
        await createUsers(db, Array.from({ length: USER_COUNT }, (_, i) => {
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
          await db.collection('prizes').add({ ...p, imageUrl: '', entries: [], totalTicketsInPrize: 0, createdAt: Timestamp.now() });
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
      // Each user first clears their entries, then splits all their tickets
      // randomly across the test prizes, all users at the same time.
      await Promise.all(users.flatMap((user) =>
        prizes.map((prize) => setAllocation(db, { userId: user.id, prizeId: prize.id, tickets: 0 }))
      ));
      const jobs = users.flatMap((user) => {
        const split = new Array(prizes.length).fill(0);
        for (let t = 0; t < user.tickets; t++) split[Math.floor(Math.random() * prizes.length)]++;
        return prizes.map((prize, i) => setAllocation(db, { userId: user.id, prizeId: prize.id, tickets: split[i] }));
      });
      await Promise.all(jobs);
      console.log(`Allocated tickets for ${users.length} test users across ${prizes.length} test prizes (${jobs.length} concurrent writes).`);
      // fall through to show the result
    }
    // eslint-disable-next-line no-fallthrough
    case 'draw': {
      if (command === 'draw') {
        // Only TEST prizes are drawn, so real prizes and winners are never touched.
        const { prizes } = await loadTestData();
        const winnersSnap = await db.collection('winners').get();
        const taken = new Set(winnersSnap.docs.map((d) => d.data().winnerId as string));
        const batch = db.batch();
        let drawn = 0;
        for (const prize of prizes) {
          const current = winnersSnap.docs.filter((d) => d.data().prizeId === prize.id).length;
          for (let slot = current; slot < (prize.numberOfWinners || 1); slot++) {
            // Weighted by tickets; one prize per person, like the real draw.
            const pool = (prize.entries || []).filter((e) => e.numTickets > 0 && !taken.has(e.userId));
            const total = pool.reduce((sum, e) => sum + e.numTickets, 0);
            if (total === 0) break;
            let pick = Math.random() * total;
            const winner = pool.find((e) => (pick -= e.numTickets) < 0) || pool[pool.length - 1];
            taken.add(winner.userId);
            batch.set(db.collection('winners').doc(winnerDocId(prize.id, winner.userId)), {
              prizeId: prize.id,
              winnerId: winner.userId,
              timestamp: Timestamp.now(),
            });
            drawn++;
          }
        }
        if (drawn === 0) {
          console.log('No winners drawn: the test prizes are already full, or nobody has tickets on them (run `allocate` first).');
        } else {
          await batch.commit();
          console.log(`Drew ${drawn} winner(s) for the test prizes. Open /winners to watch them get announced.`);
        }
      }
    }
    // eslint-disable-next-line no-fallthrough
    case 'status': {
      const { users, prizes } = await loadTestData();
      const winnersSnap = await db.collection('winners').get();
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
        if (actual !== expected) process.exitCode = 1;
      }
      break;
    }

    case 'clean': {
      const { users, prizes, allPrizes } = await loadTestData();
      const testUserIds = new Set(users.flatMap((u) => [u.employeeId, u.id].filter(Boolean)));
      const testPrizeIds = new Set(prizes.map((p) => p.id));
      const refs: DocumentReference[] = [];

      users.forEach((u) => {
        refs.push(db.collection(USERS).doc(u.id));
        refs.push(db.collection(USER_SECRETS).doc(u.id));
      });
      prizes.forEach((p) => refs.push(db.collection('prizes').doc(p.id)));

      const [allocs, winners] = await Promise.all([db.collection('allocations').get(), db.collection('winners').get()]);
      allocs.forEach((d) => {
        const a = d.data();
        if (testUserIds.has(a.userId) || testPrizeIds.has(a.prizeId)) refs.push(d.ref);
      });
      winners.forEach((d) => {
        const w = d.data();
        if (testUserIds.has(w.winnerId) || testPrizeIds.has(w.prizeId)) refs.push(d.ref);
      });

      // Firestore batches are capped at 500 writes.
      for (let i = 0; i < refs.length; i += 450) {
        const batch = db.batch();
        refs.slice(i, i + 450).forEach((r) => batch.delete(r));
        await batch.commit();
      }

      // If someone logged in as a test user and allocated to a real prize, drop those entries.
      let realPrizesFixed = 0;
      for (const p of allPrizes.filter((x) => !testPrizeIds.has(x.id))) {
        const kept = (p.entries || []).filter((e) => !testUserIds.has(e.userId));
        if (kept.length !== (p.entries || []).length) {
          await db.collection('prizes').doc(p.id).update({
            entries: kept,
            totalTicketsInPrize: kept.reduce((s, e) => s + e.numTickets, 0),
          });
          realPrizesFixed++;
        }
      }

      const leftover = await db.collection(USERS).where('facilityName', '==', TEST_FACILITY).get();
      console.log(`Deleted ${users.length} test users, ${prizes.length} test prizes, and ${refs.length - users.length * 2 - prizes.length} allocation/winner docs.`);
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
