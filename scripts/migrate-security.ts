/**
 * One-time security migration. Run it once after deploying the server login,
 * and before (or right after) deploying firestore.rules.
 *
 *   npm run migrate:security                       preview: show what would change
 *   npm run migrate:security -- --apply            make the changes
 *   npm run migrate:security -- --apply --admins ADMIN001,DEV007
 *
 * For every user it:
 *   - moves a plain-text `pin` into userSecrets as a salted hash and deletes it
 *     from the public user doc
 *   - removes the PIN from generated employee IDs (user_<name>_<facility>_<PIN>)
 *   - adds the loginKey the server login looks users up by
 * and gives role "admin" to the users with the --admins employee IDs
 * (default ADMIN001,DEV007, the IDs that used to be hard-coded as admins).
 *
 * Safe to run more than once. Uses FIREBASE_SERVICE_ACCOUNT_KEY from
 * .env.local (or the emulators when FIRESTORE_EMULATOR_HOST is set).
 */
import { config } from 'dotenv';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAdminDb } from '../src/lib/server/firebaseAdmin';
import { backfillLoginKeys, legacyPinOf, loginKeyFor, migrateLegacyPin, scrubEmployeeId, USER_SECRETS, USERS } from '../src/lib/server/users';

config({ path: '.env.local' });

function readAdminIds(): string[] {
  const i = process.argv.indexOf('--admins');
  const raw = i >= 0 ? process.argv[i + 1] : 'ADMIN001,DEV007';
  return (raw || '').split(',').map((id) => id.trim()).filter(Boolean);
}

async function inBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const adminIds = readAdminIds();
  const db = getAdminDb();

  const [usersSnap, secretsSnap] = await Promise.all([db.collection(USERS).get(), db.collection(USER_SECRETS).get()]);
  const hasHash = new Set(secretsSnap.docs.filter((d) => d.data().pinHash).map((d) => d.id));
  const name = (d: QueryDocumentSnapshot) => `${d.data().firstName ?? '?'} ${d.data().lastName ?? '?'} (${d.id})`;

  const withPlainPin = usersSnap.docs.filter((d) => legacyPinOf(d.data()) !== null);
  const scrubbable = withPlainPin.filter((d) => scrubEmployeeId(d.data().employeeId, legacyPinOf(d.data())!, d.id));
  const needsKey = usersSnap.docs.filter((d) => {
    const key = loginKeyFor(d.data());
    return key && d.data().loginKey !== key;
  });
  const newAdmins = usersSnap.docs.filter((d) => adminIds.includes(d.data().employeeId) && d.data().role !== 'admin');
  const existingAdmins = usersSnap.docs.filter((d) => d.data().role === 'admin');
  const noPin = usersSnap.docs.filter((d) => !hasHash.has(d.id) && !withPlainPin.includes(d));

  console.log(`${usersSnap.size} users`);
  console.log(`  ${withPlainPin.length} plain-text PINs to hash and remove from user docs`);
  console.log(`  ${scrubbable.length} employee IDs that contain the PIN, to rewrite`);
  console.log(`  ${needsKey.length} users missing a login key`);
  console.log(`  admin role: ${newAdmins.length} to grant (${adminIds.join(', ') || 'none'}), ${existingAdmins.length} already admin`);
  newAdmins.forEach((d) => console.log(`    + ${name(d)}`));
  if (newAdmins.length + existingAdmins.length === 0) {
    console.log('  WARNING: nobody will be an admin. Pass --admins <employeeId,...> with the right employee IDs.');
  }
  if (noPin.length > 0) {
    console.log(`  ${noPin.length} users have no PIN at all and can't log in until an admin resets their PIN:`);
    noPin.slice(0, 20).forEach((d) => console.log(`    - ${name(d)}`));
  }

  if (!apply) {
    console.log('\nPreview only. Run again with --apply to make these changes.');
    return;
  }

  let migrated = 0;
  await inBatches(withPlainPin, 8, async (doc) => {
    if (await migrateLegacyPin(db, doc)) migrated++;
  });

  // Login keys for users that had no plain PIN (migrateLegacyPin set the rest).
  const keysSet = await backfillLoginKeys(db);

  await inBatches(newAdmins, 50, async (doc) => {
    await doc.ref.update({ role: 'admin' });
  });

  const remaining = (await db.collection(USERS).get()).docs.filter((d) => d.data().pin !== undefined);
  console.log(`\nDone: hashed ${migrated} PINs, set ${keysSet} more login keys, granted admin to ${newAdmins.length}.`);
  console.log(remaining.length === 0 ? 'No plain-text PINs remain on user docs.' : `WARNING: ${remaining.length} user docs still have a pin field.`);
  console.log('Admins must log out and back in to pick up the admin role.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Migration failed:', e?.message || e);
    process.exit(1);
  });
