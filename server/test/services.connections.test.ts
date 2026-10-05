import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connections, events, type ConnectionRow, type EventRow, type UserRow } from '../src/db/schema';
import { getConnectionSummary, getRelationship, listConnectionSummaries } from '../src/services/connections';
import { toEventLite } from '../src/services/serializers';
import { connectMutually, createEvent, createTestContext, createUser, type TestContext } from './helpers';

let t: TestContext;
let event: EventRow;

beforeAll(async () => {
  t = await createTestContext();
  event = await createEvent(t.db, { isActive: true });
});
afterAll(() => t.close());

const CONTACT = { contactEmail: 'me@contact.dev', phone: '+1 555 0100' };
const PROFILE = {
  headline: 'Frontend engineer',
  location: 'Goa',
  githubUsername: 'peer-gh',
  linkedinUrl: 'https://linkedin.com/in/peer',
  websiteUrl: 'https://peer.dev',
  openTo: ['team' as const],
  ...CONTACT,
};

async function oneWay(owner: UserRow, peer: UserRow, values: Partial<ConnectionRow> = {}): Promise<ConnectionRow> {
  const [row] = await t.db
    .insert(connections)
    .values({ ownerId: owner.id, peerId: peer.id, source: 'scan', ...values })
    .returning();
  if (!row) throw new Error('insert failed');
  return row;
}

async function removeRow(ownerId: string, peerId: string): Promise<void> {
  await t.db.delete(connections).where(and(eq(connections.ownerId, ownerId), eq(connections.peerId, peerId)));
}

describe('listConnectionSummaries', () => {
  it('lists the owner’s rows newest first with the mutual flag; contact details only for mutual connections', async () => {
    const owner = await createUser(t.db);
    const mutualPublic = await createUser(t.db, { ...PROFILE, name: 'Mutual Public' });
    const mutualPrivate = await createUser(t.db, { ...PROFILE, name: 'Mutual Private', visibility: 'connections' });
    const oneWayPublic = await createUser(t.db, { ...PROFILE, name: 'One Way Public' });
    const oneWayPrivate = await createUser(t.db, { ...PROFILE, name: 'One Way Private', visibility: 'connections' });

    const base = Date.UTC(2026, 4, 1);
    const { aToB } = await connectMutually(t.db, owner, mutualPublic, { eventId: event.id });
    await t.db.update(connections).set({ createdAt: new Date(base + 4000), notes: 'Ask about the design system', tags: ['Follow up', 'Hiring'] }).where(eq(connections.id, aToB.id));
    const { aToB: privateRow } = await connectMutually(t.db, owner, mutualPrivate);
    await t.db.update(connections).set({ createdAt: new Date(base + 3000) }).where(eq(connections.id, privateRow.id));
    await oneWay(owner, oneWayPublic, { createdAt: new Date(base + 2000) });
    await oneWay(owner, oneWayPrivate, { createdAt: new Date(base + 1000) });
    // Rows that point at the owner but belong to someone else are not the owner's connections.
    await oneWay(await createUser(t.db), owner);

    const list = await listConnectionSummaries(t.db, owner.id);
    expect(list.map((c) => [c.peer.name, c.mutual])).toEqual([
      ['Mutual Public', true],
      ['Mutual Private', true],
      ['One Way Public', false],
      ['One Way Private', false],
    ]);
    const [first, second, third, fourth] = list;
    expect(first).toMatchObject({
      id: aToB.id,
      notes: 'Ask about the design system',
      tags: ['Follow up', 'Hiring'],
      source: 'scan',
      event: toEventLite(event),
      createdAt: new Date(base + 4000).toISOString(),
      peer: { headline: 'Frontend engineer', githubUsername: 'peer-gh', contact: CONTACT },
    });
    expect(first?.event?.isActive).toBe(true);
    // Mutual: a connections-only person shows their whole card and contact details.
    expect(second?.peer).toMatchObject({ headline: 'Frontend engineer', location: 'Goa', contact: CONTACT });
    expect(second?.event).toBeNull();
    // Not mutual: no contact details; a connections-only person shrinks to name and photo.
    expect(third?.peer).toMatchObject({ headline: 'Frontend engineer', location: 'Goa', openTo: ['team'], contact: null });
    expect(fourth?.peer).toMatchObject({
      name: 'One Way Private',
      headline: '',
      location: '',
      openTo: [],
      githubUsername: null,
      linkedinUrl: null,
      websiteUrl: null,
      avatarUrl: 'https://github.com/peer-gh.png?size=200',
      contact: null,
    });
  });

  it('contact details disappear once the other person deletes their row (the owner keeps theirs)', async () => {
    const [owner, peer] = [await createUser(t.db), await createUser(t.db, { ...PROFILE })];
    const { aToB } = await connectMutually(t.db, owner, peer);
    await t.db.update(connections).set({ notes: 'Great at CSS' }).where(eq(connections.id, aToB.id));
    expect((await listConnectionSummaries(t.db, owner.id))[0]).toMatchObject({ mutual: true, peer: { contact: CONTACT } });

    await removeRow(peer.id, owner.id);
    const [after] = await listConnectionSummaries(t.db, owner.id);
    expect(after).toMatchObject({ id: aToB.id, mutual: false, notes: 'Great at CSS', peer: { contact: null } });
    expect(await listConnectionSummaries(t.db, peer.id)).toEqual([]);
  });

  it('caps the list (newest kept) unless the cap is lifted', async () => {
    const owner = await createUser(t.db);
    const base = Date.UTC(2026, 5, 1);
    for (let i = 0; i < 4; i++) await oneWay(owner, await createUser(t.db, { name: `Peer ${i}` }), { createdAt: new Date(base + i * 1000) });
    expect((await listConnectionSummaries(t.db, owner.id, { limit: 2 })).map((c) => c.peer.name)).toEqual(['Peer 3', 'Peer 2']);
    expect(await listConnectionSummaries(t.db, owner.id, { limit: null })).toHaveLength(4);
  });
});

