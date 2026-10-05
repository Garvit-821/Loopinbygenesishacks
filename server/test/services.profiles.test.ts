import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ProfileResponse, ProfileView, UserLite } from '@loopin/shared';
import { connections, type EventRow, type UserRow } from '../src/db/schema';
import { DAY_MS } from '../src/lib/time';
import {
  buildProfileView,
  buildSelfProfileView,
  loadCredentialsForUser,
  loadVouchesGiven,
  loadVouchesReceived,
} from '../src/services/profiles';
import { computeProfileStats } from '../src/services/stats';
import { connectMutually, createCredential, createEvent, createTestContext, createUser, createVouch, type TestContext } from './helpers';

let t: TestContext;
let event: EventRow;
let organizer: UserRow;

beforeAll(async () => {
  t = await createTestContext();
  event = await createEvent(t.db, { name: 'Genesis Hacks' });
  organizer = await createUser(t.db, { role: 'organizer' });
});
afterAll(() => t.close());

const CONTACT = { contactEmail: 'target@contact.dev', phone: '+44 20 7946 0000' };
const PROFILE = {
  headline: 'ML engineer',
  bio: 'Trains small models.',
  location: 'Delhi',
  githubUsername: 'target-gh',
  skills: [{ name: 'PyTorch', level: 4 }],
  ...CONTACT,
};

function fullProfile(response: ProfileResponse): ProfileView {
  if (response.restricted) throw new Error('expected a full profile');
  return response.profile;
}

function restrictedUser(response: ProfileResponse): UserLite {
  if (!response.restricted) throw new Error('expected a restricted profile');
  return response.user;
}

async function removeRow(ownerId: string, peerId: string): Promise<void> {
  await t.db.delete(connections).where(and(eq(connections.ownerId, ownerId), eq(connections.peerId, peerId)));
}

describe('buildProfileView: public passport', () => {
  it('anyone sees the full passport without contact details', async () => {
    const target = await createUser(t.db, { ...PROFILE });
    const profile = fullProfile(await buildProfileView(t.db, { target, viewer: null }));
    expect(profile).toMatchObject({
      user: { id: target.id, headline: 'ML engineer', bio: 'Trains small models.', githubUsername: 'target-gh' },
      contact: null,
      visibility: 'public',
      relationship: { isSelf: false, connectionId: null, mutual: false },
    });

    const stranger = await createUser(t.db);
    expect(fullProfile(await buildProfileView(t.db, { target, viewer: stranger }))).toMatchObject({ contact: null, relationship: { mutual: false, connectionId: null } });
  });

  it('the user themself gets everything, including contact details', async () => {
    const target = await createUser(t.db, { ...PROFILE, visibility: 'connections' });
    const expected = { contact: CONTACT, visibility: 'connections', relationship: { isSelf: true, connectionId: null, mutual: false } };
    expect(fullProfile(await buildProfileView(t.db, { target, viewer: target }))).toMatchObject(expected);
    expect(await buildSelfProfileView(t.db, target)).toMatchObject(expected);
  });

  it('a mutual connection sees contact details until either side deletes their row', async () => {
    const [target, viewer] = [await createUser(t.db, { ...PROFILE }), await createUser(t.db)];
    const { aToB: viewerRow } = await connectMutually(t.db, viewer, target);

    expect(fullProfile(await buildProfileView(t.db, { target, viewer }))).toMatchObject({
      contact: CONTACT,
      relationship: { isSelf: false, connectionId: viewerRow.id, mutual: true },
    });

    // The target removes the viewer: the viewer keeps their own row (and its id) but loses contact details.
    await removeRow(target.id, viewer.id);
    expect(fullProfile(await buildProfileView(t.db, { target, viewer }))).toMatchObject({
      contact: null,
      relationship: { connectionId: viewerRow.id, mutual: false },
    });
  });

  it('the viewer deleting their own row leaves no connection id', async () => {
    const [target, viewer] = [await createUser(t.db, { ...PROFILE }), await createUser(t.db)];
    await connectMutually(t.db, viewer, target);
    await removeRow(viewer.id, target.id);
    expect(fullProfile(await buildProfileView(t.db, { target, viewer }))).toMatchObject({ contact: null, relationship: { connectionId: null, mutual: false } });
  });
});

describe('buildProfileView: connections-only passport', () => {
  it('non-connections see only name and photo', async () => {
    const target = await createUser(t.db, { ...PROFILE, visibility: 'connections' });
    const expected: UserLite = { id: target.id, handle: target.handle, name: target.name, headline: '', avatarUrl: 'https://github.com/target-gh.png?size=200' };

    expect(await buildProfileView(t.db, { target, viewer: null })).toEqual({ restricted: true, user: expected });
    expect(restrictedUser(await buildProfileView(t.db, { target, viewer: await createUser(t.db) }))).toEqual(expected);
  });

  it('a one-way connection is not enough', async () => {
    const [target, viewer] = [await createUser(t.db, { ...PROFILE, visibility: 'connections' }), await createUser(t.db)];
    await t.db.insert(connections).values({ ownerId: viewer.id, peerId: target.id, source: 'scan' });
    expect((await buildProfileView(t.db, { target, viewer })).restricted).toBe(true);
    // …in either direction.
    const [target2, viewer2] = [await createUser(t.db, { visibility: 'connections' }), await createUser(t.db)];
    await t.db.insert(connections).values({ ownerId: target2.id, peerId: viewer2.id, source: 'scan' });
    expect((await buildProfileView(t.db, { target: target2, viewer: viewer2 })).restricted).toBe(true);
  });

  it('mutual connections see the full passport; it is restricted again once the target removes them', async () => {
    const [target, viewer] = [await createUser(t.db, { ...PROFILE, visibility: 'connections' }), await createUser(t.db)];
    const { aToB: viewerRow } = await connectMutually(t.db, viewer, target);

    expect(fullProfile(await buildProfileView(t.db, { target, viewer }))).toMatchObject({
      user: { headline: 'ML engineer' },
      contact: CONTACT,
      visibility: 'connections',
      relationship: { connectionId: viewerRow.id, mutual: true },
    });

    await removeRow(target.id, viewer.id);
    expect(restrictedUser(await buildProfileView(t.db, { target, viewer }))).toMatchObject({ id: target.id, headline: '' });
  });
});

