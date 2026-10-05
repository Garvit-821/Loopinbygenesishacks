import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  AdminUser,
  Announcement,
  ConnectionPeer,
  ConnectionSummary,
  Credential,
  EventLite,
  EventSummary,
  IssuedCredential,
  Me,
  Notification,
  PublicUser,
  UserLite,
  Vouch,
} from '@loopin/shared';
import { announcements, connections, notifications, users, type EventRow, type UserRow } from '../src/db/schema';
import { HOUR_MS } from '../src/lib/time';
import {
  avatarUrlOf,
  isEventActive,
  toAdminUser,
  toAnnouncement,
  toConnectionPeer,
  toConnectionSummary,
  toContactInfo,
  toCredential,
  toEventLite,
  toEventSummary,
  toIssuedCredential,
  toMe,
  toNotification,
  toPublicUser,
  toUserLite,
  toVouch,
} from '../src/services/serializers';
import { createCredential, createEvent, createTestContext, createUser, createVouch, type TestContext } from './helpers';

let t: TestContext;
let event: EventRow;
let organizer: UserRow;

beforeAll(async () => {
  t = await createTestContext();
  event = await createEvent(t.db, { location: 'Bengaluru', tagline: 'Build things', description: 'Two days of hacking.' });
  organizer = await createUser(t.db, { role: 'organizer', headline: 'Runs the show' });
});
afterAll(() => t.close());

/** The exact key set of a DTO; `satisfies Record<keyof T, 1>` makes the compiler reject missing or extra keys. */
const keys = (shape: Record<string, 1>): string[] => Object.keys(shape).sort();
const sortedKeys = (value: object): string[] => Object.keys(value).sort();

const USER_LITE_KEYS = keys({ id: 1, handle: 1, name: 1, headline: 1, avatarUrl: 1 } satisfies Record<keyof UserLite, 1>);
const PUBLIC_USER_KEYS = keys({
  id: 1, handle: 1, name: 1, headline: 1, avatarUrl: 1, bio: 1, location: 1, githubUsername: 1, linkedinUrl: 1,
  websiteUrl: 1, skills: 1, openTo: 1, role: 1, createdAt: 1,
} satisfies Record<keyof PublicUser, 1>);
const ME_KEYS = keys({
  id: 1, handle: 1, name: 1, headline: 1, avatarUrl: 1, bio: 1, location: 1, githubUsername: 1, linkedinUrl: 1,
  websiteUrl: 1, skills: 1, openTo: 1, role: 1, createdAt: 1, contactEmail: 1, phone: 1, email: 1, emailVerified: 1,
  visibility: 1, hasPassword: 1, githubLinked: 1,
} satisfies Record<keyof Me, 1>);
const ADMIN_USER_KEYS = keys({ id: 1, handle: 1, name: 1, headline: 1, avatarUrl: 1, email: 1, role: 1, createdAt: 1 } satisfies Record<keyof AdminUser, 1>);
const EVENT_LITE_KEYS = keys({ id: 1, slug: 1, name: 1, kind: 1, location: 1, startsAt: 1, endsAt: 1, isActive: 1 } satisfies Record<keyof EventLite, 1>);
const EVENT_SUMMARY_KEYS = keys({
  id: 1, slug: 1, name: 1, kind: 1, location: 1, startsAt: 1, endsAt: 1, isActive: 1, tagline: 1, description: 1,
  rsvpCount: 1, myRsvp: 1,
} satisfies Record<keyof EventSummary, 1>);
const CREDENTIAL_KEYS = keys({
  id: 1, type: 1, role: 1, placement: 1, track: 1, projectName: 1, projectUrl: 1, event: 1, issuer: 1, issuedAt: 1,
  revokedAt: 1,
} satisfies Record<keyof Credential, 1>);
const ISSUED_CREDENTIAL_KEYS = keys({
  id: 1, type: 1, role: 1, placement: 1, track: 1, projectName: 1, projectUrl: 1, event: 1, issuer: 1, issuedAt: 1,
  revokedAt: 1, holder: 1,
} satisfies Record<keyof IssuedCredential, 1>);
const VOUCH_KEYS = keys({ id: 1, voucher: 1, recipientId: 1, skill: 1, message: 1, event: 1, createdAt: 1 } satisfies Record<keyof Vouch, 1>);
const ANNOUNCEMENT_KEYS = keys({
  id: 1, title: 1, body: 1, kind: 1, urgent: 1, actionLabel: 1, actionUrl: 1, location: 1, event: 1, author: 1, createdAt: 1,
} satisfies Record<keyof Announcement, 1>);
const NOTIFICATION_KEYS = keys({ id: 1, kind: 1, actor: 1, title: 1, body: 1, link: 1, readAt: 1, createdAt: 1 } satisfies Record<keyof Notification, 1>);
const CONNECTION_PEER_KEYS = keys({
  id: 1, handle: 1, name: 1, headline: 1, avatarUrl: 1, openTo: 1, location: 1, githubUsername: 1, linkedinUrl: 1,
  websiteUrl: 1, contact: 1,
} satisfies Record<keyof ConnectionPeer, 1>);
const CONNECTION_SUMMARY_KEYS = keys({
  id: 1, peer: 1, notes: 1, tags: 1, event: 1, source: 1, mutual: 1, createdAt: 1, updatedAt: 1,
} satisfies Record<keyof ConnectionSummary, 1>);

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const FULL_PROFILE = {
  headline: 'Distributed systems',
  bio: 'Builds databases.',
  location: 'Pune',
  githubUsername: 'ada-l',
  linkedinUrl: 'https://linkedin.com/in/ada',
  websiteUrl: 'https://ada.dev',
  contactEmail: 'ada@contact.dev',
  phone: '+91 98765 43210',
  skills: [
    { name: 'Rust', level: 5 },
    { name: 'SQL', level: 4 },
  ],
  openTo: ['collab' as const, 'mentoring' as const],
};

