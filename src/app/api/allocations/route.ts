import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { errorResponse, HttpError, readJson, requireUser } from '@/lib/server/requestAuth';
import { MAX_TICKETS, setAllocation } from '@/lib/server/allocations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sets how many tickets a user puts on one prize. This is the only way normal
 * users can change entries: Firestore rules block direct writes to prizes and
 * allocations, so the ticket limit can't be bypassed from the browser.
 *
 * Body: { prizeId, tickets, userId? }. Only admins may pass someone else's
 * userId (used by the admin "randomly allocate" test tool).
 */
export async function POST(request: Request) {
  try {
    const caller = await requireUser(request);
    const body = await readJson(request);

    const { prizeId, tickets } = body;
    const userId = body.userId === undefined ? caller.uid : body.userId;
    if (typeof prizeId !== 'string' || !prizeId || prizeId.includes('/')) throw new HttpError(400, 'Invalid prize.');
    if (typeof userId !== 'string' || !userId || userId.includes('/')) throw new HttpError(400, 'Invalid user.');
    if (typeof tickets !== 'number' || !Number.isInteger(tickets) || tickets < 0 || tickets > MAX_TICKETS) {
      throw new HttpError(400, 'Tickets must be a whole number of zero or more.');
    }
    if (userId !== caller.uid && !caller.isAdmin) {
      throw new HttpError(403, 'You can only allocate your own tickets.');
    }

    return NextResponse.json(await setAllocation(getAdminDb(), { userId, prizeId, tickets }));
  } catch (error) {
    return errorResponse(error, 'Allocation failed');
  }
}
