import { randomBytes, scrypt, timingSafeEqual } from 'crypto';

// PINs are stored as salted scrypt hashes in the server-only userSecrets
// collection: "scrypt$N$r$p$<salt b64>$<hash b64>".
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;

const normalizePin = (pin: string) => pin.trim();

const derive = (pin: string, salt: Buffer, n: number, r: number, p: number, keyLength: number) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(normalizePin(pin), salt, keyLength, { N: n, r, p }, (err, key) => (err ? reject(err) : resolve(key)));
  });

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(pin, salt, N, R, P, KEY_LENGTH);
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await derive(pin, Buffer.from(saltB64, 'base64'), Number(n), Number(r), Number(p), expected.length);
  return timingSafeEqual(actual, expected);
}

// Constant-time comparison for PINs still stored in plain text (pre-migration).
export function legacyPinMatches(pin: string, storedPlain: string): boolean {
  const a = Buffer.from(normalizePin(pin));
  const b = Buffer.from(normalizePin(storedPlain));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && pin.trim().length >= 1 && pin.trim().length <= 64;
}
