import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LIST_CAPS } from '@loopin/shared';
import { events, rsvps, type EventRow, type UserRow } from '../src/db/schema';
import { HttpError } from '../src/lib/errors';
import { DAY_MS, HOUR_MS } from '../src/lib/time';
import {
  UNKNOWN_EVENT_MESSAGE,
  activeEventOf,
  assertEventExists,
  getActiveEvent,
  getEventSummary,
  getRsvpState,
  loadEventSummaries,
} from '../src/services/events';
import { createEvent, createTestContext, createUser, type TestContext } from './helpers';

/** A fixed clock: every phase below is relative to it, independent of the real time. */
const NOW = Date.UTC(2030, 0, 15, 12);
const at = (offsetMs: number) => new Date(NOW + offsetMs);

let t: TestContext;
let viewer: UserRow;
let fixtures: Record<
  'activeNew' | 'activeOld' | 'endedButToggled' | 'runningNotToggled' | 'upcomingSoon' | 'upcomingLater' | 'pastRecent' | 'pastOld',
  EventRow
>;

beforeAll(async () => {
  t = await createTestContext();
  viewer = await createUser(t.db);
  const make = (name: string, startsAt: Date, endsAt: Date, isActive: boolean) =>
    createEvent(t.db, { slug: name.toLowerCase().replace(/[^a-z]+/g, '-'), name, startsAt, endsAt, isActive });
  fixtures = {
    activeOld: await make('Active Old', at(-2 * DAY_MS), at(DAY_MS), true),
    activeNew: await make('Active New', at(-HOUR_MS), at(5 * HOUR_MS), true),
    endedButToggled: await make('Ended But Toggled', at(-3 * DAY_MS), at(-HOUR_MS), true),
    runningNotToggled: await make('Running Not Toggled', at(-2 * HOUR_MS), at(2 * HOUR_MS), false),
    upcomingLater: await make('Upcoming Later', at(10 * DAY_MS), at(11 * DAY_MS), false),
    upcomingSoon: await make('Upcoming Soon', at(DAY_MS), at(2 * DAY_MS), false),
    pastRecent: await make('Past Recent', at(-5 * DAY_MS), at(-4 * DAY_MS), false),
    pastOld: await make('Past Old', at(-100 * DAY_MS), at(-99 * DAY_MS), false),
  };
  const going = [viewer, await createUser(t.db), await createUser(t.db)];
  await t.db.insert(rsvps).values([
    ...going.map((user) => ({ eventId: fixtures.activeNew.id, userId: user.id })),
    { eventId: fixtures.upcomingSoon.id, userId: going[1].id },
  ]);
});
afterAll(() => t.close());

const namesOf = (list: { name: string }[]) => list.map((event) => event.name);

describe('getActiveEvent', () => {
  it('is the effective-active event with the latest start', async () => {
    expect((await getActiveEvent(t.db, NOW))?.id).toBe(fixtures.activeNew.id);
  });

  it('ignores events that ended even when the toggle is still on', async () => {
    // After Active New ends, Active Old (still running) takes over; once both end there is none.
    expect((await getActiveEvent(t.db, NOW + 6 * HOUR_MS))?.id).toBe(fixtures.activeOld.id);
    expect(await getActiveEvent(t.db, NOW + 2 * DAY_MS)).toBeNull();
  });
});

describe('loadEventSummaries', () => {
  it("'all': active (latest start first), then upcoming (soonest first), then past (most recent first)", async () => {
    const list = await loadEventSummaries(t.db, { scope: 'all', nowMs: NOW }, null);
    expect(namesOf(list)).toEqual([
      'Active New',
      'Active Old',
      'Running Not Toggled',
      'Upcoming Soon',
      'Upcoming Later',
      'Ended But Toggled',
      'Past Recent',
      'Past Old',
    ]);
    expect(list.map((event) => event.isActive)).toEqual([true, true, false, false, false, false, false, false]);
  });

  it("'feed': active and upcoming only", async () => {
    const list = await loadEventSummaries(t.db, { scope: 'feed', nowMs: NOW }, viewer.id);
    expect(namesOf(list)).toEqual(['Active New', 'Active Old', 'Running Not Toggled', 'Upcoming Soon', 'Upcoming Later']);
  });

  it('counts RSVPs and reports the viewer’s own RSVP (false when anonymous)', async () => {
    const anonymous = await loadEventSummaries(t.db, { scope: 'feed', nowMs: NOW }, null);
    const mine = await loadEventSummaries(t.db, { scope: 'feed', nowMs: NOW }, viewer.id);
    const someoneElse = await loadEventSummaries(t.db, { scope: 'feed', nowMs: NOW }, (await createUser(t.db)).id);
    const pick = (list: typeof mine, id: string) => list.find((event) => event.id === id);

    expect(pick(anonymous, fixtures.activeNew.id)).toMatchObject({ rsvpCount: 3, myRsvp: false });
    expect(pick(mine, fixtures.activeNew.id)).toMatchObject({ rsvpCount: 3, myRsvp: true });
    expect(pick(someoneElse, fixtures.activeNew.id)).toMatchObject({ rsvpCount: 3, myRsvp: false });
    expect(pick(mine, fixtures.upcomingSoon.id)).toMatchObject({ rsvpCount: 1, myRsvp: false });
    expect(pick(mine, fixtures.upcomingLater.id)).toMatchObject({ rsvpCount: 0, myRsvp: false });
    for (const event of mine) expect(typeof event.rsvpCount).toBe('number');
  });

  it('returns complete summaries with ISO timestamps', async () => {
    const [first] = await loadEventSummaries(t.db, { scope: 'all', nowMs: NOW }, viewer.id);
    expect(first).toEqual({
      id: fixtures.activeNew.id,
      slug: 'active-new',
      name: 'Active New',
      kind: 'hackathon',
      location: '',
      startsAt: at(-HOUR_MS).toISOString(),
      endsAt: at(5 * HOUR_MS).toISOString(),
      isActive: true,
      tagline: '',
      description: '',
      rsvpCount: 3,
      myRsvp: true,
    });
  });

  it('honours an explicit limit, or none', async () => {
    expect(namesOf(await loadEventSummaries(t.db, { scope: 'all', nowMs: NOW, limit: 2 }, null))).toEqual(['Active New', 'Active Old']);
    expect(await loadEventSummaries(t.db, { scope: 'all', nowMs: NOW, limit: null }, null)).toHaveLength(8);
  });
});

