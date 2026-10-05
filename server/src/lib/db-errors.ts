/**
 * PostgreSQL error helpers. drizzle wraps driver errors in DrizzleQueryError whose `message` contains the SQL
 * and its parameters — never log or return it. The Postgres code/constraint live on `err.cause`.
 */

export interface PgErrorInfo {
  code: string;
  constraint?: string;
  table?: string;
}

export const PG_ERROR = {
  uniqueViolation: '23505',
  foreignKeyViolation: '23503',
  /** ON DELETE RESTRICT violated (PostgreSQL 18+; older versions report 23503). */
  restrictViolation: '23001',
  checkViolation: '23514',
  invalidTextRepresentation: '22P02',
  serializationFailure: '40001',
  deadlockDetected: '40P01',
} as const;

/** Unique constraint → request field it belongs to (null: no field, e.g. a duplicate connection row). */
export const CONSTRAINT_FIELDS: Readonly<Record<string, string | null>> = {
  users_email_unique: 'email',
  users_handle_unique: 'handle',
  events_slug_unique: 'slug',
  vouches_pair_skill_uq: 'skill',
  credentials_live_award_uq: 'placement',
  connections_owner_peer_uq: null,
};

/**
 * Five-character SQLSTATE. No PostgreSQL error class starts with "E", which keeps out Node/library error codes
 * that happen to be five characters long (EPIPE, EPERM, EBUSY, nodemailer's EAUTH, …): treating those as
 * Postgres errors would drop their message from the logs.
 */
const SQLSTATE = /^[0-9A-DF-Z][0-9A-Z]{4}$/;

/** The Postgres error behind `err` (drizzle-wrapped or raw), or null when it isn't one. */
export function pgError(err: unknown): PgErrorInfo | null {
  const candidate = typeof err === 'object' && err !== null && 'cause' in err && err.cause ? err.cause : err;
  if (typeof candidate !== 'object' || candidate === null) return null;
  const { code, constraint, table } = candidate as { code?: unknown; constraint?: unknown; table?: unknown };
  if (typeof code !== 'string' || !SQLSTATE.test(code)) return null;
  return {
    code,
    ...(typeof constraint === 'string' ? { constraint } : {}),
    ...(typeof table === 'string' ? { table } : {}),
  };
}

/** True for a unique violation, optionally of one specific constraint. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const pg = pgError(err);
  return pg?.code === PG_ERROR.uniqueViolation && (constraint === undefined || pg.constraint === constraint);
}

/** Deadlock or serialization failure: the transaction can safely be retried. */
export function isRetryableTransactionError(err: unknown): boolean {
  const code = pgError(err)?.code;
  return code === PG_ERROR.deadlockDetected || code === PG_ERROR.serializationFailure;
}

/**
 * Run `fn` (typically `() => db.transaction(...)`) and retry it when it fails with a deadlock or serialization
 * failure. When the retries are exhausted the error propagates and the error middleware answers
 * 503 unavailable "Please try again".
 */
export async function retryOnTransactionConflict<T>(fn: () => Promise<T>, retries = 1): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isRetryableTransactionError(error)) throw error;
    }
  }
}
