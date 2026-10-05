/**
 * Database schema (SPEC §3.2). Owned by the foundation agent: change it only through the orchestrator, then
 * run `npm run db:generate -w @loopin/server` to produce a new migration in server/drizzle/.
 *
 * Conventions: uuid primary keys, timestamptz everywhere, every column and constraint named explicitly,
 * value lists for CHECK constraints generated from the shared contract so the two cannot drift.
 * Only PostgreSQL 15+ features (production may run PG 15–17; PGlite is PG 18).
 */
import { sql, type SQL } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import {
  ANNOUNCEMENT_KIND_VALUES,
  AWARD_PLACEMENT_VALUES,
  CONNECTION_SOURCES,
  CREDENTIAL_TYPES,
  EVENT_KIND_VALUES,
  HANDLE_PATTERN,
  NOTIFICATION_KINDS,
  STAMP_ROLE_VALUES,
  USER_ROLES,
  VISIBILITY_VALUES,
  type OpenTo,
  type Skill,
} from '@loopin/shared';

const ONE_TIME_TOKEN_PURPOSES = ['password_reset', 'oauth_login', 'oauth_signup', 'oauth_linked'] as const;
export type OneTimeTokenPurpose = (typeof ONE_TIME_TOKEN_PURPOSES)[number];

/** `<column> in ('a', 'b')` for CHECK constraints (the values are trusted constants without quotes). */
function oneOf(column: AnyPgColumn, values: readonly string[]): SQL {
  return sql`${column} in (${sql.raw(values.map((value) => `'${value}'`).join(', '))})`;
}

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => timestamptz('created_at').notNull().defaultNow();
/** Set to now() by drizzle on every UPDATE issued through the query builder. */
const updatedAt = () =>
  timestamptz('updated_at')
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    githubId: text('github_id'),
    emailVerifiedAt: timestamptz('email_verified_at'),
    handle: text('handle').notNull(),
    name: text('name').notNull(),
    headline: text('headline').notNull().default(''),
    bio: text('bio').notNull().default(''),
    location: text('location').notNull().default(''),
    avatarUrl: text('avatar_url'),
    githubUsername: text('github_username'),
    linkedinUrl: text('linkedin_url'),
    websiteUrl: text('website_url'),
    contactEmail: text('contact_email'),
    phone: text('phone'),
    skills: jsonb('skills').$type<Skill[]>().notNull().default([]),
    openTo: text('open_to').array().$type<OpenTo[]>().notNull().default(sql`'{}'::text[]`),
    role: text('role', { enum: USER_ROLES }).notNull().default('member'),
    visibility: text('visibility', { enum: VISIBILITY_VALUES }).notNull().default('public'),
    /** Random id embedded in QR codes only; rotating it invalidates every code and connect ticket. */
    badgeId: uuid('badge_id').notNull().defaultRandom(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('users_email_unique').on(t.email),
    unique('users_handle_unique').on(t.handle),
    unique('users_github_id_unique').on(t.githubId),
    unique('users_badge_id_unique').on(t.badgeId),
    check('users_email_lowercase_check', sql`${t.email} = lower(${t.email})`),
    check('users_handle_format_check', sql`${t.handle} ~ ${sql.raw(`'${HANDLE_PATTERN.source}'`)}`),
    check('users_role_check', oneOf(t.role, USER_ROLES)),
    check('users_visibility_check', oneOf(t.visibility, VISIBILITY_VALUES)),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** sha256 hex of the bearer token; the raw token is never stored. */
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastUsedAt: timestamptz('last_used_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at').notNull(),
  },
  (t) => [unique('sessions_token_hash_unique').on(t.tokenHash), index('sessions_user_id_idx').on(t.userId)],
);

export const oneTimeTokens = pgTable(
  'one_time_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text('purpose', { enum: ONE_TIME_TOKEN_PURPOSES }).notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamptz('expires_at').notNull(),
    usedAt: timestamptz('used_at'),
    createdAt: createdAt(),
  },
  (t) => [
    unique('one_time_tokens_token_hash_unique').on(t.tokenHash),
    index('one_time_tokens_user_purpose_created_idx').on(t.userId, t.purpose, t.createdAt),
    check('one_time_tokens_purpose_check', oneOf(t.purpose, ONE_TIME_TOKEN_PURPOSES)),
  ],
);

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    tagline: text('tagline').notNull().default(''),
    description: text('description').notNull().default(''),
    location: text('location').notNull().default(''),
    kind: text('kind', { enum: EVENT_KIND_VALUES }).notNull(),
    startsAt: timestamptz('starts_at').notNull(),
    endsAt: timestamptz('ends_at').notNull(),
    /** Organizer toggle. Effective "active" = is_active AND ends_at > now(). */
    isActive: boolean('is_active').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('events_slug_unique').on(t.slug),
    check('events_kind_check', oneOf(t.kind, EVENT_KIND_VALUES)),
    check('events_ends_after_starts_check', sql`${t.endsAt} > ${t.startsAt}`),
  ],
);

