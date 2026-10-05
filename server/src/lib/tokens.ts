import { createHash, randomBytes } from 'node:crypto';

/** Prefixes make tokens recognisable in bug reports and secret scanners. */
export const TOKEN_PREFIXES = {
  /** Bearer session token. */
  session: 'lp_',
  /** Password-reset link token (30 minutes). */
  passwordReset: 'lpr_',
  /** One-time code returned by the GitHub sign-in redirect (2 minutes). */
  oauth: 'lpo_',
} as const;

/** `prefix` + 32 random bytes as base64url (43 characters). */
export function randomToken(prefix: string): string {
  return prefix + randomBytes(32).toString('base64url');
}

/** Hex SHA-256 of a UTF-8 string. Tokens are stored only as this hash. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