describe('buildProfileView: contents', () => {
  it('shows an admin as an organizer', async () => {
    const admin = await createUser(t.db, { role: 'admin' });
    expect(fullProfile(await buildProfileView(t.db, { target: admin, viewer: null })).user.role).toBe('organizer');
    expect(fullProfile(await buildProfileView(t.db, { target: admin, viewer: admin })).user.role).toBe('organizer');
  });

  it('includes stats, live credentials, vouches received and activity', async () => {
    const target = await createUser(t.db, { ...PROFILE });
    const voucher = await createUser(t.db);
    await connectMutually(t.db, target, voucher);
    const stamp = await createCredential(t.db, t.signer, { holder: target, event, issuer: organizer, issuedAt: new Date(Date.now() - 2 * DAY_MS) });
    await createCredential(t.db, t.signer, { holder: target, event, issuer: organizer, role: 'mentor', revokedAt: new Date() });
    const vouch = await createVouch(t.db, { voucher, recipient: target, skill: 'PyTorch' });

    const profile = fullProfile(await buildProfileView(t.db, { target, viewer: null }));
    expect(profile.stats).toEqual(await computeProfileStats(t.db, target.id));
    expect(profile.stats).toMatchObject({ connections: 1, stamps: 1, vouches: 1 });
    expect(profile.credentials.map((c) => c.id)).toEqual([stamp.id]);
    expect(profile.credentials[0]).toMatchObject({ type: 'stamp', role: 'hacker', event: { id: event.id, name: 'Genesis Hacks' }, issuer: { id: organizer.id } });
    expect(profile.vouches.map((v) => v.id)).toEqual([vouch.id]);
    expect(profile.vouches[0]).toMatchObject({ voucher: { id: voucher.id }, recipientId: target.id, skill: 'PyTorch' });
    // Connection made today, the stamp two days ago (UTC days), the vouch today; the revoked stamp doesn't count.
    expect(profile.activity.reduce((sum, day) => sum + day.count, 0)).toBe(3);
  });

  it('works inside a transaction', async () => {
    const [target, viewer] = [await createUser(t.db, { ...PROFILE }), await createUser(t.db)];
    await connectMutually(t.db, viewer, target);
    const response = await t.db.transaction((tx) => buildProfileView(tx, { target, viewer }));
    expect(fullProfile(response)).toMatchObject({ contact: CONTACT, relationship: { mutual: true } });
  });
});

describe('profile lists', () => {
  it('loadCredentialsForUser: live credentials newest first; revoked ones only on request; capped', async () => {
    const holder = await createUser(t.db);
    const base = Date.UTC(2026, 1, 1);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      ids.push((await createCredential(t.db, t.signer, { holder, event, role: (['hacker', 'mentor', 'judge'] as const)[i], issuedAt: new Date(base + i * DAY_MS) })).id);
    }
    const revoked = await createCredential(t.db, t.signer, { holder, event, type: 'award', placement: 'first', issuedAt: new Date(base + 10 * DAY_MS), revokedAt: new Date() });

    expect((await loadCredentialsForUser(t.db, holder.id)).map((c) => c.id)).toEqual([ids[2], ids[1], ids[0]]);
    const all = await loadCredentialsForUser(t.db, holder.id, { includeRevoked: true, limit: null });
    expect(all.map((c) => c.id)).toEqual([revoked.id, ids[2], ids[1], ids[0]]);
    expect(all[0]?.revokedAt).not.toBeNull();
    expect(all[0]?.issuer).toBeNull();
    expect((await loadCredentialsForUser(t.db, holder.id, { limit: 1 })).map((c) => c.id)).toEqual([ids[2]]);
  });

  it('loadVouchesReceived / loadVouchesGiven: newest first; the giver is shown in full to themself', async () => {
    const giver = await createUser(t.db, { visibility: 'connections', headline: 'Private headline' });
    const [r1, r2] = [await createUser(t.db), await createUser(t.db)];
    const older = await createVouch(t.db, { voucher: giver, recipient: r1, createdAt: new Date(Date.UTC(2026, 0, 1)) });
    const newer = await createVouch(t.db, { voucher: giver, recipient: r2, createdAt: new Date(Date.UTC(2026, 0, 2)), eventId: event.id });
    const another = await createVouch(t.db, { voucher: await createUser(t.db), recipient: r1, createdAt: new Date(Date.UTC(2026, 0, 3)) });

    const received = await loadVouchesReceived(t.db, r1.id);
    expect(received.map((v) => v.id)).toEqual([another.id, older.id]);
    // Other people see a connections-only voucher's name and photo only.
    expect(received[1]?.voucher).toMatchObject({ id: giver.id, headline: '' });
    expect((await loadVouchesReceived(t.db, r1.id, { limit: 1 })).map((v) => v.id)).toEqual([another.id]);

    const given = await loadVouchesGiven(t.db, giver.id);
    expect(given.map((v) => v.id)).toEqual([newer.id, older.id]);
    expect(given[0]).toMatchObject({ voucher: { id: giver.id, headline: 'Private headline' }, recipientId: r2.id, event: { id: event.id } });
    expect(await loadVouchesGiven(t.db, '00000000-0000-4000-8000-000000000000')).toEqual([]);
  });
});
