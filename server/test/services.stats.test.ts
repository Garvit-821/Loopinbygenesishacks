import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { XP_RULES, computeXp, tierProgress } from '@loopin/shared';
import { connections, users, type EventRow, type UserRow } from '../src/db/schema';
import { HttpError } from '../src/lib/errors';
import { DAY_MS, HOUR_MS } from '../src/lib/time';
import { computeActivity, computeProfileStats } from '../src/services/stats';
import { connectMutually, createCredential, createEvent, createTestContext, createUser, createVouch, xpCountsFor, type TestContext } from './helpers';

let t: TestContext;
let eventA: EventRow;
let eventB: EventRow;
let organizer: UserRow;

beforeAll(async () => {
  t = await createTestContext();
  eventA = await createEvent(t.db);
  eventB = await createEvent(t.db);
  organizer = await createUser(t.db, { role: 'organizer' });
});
afterAll(() => t.close());

const COMPLETE_PROFILE = {
  headline: 'Systems engineer',
  bio: 'I build compilers.',
  skills: [
    { name: 'Rust', level: 4 },
    { name: 'Go', level: 3 },
    { name: 'SQL', level: 3 },
  ],
  githubUsername: 'octocat',
};

/** Every user's XP via the independent oracle, then rank = 1 + users with strictly more XP. */
async function expectedRanks(): Promise<{ xpById: Map<string, number>; rank: (id: string) => number; total: number }> {
  const all = await t.db.select({ id: users.id }).from(users);
  const xpById = new Map<string, number>();
  for (const { id } of all) xpById.set(id, computeXp(await xpCountsFor(t.db, id)));
  const values = [...xpById.values()];
  return {
    xpById,
    rank: (id) => 1 + values.filter((xp) => xp > (xpById.get(id) ?? 0)).length,
    total: all.length,
  };
}

