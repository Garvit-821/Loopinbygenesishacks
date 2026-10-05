/**
 * Events read model (SPEC §2, §3.5): the active event, existence checks for referenced events, and event
 * summaries with RSVP counts.
 *
 * Phases: *active* = is_active AND ends_at > now · *upcoming* = not active AND ends_at >= now · *past* = ends_at < now.
 * The active event is the active one with the latest starts_at; lists put it first. starts_at plays no part in
 * the phase: switching an event on before it starts makes it active right away (the organizer's call).
 */
import { and, asc, desc, eq, gt, sql, type SQL } from 'drizzle-orm';
import { LIST_CAPS, isUuid, type EventSummary, type RsvpState } from '@loopin/shared';
import type { Executor } from '../context';
import { events, rsvps, type EventRow } from '../db/schema';
import { badRequest } from '../lib/errors';
import { eventSummaryColumns, toEventSummary } from './serializers';

export const UNKNOWN_EVENT_MESSAGE = "That event doesn't exist";

/** The effective-active event with the latest start (ties broken by id), or null. */
export async function getActiveEvent(ex: Executor, nowMs: number = Date.now()): Promise<EventRow | null> {
  const [event] = await ex
    .select()
    .from(events)
    .where(and(eq(events.isActive, true), gt(events.endsAt, new Date(nowMs))))
    .orderBy(desc(events.startsAt), asc(events.id))
    .limit(1);
  return event ?? null;
}

/** The event a request refers to (an `eventId` in a body); 400 bad_request with `fields.eventId` when it doesn't exist. */
export async function assertEventExists(ex: Executor, eventId: string): Promise<EventRow> {
  const [event] = await ex.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) throw badRequest(UNKNOWN_EVENT_MESSAGE, { eventId: UNKNOWN_EVENT_MESSAGE });
  return event;
}

function timestampParam(nowMs: number): SQL {
  return sql`${new Date(nowMs).toISOString()}::timestamptz`;
}

/** 0 = active, 1 = upcoming, 2 = past. */
function phaseOf(now: SQL): SQL<number> {
  return sql<number>`case when ${events.isActive} and ${events.endsAt} > ${now} then 0 when ${events.endsAt} >= ${now} then 1 else 2 end`;
}

/** Event summary columns plus the RSVP count and the viewer's own RSVP, in one query. */
function selectEventSummaries(ex: Executor, viewerId: string | null) {
  const rsvpCount = sql<number>`(select count(*)::int from ${rsvps} where ${rsvps.eventId} = ${events.id})`;
  const myRsvp =
    viewerId === null
      ? sql<boolean>`false`
      : sql<boolean>`exists (select 1 from ${rsvps} where ${rsvps.eventId} = ${events.id} and ${rsvps.userId} = ${viewerId})`;
  return ex.select({ event: eventSummaryColumns, rsvpCount, myRsvp }).from(events).$dynamic();
}

export interface EventListOptions {
  /** 'all': active, then upcoming (soonest first), then past (most recent first). 'feed': active and upcoming only. */
  scope: 'all' | 'feed';
  /** Defaults to LIST_CAPS.events ('all') or LIST_CAPS.feedEvents ('feed'); null = every event. */
  limit?: number | null;
  nowMs?: number;
}

/**
 * Event summaries in display order (GET /events, GET /feed, GET /organizer/events). Active events come first,
 * latest start first, so the first summary with `isActive` is the active event. `viewerId` null = anonymous
 * (myRsvp false).
 */
export async function loadEventSummaries(
  ex: Executor,
  { scope, limit, nowMs = Date.now() }: EventListOptions,
  viewerId: string | null,
): Promise<EventSummary[]> {
  const now = timestampParam(nowMs);
  const phase = phaseOf(now);
  const query = selectEventSummaries(ex, viewerId)
    .where(scope === 'feed' ? sql`${events.endsAt} >= ${now}` : undefined)
    .orderBy(
      phase,
      sql`case when ${phase} = 0 then ${events.startsAt} end desc`,
      sql`case when ${phase} = 1 then ${events.startsAt} end asc`,
      sql`case when ${phase} = 2 then ${events.startsAt} end desc`,
      asc(events.id),
    );
  const cap = limit === undefined ? (scope === 'feed' ? LIST_CAPS.feedEvents : LIST_CAPS.events) : limit;
  const rows = await (cap === null ? query : query.limit(cap));
  return rows.map((row) => toEventSummary(row, nowMs));
}

/**
 * The active event of a list from loadEventSummaries (Feed.activeEvent): active events sort first, latest start
 * first, with the same tie-break as getActiveEvent, so it is the head of the list when that one is active.
 */
export function activeEventOf<T extends Pick<EventSummary, 'isActive'>>(summaries: readonly T[]): T | null {
  const [first] = summaries;
  return first?.isActive ? first : null;
}

/** One event by id or slug (GET /events/:idOrSlug), or null. Slugs never look like UUIDs, so the two can't clash. */
export async function getEventSummary(
  ex: Executor,
  idOrSlug: string,
  viewerId: string | null,
  nowMs: number = Date.now(),
): Promise<EventSummary | null> {
  const key = idOrSlug.toLowerCase();
  const [row] = await selectEventSummaries(ex, viewerId)
    .where(isUuid(key) ? eq(events.id, key) : eq(events.slug, key))
    .limit(1);
  return row ? toEventSummary(row, nowMs) : null;
}

/** RSVP count of an event and whether the viewer is going (after PUT/DELETE /events/:id/rsvp). */
export async function getRsvpState(ex: Executor, eventId: string, viewerId: string | null): Promise<RsvpState> {
  const myRsvp = viewerId === null ? sql<boolean>`false` : sql<boolean>`coalesce(bool_or(${rsvps.userId} = ${viewerId}), false)`;
  const [row] = await ex
    .select({ rsvpCount: sql<number>`count(*)::int`, myRsvp })
    .from(rsvps)
    .where(eq(rsvps.eventId, eventId));
  return { rsvpCount: row?.rsvpCount ?? 0, myRsvp: row?.myRsvp ?? false };
}