describe('users', () => {
  it('falls back to the GitHub avatar only when no photo is set', () => {
    expect(avatarUrlOf({ avatarUrl: 'https://img.example/a.png', githubUsername: 'octocat' })).toBe('https://img.example/a.png');
    expect(avatarUrlOf({ avatarUrl: null, githubUsername: 'octo-cat' })).toBe('https://github.com/octo-cat.png?size=200');
    expect(avatarUrlOf({ avatarUrl: null, githubUsername: 'a/b?c' })).toBe('https://github.com/a%2Fb%3Fc.png?size=200');
    expect(avatarUrlOf({ avatarUrl: '', githubUsername: null })).toBeNull();
    expect(avatarUrlOf({ avatarUrl: null, githubUsername: null })).toBeNull();
  });

  it('builds UserLite with the exact keys and hides a connections-only headline unless the audience is entitled', async () => {
    const open = await createUser(t.db, { ...FULL_PROFILE });
    const closed = await createUser(t.db, { ...FULL_PROFILE, githubUsername: null, visibility: 'connections' });

    expect(toUserLite(open)).toEqual({
      id: open.id,
      handle: open.handle,
      name: open.name,
      headline: 'Distributed systems',
      avatarUrl: 'https://github.com/ada-l.png?size=200',
    });
    expect(sortedKeys(toUserLite(open))).toEqual(USER_LITE_KEYS);
    expect(toUserLite(closed)).toMatchObject({ headline: '', avatarUrl: null });
    expect(toUserLite(closed, 'entitled').headline).toBe('Distributed systems');
  });

  it('PublicUser carries the passport fields only and never reveals admin', async () => {
    const admin = await createUser(t.db, { ...FULL_PROFILE, role: 'admin', githubId: '4242', emailVerifiedAt: new Date() });
    const dto = toPublicUser(admin);

    expect(sortedKeys(dto)).toEqual(PUBLIC_USER_KEYS);
    expect(dto).toMatchObject({
      headline: 'Distributed systems',
      bio: 'Builds databases.',
      location: 'Pune',
      githubUsername: 'ada-l',
      linkedinUrl: 'https://linkedin.com/in/ada',
      websiteUrl: 'https://ada.dev',
      skills: FULL_PROFILE.skills,
      openTo: ['collab', 'mentoring'],
      role: 'organizer',
      createdAt: admin.createdAt.toISOString(),
    });
    expect(dto.createdAt).toMatch(ISO_UTC);
    // Nothing private can ride along.
    const serialized = JSON.stringify(dto);
    for (const secret of [admin.email, admin.passwordHash, admin.badgeId, '4242', 'ada@contact.dev', '+91 98765 43210']) {
      expect(serialized).not.toContain(secret);
    }
    expect(toPublicUser({ ...admin, role: 'organizer' }).role).toBe('organizer');
    expect(toPublicUser({ ...admin, role: 'member' }).role).toBe('member');
    // A connections-only person's headline is part of the passport their entitled viewers see.
    expect(toPublicUser({ ...admin, visibility: 'connections' }).headline).toBe('Distributed systems');
  });

  it('copies skills as {name, level} only', async () => {
    const user = await createUser(t.db, { skills: [{ name: 'Go', level: 3, extra: 'x' } as unknown as { name: string; level: number }] });
    expect(toPublicUser(user).skills).toEqual([{ name: 'Go', level: 3 }]);
  });

  it('Me keeps the real role and reports account state', async () => {
    const admin = await createUser(t.db, { ...FULL_PROFILE, role: 'admin', githubId: '99', emailVerifiedAt: new Date(), visibility: 'connections' });
    const me = toMe(admin);
    expect(sortedKeys(me)).toEqual(ME_KEYS);
    expect(me).toMatchObject({
      role: 'admin',
      email: admin.email,
      emailVerified: true,
      hasPassword: true,
      githubLinked: true,
      visibility: 'connections',
      contactEmail: 'ada@contact.dev',
      phone: '+91 98765 43210',
      headline: 'Distributed systems',
    });

    const fresh = await createUser(t.db, { passwordHash: null });
    expect(toMe(fresh)).toMatchObject({ role: 'member', emailVerified: false, hasPassword: false, githubLinked: false, contactEmail: null, phone: null });
    expect(JSON.stringify(toMe(admin))).not.toContain(admin.passwordHash ?? 'unreachable');
  });

  it('AdminUser shows the real role, the email and the headline', async () => {
    const user = await createUser(t.db, { ...FULL_PROFILE, role: 'admin', visibility: 'connections' });
    const dto = toAdminUser(user);
    expect(sortedKeys(dto)).toEqual(ADMIN_USER_KEYS);
    expect(dto).toMatchObject({ role: 'admin', email: user.email, headline: 'Distributed systems', createdAt: user.createdAt.toISOString() });
  });

  it('ContactInfo has only the two contact fields', async () => {
    const user = await createUser(t.db, { ...FULL_PROFILE });
    expect(toContactInfo(user)).toEqual({ contactEmail: 'ada@contact.dev', phone: '+91 98765 43210' });
  });
});

