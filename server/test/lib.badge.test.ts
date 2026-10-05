import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BADGE, CONNECT_TICKET, badgeSlotAt, badgeTokenExpiresAt, createBadgeToken, createConnectTicket } from '@loopin/shared';
import { users, type UserRow } from '../src/db/schema';
import { deriveBadgeKey, mintConnectTicket, resolveBadgeCode, resolveBadgeToken, ticketKey } from '../src/lib/badge';
import { HttpError } from '../src/lib/errors';
import { createTestContext, createUser, mintBadgeToken, type TestContext } from './helpers';

let t: TestContext;
let ada: UserRow;

beforeAll(async () => {
  t = await createTestContext();
  ada = await createUser(t.db, { handle: 'ada_lovelace', name: 'Ada Lovelace', email: 'ada@example.com' });
});
afterAll(() => t.close());

/** Resolve and return the thrown HttpError (fails the test if it resolves). */
async function rejection(raw: string, nowMs?: number, resolve = resolveBadgeCode): Promise<HttpError> {
  try {
    await resolve(t.db, t.env, raw, nowMs);
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    const httpError = error as HttpError;
    // Never reveal whose code it was.
    for (const secret of [ada.handle, ada.name, ada.email, ada.badgeId, ada.id]) expect(httpError.message).not.toContain(secret);
    return httpError;
  }
  throw new Error('expected resolveBadgeCode to throw');
}

/**
 * Corrupt a character inside the MAC. Not the final character: in base64url the last character of
 * these encodings carries padding bits, so changing it can decode to identical bytes (a still-valid code).
 */
function flipLastChar(value: string): string {
  const index = value.length - 4;
  const ch = value[index];
  return value.slice(0, index) + (ch === 'A' ? 'B' : 'A') + value.slice(index + 1);
}

describe('deriveBadgeKey / ticketKey', () => {
  it('derives a stable 32-byte key per badge id, distinct from the ticket key', () => {
    const key = deriveBadgeKey(t.env, ada.badgeId);
    expect(key).toHaveLength(32);
    expect(deriveBadgeKey(t.env, ada.badgeId.toUpperCase())).toEqual(key);
    expect(deriveBadgeKey(t.env, randomUUID())).not.toEqual(key);
    expect(ticketKey(t.env)).toHaveLength(32);
    expect(ticketKey(t.env)).not.toEqual(key);
  });
});

describe('resolveBadgeCode with badge tokens', () => {
  it('accepts a fresh token, bare or inside a Loopin link', async () => {
    const token = await mintBadgeToken(t, ada);
    const resolved = await resolveBadgeCode(t.db, t.env, token);
    expect(resolved.user.id).toBe(ada.id);
    expect(resolved.via).toBe('token');
    expect(resolved.expiresAt.getTime()).toBe(badgeTokenExpiresAt(badgeSlotAt(Date.now())));
    expect((await resolveBadgeCode(t.db, t.env, `  https://loopin.example/c/${token}?ref=qr  `)).user.id).toBe(ada.id);
  });

  it('accepts the configured window of past and future slots only', async () => {
    const now = Date.now();
    const slot = badgeSlotAt(now);
    const key = deriveBadgeKey(t.env, ada.badgeId);
    for (const offset of [-BADGE.pastSlots, BADGE.futureSlots]) {
      expect((await resolveBadgeCode(t.db, t.env, await createBadgeToken(key, ada.badgeId, slot + offset), now)).user.id).toBe(ada.id);
    }
    expect((await rejection(await createBadgeToken(key, ada.badgeId, slot - BADGE.pastSlots - 1), now)).code).toBe('badge_expired');
    expect((await rejection(await createBadgeToken(key, ada.badgeId, slot + BADGE.futureSlots + 1), now)).code).toBe('badge_expired');
  });

  it('reports forged tokens as invalid even when they are also stale (MAC before freshness)', async () => {
    const token = await mintBadgeToken(t, ada);
    expect((await rejection(flipLastChar(token))).code).toBe('badge_invalid');
    const wrongKey = new Uint8Array(32).fill(9);
    expect((await rejection(await createBadgeToken(wrongKey, ada.badgeId, badgeSlotAt(Date.now())))).code).toBe('badge_invalid');
    expect((await rejection(await createBadgeToken(wrongKey, ada.badgeId, badgeSlotAt(Date.now()) - 50))).code).toBe('badge_invalid');
  });

  it('rejects unknown badge ids and anything that is not a Loopin code', async () => {
    const stranger = randomUUID();
    expect((await rejection(await createBadgeToken(deriveBadgeKey(t.env, stranger), stranger, badgeSlotAt(Date.now())))).code).toBe('badge_invalid');
    for (const junk of ['', 'hello', 'https://example.com/c/short', 'x'.repeat(42)]) expect((await rejection(junk)).code).toBe('badge_invalid');
  });

  it('stops accepting tokens and tickets once the badge id is rotated', async () => {
    const user = await createUser(t.db);
    const token = await mintBadgeToken(t, user);
    const ticket = await mintConnectTicket(t.env, user.badgeId);
    await t.db.update(users).set({ badgeId: randomUUID() }).where(eq(users.id, user.id));
    expect((await rejection(token)).code).toBe('badge_invalid');
    expect((await rejection(ticket)).code).toBe('badge_invalid');
  });
});

