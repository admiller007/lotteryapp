import { NextResponse } from 'next/server';
import { getAdminAuth } from './firebaseAdmin';
import { HttpError } from './httpError';

export { HttpError };

export interface Caller {
  uid: string;
  isAdmin: boolean;
}

// Verifies the Firebase ID token sent as "Authorization: Bearer <token>".
// The admin flag comes from the token's custom claim, which only the login
// route can set, so the browser can't promote itself.
export async function requireUser(request: Request): Promise<Caller> {
  const match = (request.headers.get('authorization') || '').match(/^Bearer (.+)$/);
  if (!match) throw new HttpError(401, 'Please log in.');
  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1]);
    return { uid: decoded.uid, isAdmin: decoded.admin === true };
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }
}

export async function requireAdmin(request: Request): Promise<Caller> {
  const caller = await requireUser(request);
  if (!caller.isAdmin) throw new HttpError(403, 'Admin access required.');
  return caller;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError(400, 'Invalid request body.');
}

export function errorResponse(error: unknown, context: string) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(`${context}:`, error);
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}
