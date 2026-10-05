/**
 * Bearer sessions: `lp_<base64url 32 bytes>` tokens stored as sha256 hex. Expiry slides (SESSION_TTL_DAYS,
 * renewed when less than 7 days remain) up to an absolute cap of 90 days after creation.
 */
import { and, isNotNull, lt, or, sql } from 'drizzle-orm';
import type { Executor } from '../context';
import { oneTimeTokens, sessions, type SessionRow } from '../db/schema';
import { DAY_MS, MINUTE_MS } from '../lib/time';
import { TOKEN_PREFIXES, randomToken, sha256Hex } from '../lib/tokens';

export const SESSION_POLICY = {
  /** Renew the sliding expiry once fewer than this many ms remain. */
  renewWhenRemainingMs: 7 * DAY_MS,
  /** No session outlives created_at + 90 days, however active. */
  absoluteMaxAgeMs: 90 * DAY_MS,
  /** last_used_at is written at most this often. */
  touchIntervalMs: 10 * MINUTE_MS,
  /** Stored User-Agent length cap. */
  userAgentMaxLength: 512,
} as const;

/** How long consumed/expired one-time tokens are kept: the forgot-password throttle counts a day of them. */
const ONE_TIME_TOKEN_RETENTION_MS = DAY_MS;

export interface CreatedSession {
  /** The raw bearer token — return it to the client once; it is never stored. */
  token: string;
  session: SessionRow;
}

export async function createSession(
  ex: Executor,
  input: { userId: string; userAgent?: string | null; ttlDays: number },
  nowMs: number = Date.now(),
): Promise<CreatedSession> {
  const token = randomToken(TOKEN_PREFIXES.session);
  const now = new Date(nowMs);
  const [session] = await ex
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash: sha256Hex(token),
      userAgent: input.userAgent ? input.userAgent.slice(0, SESSION_POLICY.userAgentMaxLength) : null,
      createdAt: now,
      lastUsedAt: now,
      expiresAt: new Date(nowMs + Math.min(input.ttlDays * DAY_MS, SESSION_POLICY.absoluteMaxAgeMs)),
    })
    .returning();
  if (!session) throw new Error('Session insert returned no row');
  return { token, session };
}

/**
 * What to write back for a session that was just used: a renewed expiry when it is close to expiring (capped at
 * created_at + 90 days) and/or a fresh last_used_at when the old one is older than 10 minutes. Null = nothing.
 * A renewal must gain at least the touch interval: with SESSION_TTL_DAYS ≤ 7 fewer than 7 days always remain,
 * and every request would otherwise rewrite the row to extend the session by a few seconds.
 */
export function sessionRefresh(
  session: Pick<SessionRow, 'createdAt' | 'lastUsedAt' | 'expiresAt'>,
  nowMs: number,
  ttlDays: number,
): { lastUsedAt: Date; expiresAt: Date } | null {
  const expiresMs = session.expiresAt.getTime();
  const renewedMs = Math.min(nowMs + ttlDays * DAY_MS, session.createdAt.getTime() + SESSION_POLICY.absoluteMaxAgeMs);
  const renew =
    expiresMs - nowMs < SESSION_POLICY.renewWhenRemainingMs && renewedMs - expiresMs >= SESSION_POLICY.touchIntervalMs;
  const touch = nowMs - session.lastUsedAt.getTime() >= SESSION_POLICY.touchIntervalMs;
  if (!renew && !touch) return null;
  return { lastUsedAt: new Date(nowMs), expiresAt: renew ? new Date(renewedMs) : session.expiresAt };
}

/**
 * Retention job (boot + every 6 h): delete expired sessions, and one-time tokens that are used or expired and
 * older than a day (younger ones still count towards the forgot-password throttle).
 */
export async function purgeExpiredAuthRecords(ex: Executor): Promise<{ sessions: number; oneTimeTokens: number }> {
  const removedSessions = await ex
    .delete(sessions)
    .where(lt(sessions.expiresAt, sql`now()`))
    .returning({ id: sessions.id });
  const removedTokens = await ex
    .delete(oneTimeTokens)
    .where(
      and(
        or(isNotNull(oneTimeTokens.usedAt), lt(oneTimeTokens.expiresAt, sql`now()`)),
        lt(oneTimeTokens.createdAt, new Date(Date.now() - ONE_TIME_TOKEN_RETENTION_MS)),
      ),
    )
    .returning({ id: oneTimeTokens.id });
  return { sessions: removedSessions.length, oneTimeTokens: removedTokens.length };
}