describe('computeProfileStats', () => {
  it('derives XP from mutual connections, live credentials, distinct vouchers and the profile bonus', async () => {
    const ada = await createUser(t.db, COMPLETE_PROFILE);
    // 3 mutual connections; one row only Ada owns and one only the other person owns don't count.
    for (let i = 0; i < 3; i++) await connectMutually(t.db, ada, await createUser(t.db));
    const oneWayOut = await createUser(t.db);
    await t.db.insert(connections).values({ ownerId: ada.id, peerId: oneWayOut.id, source: 'scan' });
    const oneWayIn = await createUser(t.db);
    await t.db.insert(connections).values({ ownerId: oneWayIn.id, peerId: ada.id, source: 'scan' });

    // Stamps: two roles at event A, one at event B, one revoked.
    await createCredential(t.db, t.signer, { holder: ada, event: eventA, issuer: organizer, role: 'hacker' });
    await createCredential(t.db, t.signer, { holder: ada, event: eventA, issuer: organizer, role: 'mentor' });
    await createCredential(t.db, t.signer, { holder: ada, event: eventB, issuer: organizer, role: 'hacker' });
    await createCredential(t.db, t.signer, { holder: ada, event: eventB, issuer: organizer, role: 'judge', revokedAt: new Date() });

    // Awards: first + finalist live, second revoked.
    await createCredential(t.db, t.signer, { holder: ada, event: eventA, type: 'award', placement: 'first' });
    await createCredential(t.db, t.signer, { holder: ada, event: eventB, type: 'award', placement: 'finalist', track: 'AI' });
    await createCredential(t.db, t.signer, { holder: ada, event: eventB, type: 'award', placement: 'second', revokedAt: new Date() });

    // Vouches: one person vouching for two skills counts once for XP; vouches total counts all three.
    const [voucher1, voucher2] = [await createUser(t.db), await createUser(t.db)];
    await createVouch(t.db, { voucher: voucher1, recipient: ada, skill: 'Rust' });
    await createVouch(t.db, { voucher: voucher1, recipient: ada, skill: 'Go' });
    await createVouch(t.db, { voucher: voucher2, recipient: ada, skill: 'Rust' });

    const stats = await computeProfileStats(t.db, ada.id);
    const expectedXp =
      3 * XP_RULES.connection +
      3 * XP_RULES.stamp +
      2 * XP_RULES.vouchReceived +
      XP_RULES.award.first +
      XP_RULES.award.finalist +
      XP_RULES.profileComplete;
    expect(stats).toMatchObject({ xp: expectedXp, connections: 3, stamps: 3, events: 2, awards: 2, vouches: 3 });
    expect(stats.xp).toBe(computeXp(await xpCountsFor(t.db, ada.id)));
    expect(stats).toMatchObject(tierProgress(expectedXp));
    for (const value of [stats.xp, stats.rank, stats.totalRanked, stats.connections, stats.events, stats.stamps, stats.awards, stats.vouches, stats.progress]) {
      expect(typeof value).toBe('number');
    }
  });

  it('matches computeXp() for users built to hit each rule edge', async () => {
    const cases: UserRow[] = [
      await createUser(t.db),
      // Photo via avatar + link via LinkedIn (no GitHub).
      await createUser(t.db, { ...COMPLETE_PROFILE, githubUsername: null, avatarUrl: 'https://example.com/a.png', linkedinUrl: 'https://linkedin.com/in/x' }),
      // Avatar but no link at all → incomplete.
      await createUser(t.db, { ...COMPLETE_PROFILE, githubUsername: null, avatarUrl: 'https://example.com/a.png' }),
      // Whitespace-only text (as String.prototype.trim sees it) → incomplete.
      await createUser(t.db, { ...COMPLETE_PROFILE, headline: '  　' }),
      await createUser(t.db, { ...COMPLETE_PROFILE, bio: '\t\n ﻿' }),
      // A zero-width space is not trimmed by JS, so it counts as written.
      await createUser(t.db, { ...COMPLETE_PROFILE, headline: '​' }),
      // Two skills → incomplete; empty strings are not a photo or a link.
      await createUser(t.db, { ...COMPLETE_PROFILE, skills: COMPLETE_PROFILE.skills.slice(0, 2) }),
      await createUser(t.db, { ...COMPLETE_PROFILE, githubUsername: '', avatarUrl: '', websiteUrl: 'https://ada.dev' }),
    ];
    const revokedOnly = await createUser(t.db);
    await createCredential(t.db, t.signer, { holder: revokedOnly, event: eventA, type: 'award', placement: 'first', revokedAt: new Date() });
    cases.push(revokedOnly);
    const everyPlacement = await createUser(t.db);
    for (const placement of ['first', 'second', 'third', 'finalist', 'special'] as const) {
      await createCredential(t.db, t.signer, { holder: everyPlacement, event: eventA, type: 'award', placement });
    }
    cases.push(everyPlacement);

    const xps: number[] = [];
    for (const user of cases) {
      const counts = await xpCountsFor(t.db, user.id);
      const stats = await computeProfileStats(t.db, user.id);
      expect({ handle: user.handle, xp: stats.xp }).toEqual({ handle: user.handle, xp: computeXp(counts) });
      xps.push(stats.xp);
    }
    expect(xps).toEqual([0, 50, 0, 0, 0, 50, 0, 0, 0, 500 + 350 + 250 + 150 + 200]);
  });

  it('treats exactly the characters String.prototype.trim() removes as blank', async () => {
    // The oracle is the JS runtime itself: every BMP code point that trim() strips.
    const blanks: string[] = [];
    for (let cp = 0; cp <= 0xffff; cp++) {
      const char = String.fromCharCode(cp);
      if (char.trim() === '') blanks.push(char);
    }
    expect(blanks.length).toBeGreaterThan(20);
    // Look-alikes that trim() keeps: zero-width space, Mongolian vowel separator, next line (NEL), word joiner.
    const kept = ['​', '᠎', '\u0085', '⁠'];

    const cases: { label: string; user: UserRow }[] = [];
    for (const char of [...blanks, ...kept]) {
      const label = `U+${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
      cases.push({ label: `headline ${label}`, user: await createUser(t.db, { ...COMPLETE_PROFILE, headline: `${char}${char}` }) });
    }
    cases.push({ label: 'bio of every blank', user: await createUser(t.db, { ...COMPLETE_PROFILE, bio: blanks.join('') }) });
    cases.push({ label: 'blanks around a word', user: await createUser(t.db, { ...COMPLETE_PROFILE, bio: `${blanks.join('')}x${blanks.join('')}` }) });

    for (const { label, user } of cases) {
      const stats = await computeProfileStats(t.db, user.id);
      expect({ label, xp: stats.xp }).toEqual({ label, xp: computeXp(await xpCountsFor(t.db, user.id)) });
    }
    const xpOf = async (index: number) => (await computeProfileStats(t.db, cases[index].user.id)).xp;
    expect(await xpOf(0)).toBe(0);
    expect(await xpOf(blanks.length)).toBe(XP_RULES.profileComplete);
    expect(await xpOf(cases.length - 2)).toBe(0);
    expect(await xpOf(cases.length - 1)).toBe(XP_RULES.profileComplete);
  });

  it('ranks by strictly greater XP (ties share a rank) across all users', async () => {
    const tiedA = await createUser(t.db);
    const tiedB = await createUser(t.db);
    for (const user of [tiedA, tiedB]) await createCredential(t.db, t.signer, { holder: user, event: eventB, issuer: organizer });

    const { xpById, rank, total } = await expectedRanks();
    for (const id of xpById.keys()) {
      const stats = await computeProfileStats(t.db, id);
      expect({ id, rank: stats.rank, totalRanked: stats.totalRanked }).toEqual({ id, rank: rank(id), totalRanked: total });
    }
    const [a, b] = [await computeProfileStats(t.db, tiedA.id), await computeProfileStats(t.db, tiedB.id)];
    expect(a.xp).toBe(b.xp);
    expect(a.rank).toBe(b.rank);
  });

  it('answers 404 for an unknown user', async () => {
    await expect(computeProfileStats(t.db, '00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
      code: 'not_found',
      status: 404,
    } satisfies Partial<HttpError>);
  });
});

describe('computeActivity', () => {
  const nowMs = Date.UTC(2026, 9, 5, 12);
  const at = (iso: string) => new Date(iso);

  it('counts connections made, live credentials received and vouches given/received per UTC day', async () => {
    const ada = await createUser(t.db);
    const others = [await createUser(t.db), await createUser(t.db), await createUser(t.db), await createUser(t.db)];
    // Late evening and just after midnight UTC are different days (the same day in India).
    await t.db.insert(connections).values([
      { ownerId: ada.id, peerId: others[0].id, source: 'scan', createdAt: at('2026-03-01T23:30:00Z') },
      { ownerId: ada.id, peerId: others[1].id, source: 'scanned', createdAt: at('2026-03-02T00:30:00Z') },
      // Rows owned by someone else are their activity, not Ada's.
      { ownerId: others[2].id, peerId: ada.id, source: 'scan', createdAt: at('2026-03-02T01:00:00Z') },
    ]);
    await createCredential(t.db, t.signer, { holder: ada, event: eventA, issuedAt: at('2026-03-02T10:00:00Z') });
    await createCredential(t.db, t.signer, { holder: ada, event: eventB, issuedAt: at('2026-03-02T11:00:00Z'), revokedAt: at('2026-03-02T11:00:10Z') });
    await createVouch(t.db, { voucher: ada, recipient: others[0], createdAt: at('2026-03-02T12:00:00Z') });
    await createVouch(t.db, { voucher: others[3], recipient: ada, createdAt: at('2026-03-02T13:00:00Z') });
    // Window: the 365 UTC days ending today (2025-10-06 … 2026-10-05).
    await t.db.insert(connections).values([
      { ownerId: ada.id, peerId: others[2].id, source: 'scan', createdAt: at('2025-10-05T23:59:59Z') },
      { ownerId: ada.id, peerId: others[3].id, source: 'scan', createdAt: at('2025-10-06T00:00:00Z') },
    ]);
    await createVouch(t.db, { voucher: others[1], recipient: ada, createdAt: at('2026-10-05T23:00:00Z') });
    await createVouch(t.db, { voucher: others[2], recipient: ada, createdAt: at('2026-10-06T00:00:00Z') });

    const expected = [
      { date: '2025-10-06', count: 1 },
      { date: '2026-03-01', count: 1 },
      { date: '2026-03-02', count: 4 },
      { date: '2026-10-05', count: 1 },
    ];
    expect(await computeActivity(t.db, ada.id, nowMs)).toEqual(expected);

    // The session time zone doesn't move the day boundaries.
    const inIndia = await t.db.transaction(async (tx) => {
      await tx.execute(sql`set local time zone 'Asia/Kolkata'`);
      return computeActivity(tx, ada.id, nowMs);
    });
    expect(inIndia).toEqual(expected);
  });

  it('is empty for a user without activity', async () => {
    const quiet = await createUser(t.db);
    expect(await computeActivity(t.db, quiet.id, nowMs)).toEqual([]);
    expect(await computeActivity(t.db, quiet.id, Date.now() + 400 * DAY_MS - HOUR_MS)).toEqual([]);
  });
});