export const rsvps = pgTable(
  'rsvps',
  {
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ name: 'rsvps_pk', columns: [t.eventId, t.userId] })],
);

/** One row per direction: (owner → peer) carries the owner's private notes/tags. Mutual = both rows exist. */
export const connections = pgTable(
  'connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    peerId: uuid('peer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** The event where they met ("met at"). */
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    notes: text('notes').notNull().default(''),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    source: text('source', { enum: CONNECTION_SOURCES }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('connections_owner_peer_uq').on(t.ownerId, t.peerId),
    index('connections_peer_id_idx').on(t.peerId),
    check('connections_source_check', oneOf(t.source, CONNECTION_SOURCES)),
    check('connections_not_self_check', sql`${t.ownerId} <> ${t.peerId}`),
  ],
);

export const vouches = pgTable(
  'vouches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    voucherId: uuid('voucher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skill: text('skill').notNull(),
    message: text('message').notNull(),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('vouches_pair_skill_uq').on(t.voucherId, t.recipientId, sql`lower(${t.skill})`),
    index('vouches_recipient_id_idx').on(t.recipientId),
  ],
);

/** Organizer-issued, Ed25519-signed stamps and awards. `payload` is the exact canonical JSON that was signed. */
export const credentials = pgTable(
  'credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type', { enum: CREDENTIAL_TYPES }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // RESTRICT: an event that has issued credentials can't be deleted (organizers deactivate it instead).
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'restrict' }),
    issuedBy: uuid('issued_by').references(() => users.id, { onDelete: 'set null' }),
    role: text('role', { enum: STAMP_ROLE_VALUES }),
    placement: text('placement', { enum: AWARD_PLACEMENT_VALUES }),
    track: text('track'),
    projectName: text('project_name'),
    projectUrl: text('project_url'),
    payload: text('payload').notNull(),
    signature: text('signature').notNull(),
    keyId: text('key_id').notNull(),
    /** Written explicitly: always equal to the signed payload's issuedAt. */
    issuedAt: timestamptz('issued_at').notNull(),
    revokedAt: timestamptz('revoked_at'),
  },
  (t) => [
    uniqueIndex('credentials_live_stamp_uq')
      .on(t.userId, t.eventId, t.role)
      .where(sql`${t.type} = 'stamp' and ${t.revokedAt} is null`),
    uniqueIndex('credentials_live_award_uq')
      .on(t.userId, t.eventId, t.placement, sql`coalesce(${t.track}, '')`)
      .where(sql`${t.type} = 'award' and ${t.revokedAt} is null`),
    index('credentials_user_id_idx').on(t.userId),
    index('credentials_event_id_idx').on(t.eventId),
    check('credentials_type_check', oneOf(t.type, CREDENTIAL_TYPES)),
  ],
);

/** Public organizer broadcasts; event_id NULL = global. */
export const announcements = pgTable(
  'announcements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    kind: text('kind', { enum: ANNOUNCEMENT_KIND_VALUES }).notNull(),
    urgent: boolean('urgent').notNull().default(false),
    actionLabel: text('action_label'),
    actionUrl: text('action_url'),
    location: text('location'),
    createdAt: createdAt(),
  },
  (t) => [
    index('announcements_created_at_idx').on(t.createdAt),
    index('announcements_event_id_created_at_idx').on(t.eventId, t.createdAt),
    check('announcements_kind_check', oneOf(t.kind, ANNOUNCEMENT_KIND_VALUES)),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: NOTIFICATION_KINDS }).notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    /** In-app path ("/network/<id>"); always starts with a single "/". */
    link: text('link'),
    readAt: timestamptz('read_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_user_id_created_at_idx').on(t.userId, t.createdAt),
    check('notifications_kind_check', oneOf(t.kind, NOTIFICATION_KINDS)),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type OneTimeTokenRow = typeof oneTimeTokens.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type RsvpRow = typeof rsvps.$inferSelect;
export type ConnectionRow = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
export type VouchRow = typeof vouches.$inferSelect;
export type CredentialRow = typeof credentials.$inferSelect;
export type NewCredential = typeof credentials.$inferInsert;
export type AnnouncementRow = typeof announcements.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
