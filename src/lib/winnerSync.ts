// Works out the smallest set of writes that makes the `winners` collection
// match the winners the admin screen holds. Kept free of Firebase imports so
// it can be unit tested.

export interface ExistingWinnerDoc {
  id: string;
  prizeId?: string;
  winnerId?: string;
}

export interface WinnerSyncPlan {
  toDelete: string[];
  toAdd: Array<{ id: string; prizeId: string; winnerId: string }>;
}

// One doc per (prize, winner), with an ID derived from the pair. Saving the
// same winner twice (a retry, a second admin tab, a reducer React runs twice)
// then overwrites the same doc instead of creating a duplicate winner.
export const winnerDocId = (prizeId: string, winnerId: string) =>
  `${encodeURIComponent(prizeId)}|${encodeURIComponent(winnerId)}`;

export function planWinnerSync(
  existing: ExistingWinnerDoc[],
  desired: Record<string, string[]>
): WinnerSyncPlan {
  const wanted = new Map<string, { prizeId: string; winnerId: string }>();
  Object.entries(desired).forEach(([prizeId, winnerIds]) => {
    winnerIds.forEach((winnerId) => {
      if (prizeId && winnerId) wanted.set(winnerDocId(prizeId, winnerId), { prizeId, winnerId });
    });
  });

  // Docs written before deterministic IDs have random IDs; keep one per
  // wanted pair (preferring the deterministic one) and delete everything else.
  const kept = new Map<string, string>();
  const toDelete: string[] = [];
  existing.forEach((doc) => {
    const key = doc.prizeId && doc.winnerId ? winnerDocId(doc.prizeId, doc.winnerId) : null;
    if (!key || !wanted.has(key)) {
      toDelete.push(doc.id);
      return;
    }
    const current = kept.get(key);
    if (current === undefined) {
      kept.set(key, doc.id);
    } else if (doc.id === key) {
      toDelete.push(current);
      kept.set(key, doc.id);
    } else {
      toDelete.push(doc.id);
    }
  });

  const toAdd = [...wanted.entries()]
    .filter(([key]) => !kept.has(key))
    .map(([id, pair]) => ({ id, ...pair }));

  return { toDelete, toAdd };
}
