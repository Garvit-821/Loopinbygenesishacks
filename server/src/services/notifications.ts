/**
 * In-app notifications (SPEC §3.0, §3.5). Create them with the caller's executor (inside its transaction when
 * there is one) and publish to live streams only after that transaction has committed:
 *
 *   const notification = await ctx.db.transaction((tx) => doWork(tx)); // doWork calls createNotification(tx, …)
 *   publishNotification(ctx.bus, recipientId, notification);
 *
 * Every read and write is scoped to the recipient (`WHERE user_id = me`).
 */
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { LIST_CAPS, type Notification, type NotificationKind, type NotificationList, type UnreadCount } from '@loopin/shared';
import type { Executor } from '../context';
import { notifications, users } from '../db/schema';
import type { Bus } from '../lib/bus';
import { toNotification, userLiteColumns } from './serializers';

/** A single leading "/" not followed by another "/" or "\" (never an external or protocol-relative URL). */
const IN_APP_PATH = /^\/(?![/\\])/;

export interface NotificationInput {
  /** The recipient. */
  userId: string;
  kind: NotificationKind;
  /** The person who caused it (shown with an avatar), if any. */
  actorId?: string | null;
  title: string;
  body: string;
  /** In-app path to open, e.g. `/network/<connection id>`, or null. */
  link: string | null;
}

export async function createNotification(ex: Executor, input: NotificationInput): Promise<Notification> {
  if (input.link !== null && !IN_APP_PATH.test(input.link)) {
    throw new Error('Notification links must be in-app paths starting with a single "/"');
  }
  const [notification] = await ex
    .insert(notifications)
    .values({
      userId: input.userId,
      kind: input.kind,
      actorId: input.actorId ?? null,
      title: input.title,
      body: input.body,
      link: input.link,
    })
    .returning();
  if (!notification) throw new Error('Notification insert returned no row');
  const [actor] = notification.actorId
    ? await ex.select(userLiteColumns(users)).from(users).where(eq(users.id, notification.actorId)).limit(1)
    : [];
  return toNotification({ notification, actor: actor ?? null });
}

/** Push a created notification to the recipient's open streams. Call after the creating transaction committed. */
export function publishNotification(bus: Pick<Bus, 'publishToUser'>, userId: string, notification: Notification): void {
  bus.publishToUser(userId, { type: 'notification', notification });
}

/** The recipient's notifications, newest first; all of them when `limit` is omitted or null (account export). */
export async function loadNotifications(ex: Executor, userId: string, { limit }: { limit?: number | null } = {}): Promise<Notification[]> {
  const query = ex
    .select({ notification: notifications, actor: userLiteColumns(users) })
    .from(notifications)
    .leftJoin(users, eq(users.id, notifications.actorId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .$dynamic();
  const rows = await (limit === undefined || limit === null ? query : query.limit(limit));
  return rows.map((row) => toNotification(row));
}

export async function getUnreadCount(ex: Executor, userId: string): Promise<number> {
  const [row] = await ex
    .select({ unread: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.unread ?? 0;
}

/** GET /notifications: the latest LIST_CAPS.notifications plus the total unread count. */
export async function listNotifications(ex: Executor, userId: string): Promise<NotificationList> {
  const [items, unreadCount] = await Promise.all([
    loadNotifications(ex, userId, { limit: LIST_CAPS.notifications }),
    getUnreadCount(ex, userId),
  ]);
  return { notifications: items, unreadCount };
}

/**
 * Mark the recipient's notifications read: the given ids (ids of other people's notifications are ignored), or
 * all of them when `ids` is undefined. An empty array marks nothing.
 */
export async function markRead(ex: Executor, userId: string, ids?: readonly string[]): Promise<UnreadCount> {
  if (ids === undefined || ids.length > 0) {
    await ex
      .update(notifications)
      .set({ readAt: sql`now()` })
      .where(
        and(
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
          ids === undefined ? undefined : inArray(notifications.id, [...ids]),
        ),
      );
  }
  return { unreadCount: await getUnreadCount(ex, userId) };
}

/**
 * Plain one-line preview of user-written text for a notification body: whitespace collapsed, at most `max`
 * characters including the trailing "…" (vouch notifications use 140).
 */
export function excerpt(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const chars = Array.from(flat);
  if (chars.length <= max) return flat;
  return `${chars.slice(0, Math.max(0, max - 1)).join('').trimEnd()}…`;
}
