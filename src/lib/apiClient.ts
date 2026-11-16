// Browser helpers for the server API routes. Each request carries the signed-in
// user's Firebase ID token, which the server verifies.

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const { auth } = await import('@/lib/firebase');
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, 'Please log in again.');
  const token = await user.getIdToken();

  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, data.error || 'Request failed. Please try again.');
  }
  return data as T;
}

export const allocateTicketsApi = (input: { prizeId: string; tickets: number; userId?: string }) =>
  request<{ allocatedTickets: Record<string, number>; totalTicketsInPrize: number }>('/api/allocations', 'POST', input);

export interface NewUserInput {
  firstName: string;
  lastName: string;
  facilityName: string;
  tickets: number;
  pin: string;
  employeeId?: string;
  status?: 'inactive' | 'working' | 'at_party';
}

// Large CSV imports are sent in chunks so each request stays quick.
export async function createUsersApi(users: NewUserInput[], chunkSize = 100): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < users.length; i += chunkSize) {
    const result = await request<{ ids: string[] }>('/api/admin/users', 'POST', { users: users.slice(i, i + chunkSize) });
    ids.push(...result.ids);
  }
  return ids;
}

export const resetUserPinApi = (userId: string, pin: string) =>
  request<{ ok: true }>(`/api/admin/users/${encodeURIComponent(userId)}`, 'PATCH', { pin });

export const deleteUserApi = (userId: string) =>
  request<{ ok: true }>(`/api/admin/users/${encodeURIComponent(userId)}`, 'DELETE');
