import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { oneTimeTokens, sessions } from '../src/db/schema';
import { DAY_MS, HOUR_MS, MINUTE_MS } from '../src/lib/time';
import { sha256Hex } from '../src/lib/tokens';
import { SESSION_POLICY, createSession, purgeExpiredAuthRecords, sessionRefresh } from '../src/services/sessions';
import { createTestContext, createUser, type TestContext } from './helpers';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
afterAll(() => t.close());

describe('createSession', () => {
  it('stores only the token hash and expires after the TTL', async () => {
    const user = await createUser(t.db);
    const now = Date.now();
    const { token, session } = await createSession(t.db, { userId: user.id, userAgent: 'x'.repeat(600), ttlDays: 30 }, now);
    expect(token).toMatch(/^lp_[A-Za-z0-9_-]{43}$/);
    expect(session.tokenHash).toBe(sha256Hex(token));
    expect(session.userAgent).toHaveLength(SESSION_POLICY.userAgentMaxLength);
    expect(session.expiresAt.getTime()).toBe(now + 30 * DAY_MS);
    const [stored] = await t.db.select().from(sessions).where(eq(sessions.id, session.id));
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  it('caps the lifetime at 90 days', async () => {
    const user = await createUser(t.db);
    const now = Date.now();
    const { session } = await createSession(t.db, { userId: user.id, ttlDays: 365 }, now);
    expect(session.expiresAt.getTime()).toBe(now + 90 * DAY_MS);
  });
});

describe('sessionRefresh', () => {
  const now = Date.UTC(2026, 9, 5, 12);
  const base = { createdAt: new Date(now - DAY_MS), lastUsedAt: new Date(now - MINUTE_MS), expiresAt: new Date(now + 29 * DAY_MS) };

  it('does nothing for a recently used session far from expiry', () => {
    expect(sessionRefresh(base, now, 30)).toBeNull();
  });

  it('touches last_used_at after 10 minutes', () => {
    expect(sessionRefresh({ ...base, lastUsedAt: new Date(now - 10 * MINUTE_MS) }, now, 30)).toEqual({ lastUsedAt: new Date(now), expiresAt: base.expiresAt });
  });

  it('renews to now + TTL when fewer than 7 days remain, capped at created + 90 days', () => {
    expect(sessionRefresh({ ...base, expiresAt: new Date(now + 6 * DAY_MS) }, now, 30)?.expiresAt).toEqual(new Date(now + 30 * DAY_MS));
    const old = { ...base, createdAt: new Date(now - 80 * DAY_MS), expiresAt: new Date(now + 3 * DAY_MS) };
    expect(sessionRefresh(old, now, 30)?.expiresAt).toEqual(new Date(now + 10 * DAY_MS));
    const atCap = { ...base, createdAt: new Date(now - 88 * DAY_MS), expiresAt: new Date(now + 2 * DAY_MS) };
    expect(sessionRefresh(atCap, now, 30)).toBeNull();
  });

  it('with a TTL of 7 days or less, renews at most every 10 minutes instead of on every request', () => {
    // Renewed (to now + 1 day) a minute ago: fewer than 7 days remain, but renewing again would gain one minute.
    const justRenewed = { ...base, lastUsedAt: new Date(now - MINUTE_MS), expiresAt: new Date(now + DAY_MS - MINUTE_MS) };
    expect(sessionRefresh(justRenewed, now, 1)).toBeNull();
    const later = now + 10 * MINUTE_MS;
    expect(sessionRefresh(justRenewed, later, 1)).toEqual({ lastUsedAt: new Date(later), expiresAt: new Date(later + DAY_MS) });
  });
});

describe('purgeExpiredAuthRecords', () => {
  it('removes expired sessions and stale one-time tokens but keeps a day of history for throttling', async () => {
    const user = await createUser(t.db);
    const live = await createSession(t.db, { userId: user.id, ttlDays: 30 });
    const dead = await createSession(t.db, { userId: user.id, ttlDays: 30 });
    await t.db.update(sessions).set({ expiresAt: new Date(Date.now() - HOUR_MS) }).where(eq(sessions.id, dead.session.id));

    const now = Date.now();
    const token = (name: string, values: Partial<typeof oneTimeTokens.$inferInsert>) => ({
      userId: user.id,
      purpose: 'password_reset' as const,
      tokenHash: sha256Hex(name),
      expiresAt: new Date(now + 30 * MINUTE_MS),
      ...values,
    });
    await t.db.insert(oneTimeTokens).values([
      token('fresh', {}),
      token('used-recently', { usedAt: new Date(now - MINUTE_MS), createdAt: new Date(now - 5 * MINUTE_MS) }),
      token('expired-recently', { createdAt: new Date(now - 2 * HOUR_MS), expiresAt: new Date(now - HOUR_MS) }),
      token('used-long-ago', { usedAt: new Date(now - 2 * DAY_MS), createdAt: new Date(now - 2 * DAY_MS) }),
      token('expired-long-ago', { createdAt: new Date(now - 3 * DAY_MS), expiresAt: new Date(now - 3 * DAY_MS + 30 * MINUTE_MS) }),
    ]);

    expect(await purgeExpiredAuthRecords(t.db)).toEqual({ sessions: 1, oneTimeTokens: 2 });
    const remainingSessions = await t.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, user.id));
    expect(remainingSessions.map((s) => s.id)).toEqual([live.session.id]);
    const remainingTokens = await t.db.select({ hash: oneTimeTokens.tokenHash }).from(oneTimeTokens).where(eq(oneTimeTokens.userId, user.id));
    expect(remainingTokens.map((r) => r.hash).sort()).toEqual([sha256Hex('expired-recently'), sha256Hex('fresh'), sha256Hex('used-recently')].sort());
  });
});