describe('events', () => {
  const nowMs = Date.UTC(2030, 0, 15, 12);
  const row = (overrides: Partial<EventRow>) => ({
    ...event,
    startsAt: new Date(nowMs - 5 * HOUR_MS),
    endsAt: new Date(nowMs + 5 * HOUR_MS),
    isActive: true,
    ...overrides,
  });

  it('isActive is the organizer toggle AND not yet ended', () => {
    expect(isEventActive(row({}), nowMs)).toBe(true);
    expect(isEventActive(row({ isActive: false }), nowMs)).toBe(false);
    expect(isEventActive(row({ endsAt: new Date(nowMs - 1) }), nowMs)).toBe(false);
    expect(isEventActive(row({ endsAt: new Date(nowMs) }), nowMs)).toBe(false);
    expect(isEventActive(row({ startsAt: new Date(nowMs + HOUR_MS), endsAt: new Date(nowMs + 2 * HOUR_MS) }), nowMs)).toBe(true);
  });

  it('EventLite and EventSummary use ISO timestamps and the effective state', () => {
    const lite = toEventLite(row({ endsAt: new Date(nowMs - 1000) }), nowMs);
    expect(sortedKeys(lite)).toEqual(EVENT_LITE_KEYS);
    expect(lite).toEqual({
      id: event.id,
      slug: event.slug,
      name: event.name,
      kind: 'hackathon',
      location: 'Bengaluru',
      startsAt: new Date(nowMs - 5 * HOUR_MS).toISOString(),
      endsAt: new Date(nowMs - 1000).toISOString(),
      isActive: false,
    });

    const summary = toEventSummary({ event: row({}), rsvpCount: 7, myRsvp: true }, nowMs);
    expect(sortedKeys(summary)).toEqual(EVENT_SUMMARY_KEYS);
    expect(summary).toMatchObject({ isActive: true, tagline: 'Build things', description: 'Two days of hacking.', rsvpCount: 7, myRsvp: true });
  });
});

