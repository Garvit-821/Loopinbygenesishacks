import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LIST_CAPS, type StreamEvent } from '@loopin/shared';
import { notifications, type UserRow } from '../src/db/schema';
import { createBus } from '../src/lib/bus';
import {
  createNotification,
  excerpt,
  getUnreadCount,
  listNotifications,
  loadNotifications,
  markRead,
  publishNotification,
} from '../src/services/notifications';
import { toUserLite } from '../src/services/serializers';
import { createTestContext, createUser, type TestContext } from './helpers';

let t: TestContext;
let actor: UserRow;

beforeAll(async () => {
  t = await createTestContext();
  actor = await createUser(t.db, { githubUsername: 'octocat', headline: 'Builder' });
});
afterAll(() => t.close());

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** `count` notifications for `user`, one millisecond apart (oldest first), titled "#0", "#1", …. */
async function seedNotifications(user: UserRow, count: number): Promise<void> {
  const base = Date.UTC(2026, 0, 1);
  await t.db.insert(notifications).values(
    Array.from({ length: count }, (_, i) => ({
      userId: user.id,
      kind: 'stamp' as const,
      title: `#${i}`,
      body: 'Hacker stamp added to your passport',
      link: '/passport',
      createdAt: new Date(base + i),
    })),
  );
}

describe('createNotification', () => {
  it('stores the notification and returns it with the actor', async () => {
    const recipient = await createUser(t.db);
    const notification = await createNotification(t.db, {
      userId: recipient.id,
      kind: 'connection',
      actorId: actor.id,
      title: `${actor.name} connected with you`,
      body: 'Add a private note so you remember them',
      link: '/network/123',
    });

    expect(notification).toEqual({
      id: expect.any(String),
      kind: 'connection',
      actor: toUserLite(actor),
      title: `${actor.name} connected with you`,
      body: 'Add a private note so you remember them',
      link: '/network/123',
      readAt: null,
      createdAt: expect.stringMatching(ISO_UTC),
    });
    expect(notification.actor?.avatarUrl).toBe('https://github.com/octocat.png?size=200');
    const [row] = await t.db.select().from(notifications).where(eq(notifications.id, notification.id));
    expect(row).toMatchObject({ userId: recipient.id, actorId: actor.id, kind: 'connection', readAt: null });
  });

  it('allows notifications without an actor or a link', async () => {
    const recipient = await createUser(t.db);
    const notification = await createNotification(t.db, { userId: recipient.id, kind: 'role', title: "You're now an organizer", body: 'Open the organizer console to run events.', link: null });
    expect(notification).toMatchObject({ actor: null, link: null, kind: 'role' });
  });

  it('works inside a transaction (the notification is returned for publishing after commit)', async () => {
    const recipient = await createUser(t.db);
    const notification = await t.db.transaction((tx) =>
      createNotification(tx, { userId: recipient.id, kind: 'vouch', actorId: actor.id, title: 'Vouched', body: 'Nice', link: '/passport?tab=vouches' }),
    );
    expect(notification.actor?.id).toBe(actor.id);
    expect(await getUnreadCount(t.db, recipient.id)).toBe(1);
  });

  it('refuses links that are not in-app paths', async () => {
    const recipient = await createUser(t.db);
    for (const link of ['https://evil.example', '//evil.example', '/\\evil.example', 'network/1', '']) {
      await expect(createNotification(t.db, { userId: recipient.id, kind: 'stamp', title: 'x', body: 'y', link })).rejects.toThrow(/in-app paths/);
    }
    expect(await getUnreadCount(t.db, recipient.id)).toBe(0);
  });
});

describe('publishNotification', () => {
  it('pushes a notification event to the recipient only', async () => {
    const bus = createBus({ maxStreams: 10 });
    const received: { userId: string; event: StreamEvent }[] = [];
    const [recipient, bystander] = [await createUser(t.db), await createUser(t.db)];
    for (const user of [recipient, bystander]) {
      bus.subscribe(user.id, randomUUID(), (event) => received.push({ userId: user.id, event }), () => undefined);
    }
    const notification = await createNotification(t.db, { userId: recipient.id, kind: 'award', title: '1st place', body: 'Added to your passport', link: '/verify/1' });

    publishNotification(bus, recipient.id, notification);
    expect(received).toEqual([{ userId: recipient.id, event: { type: 'notification', notification } }]);
    bus.closeAll();
  });
});

