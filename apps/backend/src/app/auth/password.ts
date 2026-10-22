import { compare, hash } from 'bcryptjs';
import { createHmac } from 'node:crypto';

/** bcrypt cost factor: ~250 ms per hash, slow enough to resist brute force. */
const BCRYPT_COST = 12;

/**
 * Salt + pepper (OWASP Password Storage):
 * - the **pepper** is a server-side secret (PASSWORD_PEPPER, never stored in the database), applied as
 *   HMAC-SHA256(pepper, password). A stolen database alone can't be brute-forced.
 * - bcrypt adds a random **salt** per hash and the slow work factor.
 * The HMAC is base64-encoded (44 ASCII characters, no NUL bytes), which also lifts bcrypt's 72-byte
 * input limit: long passwords count in full.
 */
function applyPepper(password: string, pepper: string): string {
  return createHmac('sha256', pepper).update(password, 'utf8').digest('base64');
}

export function hashPassword(password: string, pepper: string): Promise<string> {
  return hash(applyPepper(password, pepper), BCRYPT_COST);
}

/** Constant-time comparison; false (never an exception) for a wrong password, pepper or a malformed hash. */
export async function verifyPassword(
  password: string,
  passwordHash: string,
  pepper: string,
): Promise<boolean> {
  try {
    return await compare(applyPepper(password, pepper), passwordHash);
  } catch {
    return false;
  }
}