describe('resolveBadgeCode with connect tickets', () => {
  it('accepts a valid ticket for its lifetime', async () => {
    const now = Date.now();
    const ticket = await mintConnectTicket(t.env, ada.badgeId, now);
    expect(ticket.startsWith(CONNECT_TICKET.prefix)).toBe(true);
    const resolved = await resolveBadgeCode(t.db, t.env, ticket, now);
    expect(resolved).toMatchObject({ via: 'ticket' });
    expect(resolved.user.id).toBe(ada.id);
    expect(resolved.expiresAt.getTime()).toBe((Math.floor(now / 1000) + CONNECT_TICKET.ttlSeconds) * 1000);
    expect((await resolveBadgeCode(t.db, t.env, ticket, now + (CONNECT_TICKET.ttlSeconds - 5) * 1000)).user.id).toBe(ada.id);
  });

  it('rejects expired tickets as expired', async () => {
    const issuedAt = Date.now() - (CONNECT_TICKET.ttlSeconds + 60) * 1000;
    expect((await rejection(await mintConnectTicket(t.env, ada.badgeId, issuedAt))).code).toBe('badge_expired');
  });

  it('rejects tampered tickets and tickets signed with another secret as invalid', async () => {
    const ticket = await mintConnectTicket(t.env, ada.badgeId);
    expect((await rejection(flipLastChar(ticket))).code).toBe('badge_invalid');
    const foreign = await createConnectTicket(new Uint8Array(32).fill(3), ada.badgeId, Math.floor(Date.now() / 1000) + 600);
    expect((await rejection(foreign)).code).toBe('badge_invalid');
    expect((await rejection(`${CONNECT_TICKET.prefix}garbage`)).code).toBe('badge_invalid');
  });

  it('rejects tickets for unknown badge ids', async () => {
    expect((await rejection(await mintConnectTicket(t.env, randomUUID()))).code).toBe('badge_invalid');
  });
});

describe('resolveBadgeToken (preview and check-in: rotating codes only)', () => {
  it('accepts fresh tokens, bare or inside a link, exactly like resolveBadgeCode', async () => {
    const token = await mintBadgeToken(t, ada);
    expect(await resolveBadgeToken(t.db, t.env, token)).toMatchObject({ via: 'token', user: { id: ada.id } });
    expect((await resolveBadgeToken(t.db, t.env, `https://loopin.example/c/${token}`)).user.id).toBe(ada.id);
    expect((await rejection(await mintBadgeToken(t, ada, -BADGE.pastSlots - 1), undefined, resolveBadgeToken)).code).toBe('badge_expired');
    expect((await rejection(flipLastChar(token), undefined, resolveBadgeToken)).code).toBe('badge_invalid');
  });

  it('answers badge_invalid for every connect ticket, valid or expired', async () => {
    const valid = await mintConnectTicket(t.env, ada.badgeId);
    const expired = await mintConnectTicket(t.env, ada.badgeId, Date.now() - (CONNECT_TICKET.ttlSeconds + 60) * 1000);
    for (const ticket of [valid, ` ${valid} `, expired]) {
      expect((await rejection(ticket, undefined, resolveBadgeToken)).code).toBe('badge_invalid');
    }
  });
});
