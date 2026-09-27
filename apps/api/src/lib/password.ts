/**
 * PBKDF2-SHA256 through WebCrypto, the one password hash Workers run natively. 30,000 rounds took 2.2 ms on an Apple
 * M5 (60,000 took 4.2 ms); a password change runs it twice, and the free plan allows 10 ms of CPU per request. The
 * count is stored with each hash, so it can be raised on a paid plan without breaking old passwords.
 *
 * Teachers only. A child's password is stored as the teacher reads it out (see migration 0004).
 */
export const PBKDF2_ITERATIONS = 30_000;

const enc = new TextEncoder();

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, iterations);
  return `pbkdf2-sha256$${iterations}$${b64(salt)}$${b64(hash)}`;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

function equalStrings(a: string, b: string): boolean {
  return equalBytes(enc.encode(a), enc.encode(b));
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2-sha256" || !iter || !salt || !hash) return false;
  const derived = await derive(password, unb64(salt), Number(iter));
  return equalBytes(derived, unb64(hash));
}

/**
 * A child's password, compared as it is stored. An account whose password is empty (one that had a hashed password
 * before migration 0004) can't be signed in to until the teacher gives it a new code.
 */
export function verifyStudentPassword(password: string, stored: string): boolean {
  return stored !== "" && equalStrings(password, stored);
}
