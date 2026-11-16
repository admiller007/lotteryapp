import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { errorResponse, HttpError, readJson, requireAdmin } from '@/lib/server/requestAuth';
import { isValidPin } from '@/lib/server/pin';
import { createUsers, USER_STATUSES, type NewUser, type UserStatus } from '@/lib/server/users';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// The admin page sends large CSV imports in chunks of this size.
const MAX_USERS_PER_REQUEST = 200;

const text = (value: unknown, field: string, row: number) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 100) {
    throw new HttpError(400, `Row ${row}: ${field} is required.`);
  }
  return value.trim();
};

function parseUser(raw: unknown, row: number): NewUser {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, `Row ${row}: invalid user.`);
  const input = raw as Record<string, unknown>;
  const tickets = typeof input.tickets === 'string' ? Number(input.tickets) : input.tickets;
  if (typeof tickets !== 'number' || !Number.isInteger(tickets) || tickets < 0) {
    throw new HttpError(400, `Row ${row}: tickets must be a whole number of zero or more.`);
  }
  if (!isValidPin(input.pin)) throw new HttpError(400, `Row ${row}: PIN is required.`);
  const status = input.status === undefined ? 'inactive' : input.status;
  if (!USER_STATUSES.includes(status as UserStatus)) throw new HttpError(400, `Row ${row}: invalid status.`);
  const employeeId = typeof input.employeeId === 'string' && input.employeeId.trim() ? input.employeeId.trim() : undefined;
  return {
    firstName: text(input.firstName, 'first name', row),
    lastName: text(input.lastName, 'last name', row),
    facilityName: text(input.facilityName, 'facility', row),
    employeeId,
    tickets,
    pin: (input.pin as string).trim(),
    status: status as UserStatus,
  };
}

/** Creates users. PINs are hashed into userSecrets and never stored on the user doc. */
export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const body = await readJson(request);
    if (!Array.isArray(body.users) || body.users.length === 0) throw new HttpError(400, 'No users to create.');
    if (body.users.length > MAX_USERS_PER_REQUEST) {
      throw new HttpError(400, `Send at most ${MAX_USERS_PER_REQUEST} users per request.`);
    }
    const users = body.users.map((raw, i) => parseUser(raw, i + 1));
    const ids = await createUsers(getAdminDb(), users);
    return NextResponse.json({ ids });
  } catch (error) {
    return errorResponse(error, 'Creating users failed');
  }
}