describe('activeEventOf', () => {
  it('is the head of a summary list when it is active', async () => {
    expect(activeEventOf(await loadEventSummaries(t.db, { scope: 'feed', nowMs: NOW }, null))?.id).toBe(fixtures.activeNew.id);
    // Two days later nothing is active any more: the list starts with an upcoming event.
    const later = await loadEventSummaries(t.db, { scope: 'feed', nowMs: NOW + 2 * DAY_MS }, null);
    expect(later.length).toBeGreaterThan(0);
    expect(activeEventOf(later)).toBeNull();
    expect(activeEventOf([])).toBeNull();
  });

  it('breaks start-time ties exactly like getActiveEvent', async () => {
    // A time window where only these two events are active. They are toggled on, so they would count as active
    // at NOW as well (toggle AND not ended): roll them back so the other tests keep their fixtures.
    const windowStart = NOW + 1000 * DAY_MS;
    const rolledBack = new Error('rollback');
    const outcome = t.db.transaction(async (tx) => {
      const twins = [
        await createEvent(tx, { startsAt: new Date(windowStart - HOUR_MS), endsAt: new Date(windowStart + HOUR_MS), isActive: true }),
        await createEvent(tx, { startsAt: new Date(windowStart - HOUR_MS), endsAt: new Date(windowStart + HOUR_MS), isActive: true }),
      ];
      const expected = [...twins].sort((a, b) => (a.id < b.id ? -1 : 1))[0]?.id;
      expect((await getActiveEvent(tx, windowStart))?.id).toBe(expected);
      expect(activeEventOf(await loadEventSummaries(tx, { scope: 'feed', nowMs: windowStart }, null))?.id).toBe(expected);
      throw rolledBack;
    });
    await expect(outcome).rejects.toBe(rolledBack);
  });
});

describe('getEventSummary', () => {
  it('finds an event by id or by slug, case-insensitively', async () => {
    const { id } = fixtures.upcomingSoon;
    for (const key of [id, id.toUpperCase(), 'upcoming-soon', 'Upcoming-Soon']) {
      expect(await getEventSummary(t.db, key, viewer.id, NOW)).toMatchObject({ id, name: 'Upcoming Soon', isActive: false, rsvpCount: 1, myRsvp: false });
    }
    expect(await getEventSummary(t.db, fixtures.activeNew.id, viewer.id, NOW)).toMatchObject({ isActive: true, rsvpCount: 3, myRsvp: true });
  });

  it('is null for an unknown id or slug', async () => {
    expect(await getEventSummary(t.db, '00000000-0000-4000-8000-000000000000', null, NOW)).toBeNull();
    expect(await getEventSummary(t.db, 'no-such-event', null, NOW)).toBeNull();
  });
});

describe('assertEventExists', () => {
  it('returns the event', async () => {
    expect((await assertEventExists(t.db, fixtures.pastOld.id)).name).toBe('Past Old');
  });

  it('rejects an unknown event with 400 bad_request', async () => {
    const error = await assertEventExists(t.db, '00000000-0000-4000-8000-000000000000').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 400, code: 'bad_request', message: UNKNOWN_EVENT_MESSAGE, fields: { eventId: UNKNOWN_EVENT_MESSAGE } });
    expect(UNKNOWN_EVENT_MESSAGE).toBe("That event doesn't exist");
  });
});

describe('getRsvpState', () => {
  it('reports the count and whether the viewer is going', async () => {
    expect(await getRsvpState(t.db, fixtures.activeNew.id, viewer.id)).toEqual({ rsvpCount: 3, myRsvp: true });
    expect(await getRsvpState(t.db, fixtures.activeNew.id, null)).toEqual({ rsvpCount: 3, myRsvp: false });
    expect(await getRsvpState(t.db, fixtures.pastOld.id, viewer.id)).toEqual({ rsvpCount: 0, myRsvp: false });
  });
});

describe('list caps', () => {
  it('caps /events at LIST_CAPS.events and the feed at LIST_CAPS.feedEvents by default', async () => {
    await t.db.insert(events).values(
      Array.from({ length: LIST_CAPS.events + 5 }, (_, i) => ({
        slug: `bulk-${i}`,
        name: `Bulk ${i}`,
        kind: 'meetup' as const,
        startsAt: at((i + 1) * HOUR_MS),
        endsAt: at((i + 2) * HOUR_MS),
      })),
    );
    expect(await loadEventSummaries(t.db, { scope: 'all', nowMs: NOW }, null)).toHaveLength(LIST_CAPS.events);
    const feed = await loadEventSummaries(t.db, { scope: 'feed', nowMs: NOW }, null);
    expect(feed).toHaveLength(LIST_CAPS.feedEvents);
    expect(namesOf(feed).slice(0, 3)).toEqual(['Active New', 'Active Old', 'Running Not Toggled']);
  });
});
