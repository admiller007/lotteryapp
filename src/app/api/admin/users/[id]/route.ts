import { NextResponse } from 'next/server';
import { FieldValue, type WriteBatch } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebaseAdmin';
import { errorResponse, HttpError, readJson, requireAdmin } from '@/lib/server/requestAuth';
import { hashPin, isValidPin } from '@/lib/server/pin';
import { USER_SECRETS, USERS } from '@/lib/server/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

async function existingUserRef(params: Params['params']) {
  const { id } = await params;
  const ref = getAdminDb().collection(USERS).doc(id);
  if (!(await ref.get()).exists) throw new HttpError(404, 'User not found.');
  return ref;
}

/** Sets a new PIN for a user and clears any lockout. Body: { pin }. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    await requireAdmin(request);
    const body = await readJson(request);
    if (!isValidPin(body.pin)) throw new HttpError(400, 'Please enter a PIN.');
    const userRef = await existingUserRef(params);

    const pinHash = await hashPin(body.pin);
    const db = getAdminDb();
    const batch = db.batch();
    batch.set(db.collection(USER_SECRETS).doc(userRef.id), { pinHash, failedAttempts: 0, lockedUntil: null }, { merge: true });
    // Drop any plain-text PIN left from before the migration.
    batch.update(userRef, { pin: FieldValue.delete() });
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'PIN reset failed');
  }
}

/**
 * Deletes a user with their PIN, allocations, prize entries and winner
 * records, and ends their login session.
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    await requireAdmin(request);
    const userRef = await existingUserRef(params);
    const userId = userRef.id;
    const db = getAdminDb();

    const [allocations, prizes, winners] = await Promise.all([
      db.collection('allocations').where('userId', '==', userId).get(),
      db.collection('prizes').get(),
      db.collection('winners').where('winnerId', '==', userId).get(),
    ]);

    const writes: Array<(batch: WriteBatch) => void> = [
      (b) => b.delete(userRef),
      (b) => b.delete(db.collection(USER_SECRETS).doc(userId)),
      ...allocations.docs.map((d) => (b: WriteBatch) => b.delete(d.ref)),
      ...winners.docs.map((d) => (b: WriteBatch) => b.delete(d.ref)),
    ];
    prizes.docs.forEach((prize) => {
      const entries: Array<{ userId: string; numTickets: number }> = prize.data().entries || [];
      if (!entries.some((e) => e.userId === userId)) return;
      const kept = entries.filter((e) => e.userId !== userId);
      writes.push((b) => b.update(prize.ref, {
        entries: kept,
        totalTicketsInPrize: kept.reduce((sum, e) => sum + e.numTickets, 0),
      }));
    });

    for (let i = 0; i < writes.length; i += 450) {
      const batch = db.batch();
      writes.slice(i, i + 450).forEach((write) => write(batch));
      await batch.commit();
    }

    try {
      await getAdminAuth().deleteUser(userId);
    } catch (error) {
      // No Firebase Auth record if they never logged in.
      if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, 'Deleting user failed');
  }
}