describe('credentials, vouches, announcements, notifications', () => {
  it('Credential and IssuedCredential expose the record, never the signed payload or signature', async () => {
    const holder = await createUser(t.db, { visibility: 'connections', headline: 'Private headline' });
    const row = await createCredential(t.db, t.signer, {
      holder,
      event,
      issuer: organizer,
      type: 'award',
      placement: 'second',
      track: 'AI',
      projectName: 'Loopin',
      projectUrl: 'https://loopin.dev',
      issuedAt: new Date('2026-03-02T10:00:00.123Z'),
      revokedAt: new Date('2026-03-03T00:00:00Z'),
    });

    const credential = toCredential({ credential: row, event, issuer: organizer });
    expect(sortedKeys(credential)).toEqual(CREDENTIAL_KEYS);
    expect(credential).toEqual({
      id: row.id,
      type: 'award',
      role: null,
      placement: 'second',
      track: 'AI',
      projectName: 'Loopin',
      projectUrl: 'https://loopin.dev',
      event: toEventLite(event),
      issuer: toUserLite(organizer),
      issuedAt: '2026-03-02T10:00:00.123Z',
      revokedAt: '2026-03-03T00:00:00.000Z',
    });
    expect(JSON.stringify(credential)).not.toContain(row.signature);

    const issued = toIssuedCredential({ credential: row, event, issuer: null, holder });
    expect(sortedKeys(issued)).toEqual(ISSUED_CREDENTIAL_KEYS);
    expect(issued.issuer).toBeNull();
    // Organizer views list people without checking their relationship: a connections-only headline stays hidden.
    expect(issued.holder).toEqual({ ...toUserLite(holder), headline: '' });
  });

  it('Vouch maps the voucher, the optional event and the timestamp', async () => {
    const [voucher, recipient] = [await createUser(t.db, { githubUsername: 'grace' }), await createUser(t.db)];
    const vouch = await createVouch(t.db, { voucher, recipient, skill: 'Rust', message: 'Shipped the parser.', createdAt: new Date('2026-01-01T00:00:00Z') });

    const withEvent = toVouch({ vouch, voucher, event });
    expect(sortedKeys(withEvent)).toEqual(VOUCH_KEYS);
    expect(withEvent).toEqual({
      id: vouch.id,
      voucher: { id: voucher.id, handle: voucher.handle, name: voucher.name, headline: '', avatarUrl: 'https://github.com/grace.png?size=200' },
      recipientId: recipient.id,
      skill: 'Rust',
      message: 'Shipped the parser.',
      event: toEventLite(event),
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    expect(toVouch({ vouch, voucher, event: null }).event).toBeNull();
  });

  it('Announcement maps optional event, author and action fields', async () => {
    const [row] = await t.db
      .insert(announcements)
      .values({ title: 'Lunch', body: 'Pizza in hall B', kind: 'info', authorId: organizer.id, location: 'Hall B' })
      .returning();
    if (!row) throw new Error('insert failed');

    const global = toAnnouncement({ announcement: row, event: null, author: null });
    expect(sortedKeys(global)).toEqual(ANNOUNCEMENT_KEYS);
    expect(global).toEqual({
      id: row.id,
      title: 'Lunch',
      body: 'Pizza in hall B',
      kind: 'info',
      urgent: false,
      actionLabel: null,
      actionUrl: null,
      location: 'Hall B',
      event: null,
      author: null,
      createdAt: row.createdAt.toISOString(),
    });
    const scoped = toAnnouncement({ announcement: row, event, author: organizer });
    expect(scoped.event).toEqual(toEventLite(event));
    expect(scoped.author).toEqual(toUserLite(organizer));
  });

  it('Notification maps the actor and read state', async () => {
    const [recipient, actor] = [await createUser(t.db), await createUser(t.db, { avatarUrl: 'https://img.example/me.png' })];
    const [row] = await t.db
      .insert(notifications)
      .values({ userId: recipient.id, actorId: actor.id, kind: 'connection', title: 'Hi', body: 'There', link: '/network/x' })
      .returning();
    if (!row) throw new Error('insert failed');

    const unread = toNotification({ notification: row, actor });
    expect(sortedKeys(unread)).toEqual(NOTIFICATION_KEYS);
    expect(unread).toEqual({
      id: row.id,
      kind: 'connection',
      actor: toUserLite(actor),
      title: 'Hi',
      body: 'There',
      link: '/network/x',
      readAt: null,
      createdAt: row.createdAt.toISOString(),
    });
    const readAt = new Date('2026-05-05T05:05:05Z');
    expect(toNotification({ notification: { ...row, readAt }, actor: null })).toMatchObject({ actor: null, readAt: '2026-05-05T05:05:05.000Z' });
  });
});

describe('connections', () => {
  it('a mutual peer comes with contact details', async () => {
    const peer = await createUser(t.db, { ...FULL_PROFILE, visibility: 'connections' });
    const dto = toConnectionPeer(peer, true);
    expect(sortedKeys(dto)).toEqual(CONNECTION_PEER_KEYS);
    expect(dto).toEqual({
      id: peer.id,
      handle: peer.handle,
      name: peer.name,
      headline: 'Distributed systems',
      avatarUrl: 'https://github.com/ada-l.png?size=200',
      openTo: ['collab', 'mentoring'],
      location: 'Pune',
      githubUsername: 'ada-l',
      linkedinUrl: 'https://linkedin.com/in/ada',
      websiteUrl: 'https://ada.dev',
      contact: { contactEmail: 'ada@contact.dev', phone: '+91 98765 43210' },
    });
  });

  it('a peer who is no longer connected back loses contact; a connections-only one shrinks to name and photo', async () => {
    const open = await createUser(t.db, { ...FULL_PROFILE });
    expect(toConnectionPeer(open, false)).toMatchObject({ headline: 'Distributed systems', location: 'Pune', githubUsername: 'ada-l', contact: null });

    const closed = await createUser(t.db, { ...FULL_PROFILE, visibility: 'connections' });
    const restricted = toConnectionPeer(closed, false);
    expect(sortedKeys(restricted)).toEqual(CONNECTION_PEER_KEYS);
    expect(restricted).toEqual({
      id: closed.id,
      handle: closed.handle,
      name: closed.name,
      headline: '',
      avatarUrl: 'https://github.com/ada-l.png?size=200',
      openTo: [],
      location: '',
      githubUsername: null,
      linkedinUrl: null,
      websiteUrl: null,
      contact: null,
    });
  });

  it('ConnectionSummary carries the owner notes, tags, met-at event and mutual flag', async () => {
    const [owner, peer] = [await createUser(t.db), await createUser(t.db, { ...FULL_PROFILE })];
    const [row] = await t.db
      .insert(connections)
      .values({ ownerId: owner.id, peerId: peer.id, source: 'scanned', notes: 'Met at the API booth', tags: ['Follow up'], eventId: event.id })
      .returning();
    if (!row) throw new Error('insert failed');
    const [peerRow] = await t.db.select().from(users).where(eq(users.id, peer.id));
    if (!peerRow) throw new Error('peer missing');

    const summary = toConnectionSummary({ connection: row, peer: peerRow, event, mutual: false });
    expect(sortedKeys(summary)).toEqual(CONNECTION_SUMMARY_KEYS);
    expect(summary).toEqual({
      id: row.id,
      peer: toConnectionPeer(peerRow, false),
      notes: 'Met at the API booth',
      tags: ['Follow up'],
      event: toEventLite(event),
      source: 'scanned',
      mutual: false,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
    expect(toConnectionSummary({ connection: row, peer: peerRow, event: null, mutual: true })).toMatchObject({
      event: null,
      mutual: true,
      peer: { contact: { contactEmail: 'ada@contact.dev', phone: '+91 98765 43210' } },
    });
  });
});
