import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { HttpError } from './httpError';
import { USERS } from './users';

const LOTTERY_ID = 'default';
export const MAX_TICKETS = 1_000_000;

export interface AllocationResult {
  entries: Array<{ userId: string; numTickets: number }>;
  totalTicketsInPrize: number;
  allocatedTickets: Record<string, number>;
}

/**
 * Sets how many tickets a user puts on one prize (0 removes them), in a
 * Firestore transaction: checks the admin's "allocation closed" switch and the
 * user's ticket limit, then updates the prize's entries. Two people allocating
 * to the same prize at once can't overwrite each other: Firestore retries the
 * transaction instead.
 */
export async function setAllocation(
  db: Firestore,
  { userId, prizeId, tickets }: { userId: string; prizeId: string; tickets: number }
): Promise<AllocationResult> {
  const prizeRef = db.collection('prizes').doc(prizeId);
  const userRef = db.collection(USERS).doc(userId);
  const settingsRef = db.collection('settings').doc('lottery');
  const allocationRef = db.collection('allocations').doc(`${LOTTERY_ID}_${prizeId}_${userId}`);
  const userAllocationsQuery = db.collection('allocations').where('userId', '==', userId);

  return db.runTransaction(async (tx) => {
    const [settings, userSnap, prizeSnap, allocations] = await Promise.all([
      tx.get(settingsRef),
      tx.get(userRef),
      tx.get(prizeRef),
      tx.get(userAllocationsQuery),
    ]);

    if (settings.exists && settings.data()?.allocationsOpen === false) {
      throw new HttpError(409, 'Ticket allocation is closed.');
    }
    if (!userSnap.exists) throw new HttpError(404, 'User not found.');
    if (!prizeSnap.exists) throw new HttpError(404, 'Prize not found.');

    // Tickets already on other prizes. Older allocation docs used random IDs,
    // so a prize can have more than one doc; count each prize once.
    const otherPrizes = new Map<string, number>();
    const stalePrizeDocs: DocumentReference[] = [];
    allocations.docs.forEach((doc) => {
      const data = doc.data();
      if (data.prizeId === prizeId) {
        if (doc.id !== allocationRef.id) stalePrizeDocs.push(doc.ref);
        return;
      }
      if (data.lotteryId && data.lotteryId !== LOTTERY_ID) return;
      otherPrizes.set(data.prizeId, Number(data.tickets) || 0);
    });
    const usedElsewhere = [...otherPrizes.values()].reduce((sum, n) => sum + n, 0);
    const userData = userSnap.data()!;
    const ticketLimit = Number(userData.tickets) || 0;
    if (usedElsewhere + tickets > ticketLimit) {
      throw new HttpError(
        400,
        `You don't have enough tickets. You have ${Math.max(0, ticketLimit - usedElsewhere)} left for this prize.`
      );
    }

    const entries: AllocationResult['entries'] = (prizeSnap.data()!.entries || []).filter(
      (entry: { userId: string }) => entry.userId !== userId
    );
    if (tickets > 0) entries.push({ userId, numTickets: tickets });
    const totalTicketsInPrize = entries.reduce((sum, entry) => sum + entry.numTickets, 0);

    stalePrizeDocs.forEach((ref) => tx.delete(ref));
    if (tickets > 0) {
      tx.set(allocationRef, {
        lotteryId: LOTTERY_ID,
        prizeId,
        userId,
        userName: `${userData.firstName ?? ''} ${userData.lastName ?? ''}`.trim(),
        tickets,
        timestamp: new Date().toISOString(),
      });
    } else {
      tx.delete(allocationRef);
    }
    tx.update(prizeRef, { entries, totalTicketsInPrize });

    const allocatedTickets: Record<string, number> = Object.fromEntries(otherPrizes);
    if (tickets > 0) allocatedTickets[prizeId] = tickets;
    return { entries, totalTicketsInPrize, allocatedTickets };
  });
}
