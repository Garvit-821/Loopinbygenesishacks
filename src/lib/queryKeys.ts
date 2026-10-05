/**
 * Every shared TanStack Query key. Keys are hierarchical, so invalidating a prefix covers its children:
 * `invalidateQueries({ queryKey: qk.events })` also refreshes event(id), eventStats(id), …, and qk.me (['me'])
 * is a prefix of badgeKey and myProfile — pass `exact: true` to target only the account.
 *
 * Persisted on the device (set `meta: { persist: true }` where the query is defined): me, badgeKey, myProfile,
 * connections, feed, events, providers. Feature-only keys live in the feature's api.ts.
 */
export const qk = {
  /** Cache holds `Me` (not MeResponse). */
  me: ['me'],
  badgeKey: ['me', 'badge-key'],
  myProfile: ['me', 'profile'],
  profile: (handle: string) => ['profiles', handle] as const,
  connections: ['connections'],
  connection: (id: string) => ['connections', id] as const,
  events: ['events'],
  event: (idOrSlug: string) => ['events', idOrSlug] as const,
  eventStats: (id: string) => ['events', id, 'stats'] as const,
  eventAttendees: (id: string) => ['events', id, 'attendees'] as const,
  eventCredentials: (id: string) => ['events', id, 'credentials'] as const,
  eventAnnouncements: (id: string) => ['events', id, 'announcements'] as const,
  organizerEvents: ['organizer', 'events'],
  feed: ['feed'],
  notifications: ['notifications'],
  providers: ['auth', 'providers'],
  handleAvailability: (handle: string) => ['auth', 'handle', handle] as const,
  badgePreview: (token: string) => ['badge-preview', token] as const,
  credential: (id: string) => ['credentials', id] as const,
  signingKey: ['keys'],
  adminUsers: (query: string) => ['admin', 'users', query] as const,
} as const;