describe('listNotifications', () => {
  it('returns the latest LIST_CAPS.notifications, newest first, with the total unread count', async () => {
    const user = await createUser(t.db);
    await seedNotifications(user, LIST_CAPS.notifications + 5);

    const list = await listNotifications(t.db, user.id);
    expect(list.notifications).toHaveLength(LIST_CAPS.notifications);
    expect(list.notifications[0]?.title).toBe(`#${LIST_CAPS.notifications + 4}`);
    expect(list.notifications.at(-1)?.title).toBe('#5');
    expect(list.unreadCount).toBe(LIST_CAPS.notifications + 5);
    expect(typeof list.unreadCount).toBe('number');
  });

  it("never includes someone else's notifications", async () => {
    const [me, other] = [await createUser(t.db), await createUser(t.db)];
    await seedNotifications(other, 3);
    expect(await listNotifications(t.db, me.id)).toEqual({ notifications: [], unreadCount: 0 });
  });

  it('loadNotifications returns all of them when no limit is given (account export)', async () => {
    const user = await createUser(t.db);
    await seedNotifications(user, LIST_CAPS.notifications + 2);
    expect(await loadNotifications(t.db, user.id)).toHaveLength(LIST_CAPS.notifications + 2);
    expect(await loadNotifications(t.db, user.id, { limit: null })).toHaveLength(LIST_CAPS.notifications + 2);
    expect(await loadNotifications(t.db, user.id, { limit: 3 })).toHaveLength(3);
  });
});

describe('markRead', () => {
  it('marks only the given notifications of the signed-in user', async () => {
    const [me, other] = [await createUser(t.db), await createUser(t.db)];
    await seedNotifications(me, 4);
    await seedNotifications(other, 2);
    const mine = await loadNotifications(t.db, me.id);
    const theirs = await loadNotifications(t.db, other.id);
    const [first, second] = mine;
    if (!first || !second) throw new Error('seed failed');

    // Someone else's ids are ignored, not marked.
    expect(await markRead(t.db, me.id, [first.id, second.id, ...theirs.map((n) => n.id)])).toEqual({ unreadCount: 2 });
    expect(await getUnreadCount(t.db, other.id)).toBe(2);

    const after = await loadNotifications(t.db, me.id);
    expect(after.filter((n) => n.readAt !== null).map((n) => n.id).sort()).toEqual([first.id, second.id].sort());
    expect(after.find((n) => n.id === first.id)?.readAt).toMatch(ISO_UTC);
  });

  it('an empty list marks nothing; no ids marks everything', async () => {
    const user = await createUser(t.db);
    await seedNotifications(user, 3);
    expect(await markRead(t.db, user.id, [])).toEqual({ unreadCount: 3 });
    expect(await markRead(t.db, user.id)).toEqual({ unreadCount: 0 });
  });

  it('keeps the first read time when a notification is marked again', async () => {
    const user = await createUser(t.db);
    await seedNotifications(user, 1);
    await markRead(t.db, user.id);
    const [before] = await loadNotifications(t.db, user.id);
    await markRead(t.db, user.id);
    const [after] = await loadNotifications(t.db, user.id);
    expect(after?.readAt).toBe(before?.readAt);
  });
});

describe('excerpt', () => {
  it('collapses whitespace and shortens to the limit with an ellipsis', () => {
    expect(excerpt('  Great\n\nteammate\t!  ', 140)).toBe('Great teammate !');
    expect(excerpt('a'.repeat(140), 140)).toBe('a'.repeat(140));
    const source = `${'word '.repeat(40)}end`;
    const long = excerpt(source, 140);
    expect(long.endsWith('…')).toBe(true);
    expect(Array.from(long).length).toBeLessThanOrEqual(140);
    // The kept part is the start of the text without trailing whitespace before the ellipsis.
    expect(source.startsWith(long.slice(0, -1))).toBe(true);
    expect(long).not.toMatch(/\s…$/);
  });

  it('never splits an emoji', () => {
    const text = '🚀'.repeat(10);
    expect(excerpt(text, 5)).toBe('🚀🚀🚀🚀…');
  });
});
