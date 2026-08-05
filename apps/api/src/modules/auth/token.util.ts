import { createHash, randomBytes } from 'node:crypto';

/**
 * Generates a high-entropy raw token (refresh tokens, invitation links,
 * email verification, password reset) — the value actually sent to the
 * client/embedded in a link. Never stored raw; see {@link hashToken}.
 * @returns a 64-character hex string (32 random bytes)
 */
export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hashes a raw token for storage/lookup. SHA-256 (not argon2) is
 * deliberate: these are already-high-entropy random values, not
 * user-chosen passwords, so a fast hash is the right tool — the security
 * property needed is "not stored in plaintext," not "resistant to
 * brute-force guessing of a low-entropy secret."
 * @param raw the raw token value
 * @returns the hex-encoded SHA-256 digest
 */
export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
