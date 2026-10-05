import type { EventList, EventLite, EventResponse, EventSummary, Feed } from '@loopin/shared';
import { skipToken, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { qk } from '@/lib/queryKeys';

const selectEvents = (data: EventList): EventSummary[] => data.events;
const selectEvent = (data: EventResponse): EventSummary => data.event;

/** Events for pickers and lists: active first, then upcoming (soonest first), then past (cap 50). Persisted. */
export function useEvents() {
  return useQuery({
    queryKey: qk.events,
    queryFn: ({ signal }) => apiFetch<EventList>('/events', { signal }),
    meta: { persist: true },
    select: selectEvents,
  });
}

/** One event by id or slug; shows the copy already in the events list while it loads. Pass null to skip. */
export function useEvent(idOrSlug: string | null | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.event(idOrSlug ?? ''),
    queryFn: idOrSlug
      ? ({ signal }) => apiFetch<EventResponse>(`/events/${encodeURIComponent(idOrSlug)}`, { signal })
      : skipToken,
    placeholderData: () => {
      const event = idOrSlug ? queryClient.getQueryData<EventList>(qk.events)?.events.find((e) => e.id === idOrSlug || e.slug === idOrSlug) : undefined;
      return event ? { event } : undefined;
    },
    select: selectEvent,
  });
}

function toEventLite(event: EventLite): EventLite {
  const { id, slug, name, kind, location, startsAt, endsAt, isActive } = event;
  return { id, slug, name, kind, location, startsAt, endsAt, isActive };
}

/** Look up an event already in the cache (events list or feed) — for optimistic updates that only know its id. */
export function findCachedEvent(queryClient: QueryClient, id: string): EventLite | null {
  const fromList = queryClient.getQueryData<EventList>(qk.events)?.events.find((event) => event.id === id);
  if (fromList) return toEventLite(fromList);
  const feed = queryClient.getQueryData<Feed>(qk.feed);
  const fromFeed = feed?.events.find((event) => event.id === id) ?? (feed?.activeEvent?.id === id ? feed.activeEvent : undefined);
  return fromFeed ? toEventLite(fromFeed) : null;
}