describe('getConnectionSummary', () => {
  it('returns the owner’s connection and null for anyone else or an unknown id', async () => {
    const [owner, peer, stranger] = [await createUser(t.db), await createUser(t.db, { ...PROFILE }), await createUser(t.db)];
    const { aToB, bToA } = await connectMutually(t.db, owner, peer, { eventId: event.id });

    expect(await getConnectionSummary(t.db, owner.id, aToB.id)).toMatchObject({ id: aToB.id, mutual: true, peer: { id: peer.id, contact: CONTACT } });
    expect(await getConnectionSummary(t.db, peer.id, bToA.id)).toMatchObject({ id: bToA.id, source: 'scanned', peer: { id: owner.id } });
    expect(await getConnectionSummary(t.db, peer.id, aToB.id)).toBeNull();
    expect(await getConnectionSummary(t.db, stranger.id, aToB.id)).toBeNull();
    expect(await getConnectionSummary(t.db, owner.id, '00000000-0000-4000-8000-000000000000')).toBeNull();
  });

  it('keeps the connection without its event after the event is deleted', async () => {
    const [owner, peer] = [await createUser(t.db), await createUser(t.db)];
    const doomed = await createEvent(t.db);
    const { aToB } = await connectMutually(t.db, owner, peer, { eventId: doomed.id });
    await t.db.delete(events).where(eq(events.id, doomed.id));
    expect(await getConnectionSummary(t.db, owner.id, aToB.id)).toMatchObject({ event: null, mutual: true });
  });
});

describe('getRelationship', () => {
  it('finds both directions and whether they are mutual', async () => {
    const [a, b, c] = [await createUser(t.db), await createUser(t.db), await createUser(t.db)];
    const { aToB, bToA } = await connectMutually(t.db, a, b);
    const cToA = await oneWay(c, a);

    expect(await getRelationship(t.db, a.id, b.id)).toMatchObject({ own: { id: aToB.id }, reverse: { id: bToA.id }, mutual: true });
    expect(await getRelationship(t.db, b.id.toUpperCase(), a.id)).toMatchObject({ own: { id: bToA.id }, reverse: { id: aToB.id }, mutual: true });
    expect(await getRelationship(t.db, a.id, c.id)).toMatchObject({ own: null, reverse: { id: cToA.id }, mutual: false });
    expect(await getRelationship(t.db, c.id, a.id)).toMatchObject({ own: { id: cToA.id }, reverse: null, mutual: false });
    expect(await getRelationship(t.db, b.id, c.id)).toEqual({ own: null, reverse: null, mutual: false });
    expect(await getRelationship(t.db, a.id, a.id)).toEqual({ own: null, reverse: null, mutual: false });
  });
});
