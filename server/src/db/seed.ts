/**
 * Demo data (SPEC §3.8). Interim no-op: the events agent replaces the body of seedDemo with the real seed,
 * keeping this signature (index.ts and scripts/seed.ts already call it).
 *
 * Contract for the implementation:
 *  - Runs everything in one transaction (`ex.transaction(async (tx) => …)`) and uses only `tx` inside it.
 *  - Checks inside that transaction that the users table is empty; if not, returns `{ seeded: false }`.
 *  - Callers have already checked seedAllowed(env); outside development every demo account is a `member` and
 *    the password is env.DEMO_PASSWORD.
 *  - Returns the created accounts (never passwords); callers log them in development only.
 */
import type { Executor, Logger } from '../context';
import type { Env } from '../env';
import type { Signer } from '../lib/signing';

export interface SeedContext {
  env: Env;
  /** Signs the back-dated stamps and awards. */
  signer: Signer;
  logger: Logger;
}

export interface SeedResult {
  seeded: boolean;
  accounts?: { email: string; role: string }[];
}

export async function seedDemo(_ex: Executor, _ctx: SeedContext): Promise<SeedResult> {
  return { seeded: false };
}
