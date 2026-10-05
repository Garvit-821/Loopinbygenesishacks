/**
 * Row → DTO mappers for every response shape in @loopin/shared, plus the column selections that load their
 * inputs. A select shaped like a `…Join` interface below can be passed straight to its serializer:
 *
 *   const rows = await ex
 *     .select({ announcement: announcements, event: eventLiteColumns, author: userLiteColumns(users) })
 *     .from(announcements)
 *     .leftJoin(events, eq(events.id, announcements.eventId))
 *     .leftJoin(users, eq(users.id, announcements.authorId));
 *   rows.map((row) => toAnnouncement(row));
 *
 * Rules (SPEC §3.4, §3.6):
 *  - DTOs are built field by field, never by spreading a row, so columns such as password_hash, github_id,
 *    badge_id or email can never leak into a response.
 *  - Timestamps are ISO-8601 UTC strings; avatarUrl falls back to the GitHub avatar.
 *  - Public views show 'admin' as 'organizer'; only Me and AdminUser carry the real role.
 *  - A connections-only person's headline is shown only to audiences entitled to their full passport.
 *  - EventLite.isActive is the *effective* state: the organizer toggle AND not yet ended.
 */
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type {
  AdminUser,
  Announcement,
  ConnectionPeer,
  ConnectionSummary,
  ContactInfo,
  Credential,
  EventLite,
  EventSummary,
  IssuedCredential,
  Me,
  Notification,
  PublicUser,
  Skill,
  UserLite,
  UserRole,
  Vouch,
} from '@loopin/shared';
import {
  credentials,
  events,
  type AnnouncementRow,
  type ConnectionRow,
  type CredentialRow,
  type EventRow,
  type NotificationRow,
  type UserRow,
  type VouchRow,
} from '../db/schema';
import { iso, isoOrNull } from '../lib/time';

// ---------------------------------------------------------------------------
// Serializer inputs (the columns each DTO needs)
// ---------------------------------------------------------------------------

export type UserLiteRow = Pick<UserRow, 'id' | 'handle' | 'name' | 'headline' | 'avatarUrl' | 'githubUsername' | 'visibility'>;
export type PublicUserRow = UserLiteRow &
  Pick<UserRow, 'bio' | 'location' | 'linkedinUrl' | 'websiteUrl' | 'skills' | 'openTo' | 'role' | 'createdAt'>;
export type ContactRow = Pick<UserRow, 'contactEmail' | 'phone'>;
export type MeRow = PublicUserRow & ContactRow & Pick<UserRow, 'email' | 'emailVerifiedAt' | 'passwordHash' | 'githubId'>;
export type AdminUserRow = UserLiteRow & Pick<UserRow, 'email' | 'role' | 'createdAt'>;
export type ConnectionPeerRow = UserLiteRow & ContactRow & Pick<UserRow, 'openTo' | 'location' | 'linkedinUrl' | 'websiteUrl'>;
export type EventLiteRow = Pick<EventRow, 'id' | 'slug' | 'name' | 'kind' | 'location' | 'startsAt' | 'endsAt' | 'isActive'>;
export type EventSummaryRow = EventLiteRow & Pick<EventRow, 'tagline' | 'description'>;
export type CredentialViewRow = Pick<
  CredentialRow,
  'id' | 'type' | 'role' | 'placement' | 'track' | 'projectName' | 'projectUrl' | 'issuedAt' | 'revokedAt'
>;
export type VouchViewRow = Pick<VouchRow, 'id' | 'recipientId' | 'skill' | 'message' | 'createdAt'>;
export type AnnouncementViewRow = Pick<
  AnnouncementRow,
  'id' | 'title' | 'body' | 'kind' | 'urgent' | 'actionLabel' | 'actionUrl' | 'location' | 'createdAt'
>;
export type NotificationViewRow = Pick<NotificationRow, 'id' | 'kind' | 'title' | 'body' | 'link' | 'readAt' | 'createdAt'>;
export type ConnectionViewRow = Pick<ConnectionRow, 'id' | 'notes' | 'tags' | 'source' | 'createdAt' | 'updatedAt'>;

export interface EventSummaryJoin {
  event: EventSummaryRow;
  rsvpCount: number;
  myRsvp: boolean;
}

export interface CredentialJoin {
  credential: CredentialViewRow;
  event: EventLiteRow;
  issuer: UserLiteRow | null;
}

export interface IssuedCredentialJoin extends CredentialJoin {
  holder: UserLiteRow;
}

export interface VouchJoin {
  vouch: VouchViewRow;
  voucher: UserLiteRow;
  event: EventLiteRow | null;
}

export interface AnnouncementJoin {
  announcement: AnnouncementViewRow;
  event: EventLiteRow | null;
  author: UserLiteRow | null;
}

export interface NotificationJoin {
  notification: NotificationViewRow;
  actor: UserLiteRow | null;
}

export interface ConnectionJoin {
  connection: ConnectionViewRow;
  peer: ConnectionPeerRow;
  event: EventLiteRow | null;
  /** The peer's row back to the owner exists. */
  mutual: boolean;
}

// ---------------------------------------------------------------------------
// Column selections
// ---------------------------------------------------------------------------
// drizzle turns a left-joined nested object into null when its FIRST column is null, so every selection starts
// with the table's NOT NULL id.

type UserLiteKey = keyof UserLiteRow;

/** UserLiteRow columns of `users` or of an alias such as `alias(users, 'issuer')`. */
export function userLiteColumns<T extends Record<UserLiteKey, AnyPgColumn>>(table: T): Pick<T, UserLiteKey> {
  return {
    id: table.id,
    handle: table.handle,
    name: table.name,
    headline: table.headline,
    avatarUrl: table.avatarUrl,
    githubUsername: table.githubUsername,
    visibility: table.visibility,
  };
}

export const eventLiteColumns = {
  id: events.id,
  slug: events.slug,
  name: events.name,
  kind: events.kind,
  location: events.location,
  startsAt: events.startsAt,
  endsAt: events.endsAt,
  isActive: events.isActive,
};

export const eventSummaryColumns = {
  ...eventLiteColumns,
  tagline: events.tagline,
  description: events.description,
};

/** Everything a Credential DTO needs (not the signed payload or signature). */
export const credentialViewColumns = {
  id: credentials.id,
  type: credentials.type,
  role: credentials.role,
  placement: credentials.placement,
  track: credentials.track,
  projectName: credentials.projectName,
  projectUrl: credentials.projectUrl,
  issuedAt: credentials.issuedAt,
  revokedAt: credentials.revokedAt,
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/**
 * Who will see a UserLite. `anyone` (the default, for lists and attributions where the viewer's relationship is
 * not checked) hides a connections-only person's headline; `entitled` is for viewers allowed to see their full
 * passport: themself, a mutual connection, or an admin.
 */
export type Audience = 'anyone' | 'entitled';

/** The explicit photo, else the GitHub avatar when a GitHub username is set, else null. */
export function avatarUrlOf(user: Pick<UserRow, 'avatarUrl' | 'githubUsername'>): string | null {
  if (user.avatarUrl) return user.avatarUrl;
  return user.githubUsername ? `https://github.com/${encodeURIComponent(user.githubUsername)}.png?size=200` : null;
}

/** Public views never reveal 'admin'. */
export function publicRole(role: UserRole): UserRole {
  return role === 'admin' ? 'organizer' : role;
}

export function toUserLite(user: UserLiteRow, audience: Audience = 'anyone'): UserLite {
  return {
    id: user.id,
    handle: user.handle,
    name: user.name,
    headline: audience === 'entitled' || user.visibility === 'public' ? user.headline : '',
    avatarUrl: avatarUrlOf(user),
  };
}

function toSkills(skills: readonly Skill[]): Skill[] {
  return Array.isArray(skills) ? skills.map(({ name, level }) => ({ name, level })) : [];
}

/**
 * The full passport identity. Build it only for viewers entitled to the full passport: themself, a mutual
 * connection, or anyone when the profile is public. The role is masked even for the user themself (their real
 * role comes from Me).
 */
export function toPublicUser(user: PublicUserRow): PublicUser {
  return {
    ...toUserLite(user, 'entitled'),
    bio: user.bio,
    location: user.location,
    githubUsername: user.githubUsername,
    linkedinUrl: user.linkedinUrl,
    websiteUrl: user.websiteUrl,
    skills: toSkills(user.skills),
    openTo: [...user.openTo],
    role: publicRole(user.role),
    createdAt: iso(user.createdAt),
  };
}

/** Only for the user themself and their mutual connections. */
export function toContactInfo(user: ContactRow): ContactInfo {
  return { contactEmail: user.contactEmail, phone: user.phone };
}

export function toMe(user: MeRow): Me {
  return {
    ...toPublicUser(user),
    role: user.role,
    ...toContactInfo(user),
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    visibility: user.visibility,
    hasPassword: user.passwordHash !== null,
    githubLinked: user.githubId !== null,
  };
}

export function toAdminUser(user: AdminUserRow): AdminUser {
  return {
    ...toUserLite(user, 'entitled'),
    email: user.email,
    role: user.role,
    createdAt: iso(user.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/** Effective active: the organizer toggle is on AND the event hasn't ended. */
export function isEventActive(event: Pick<EventRow, 'isActive' | 'endsAt'>, nowMs: number = Date.now()): boolean {
  return event.isActive && event.endsAt.getTime() > nowMs;
}

export function toEventLite(event: EventLiteRow, nowMs: number = Date.now()): EventLite {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    kind: event.kind,
    location: event.location,
    startsAt: iso(event.startsAt),
    endsAt: iso(event.endsAt),
    isActive: isEventActive(event, nowMs),
  };
}

export function toEventSummary({ event, rsvpCount, myRsvp }: EventSummaryJoin, nowMs: number = Date.now()): EventSummary {
  return {
    ...toEventLite(event, nowMs),
    tagline: event.tagline,
    description: event.description,
    rsvpCount,
    myRsvp,
  };
}

// ---------------------------------------------------------------------------
// Credentials, vouches, announcements, notifications
// ---------------------------------------------------------------------------

export function toCredential({ credential, event, issuer }: CredentialJoin, nowMs: number = Date.now()): Credential {
  return {
    id: credential.id,
    type: credential.type,
    role: credential.role,
    placement: credential.placement,
    track: credential.track,
    projectName: credential.projectName,
    projectUrl: credential.projectUrl,
    event: toEventLite(event, nowMs),
    issuer: issuer ? toUserLite(issuer) : null,
    issuedAt: iso(credential.issuedAt),
    revokedAt: isoOrNull(credential.revokedAt),
  };
}

export function toIssuedCredential(join: IssuedCredentialJoin, nowMs: number = Date.now()): IssuedCredential {
  return { ...toCredential(join, nowMs), holder: toUserLite(join.holder) };
}

export function toVouch({ vouch, voucher, event }: VouchJoin, nowMs: number = Date.now()): Vouch {
  return {
    id: vouch.id,
    voucher: toUserLite(voucher),
    recipientId: vouch.recipientId,
    skill: vouch.skill,
    message: vouch.message,
    event: event ? toEventLite(event, nowMs) : null,
    createdAt: iso(vouch.createdAt),
  };
}

export function toAnnouncement({ announcement, event, author }: AnnouncementJoin, nowMs: number = Date.now()): Announcement {
  return {
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    kind: announcement.kind,
    urgent: announcement.urgent,
    actionLabel: announcement.actionLabel,
    actionUrl: announcement.actionUrl,
    location: announcement.location,
    event: event ? toEventLite(event, nowMs) : null,
    author: author ? toUserLite(author) : null,
    createdAt: iso(announcement.createdAt),
  };
}

export function toNotification({ notification, actor }: NotificationJoin): Notification {
  return {
    id: notification.id,
    kind: notification.kind,
    actor: actor ? toUserLite(actor) : null,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    readAt: isoOrNull(notification.readAt),
    createdAt: iso(notification.createdAt),
  };
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

/**
 * The person on the other end of a connection. Contact details only when mutual. When they are no longer
 * connected back and their passport is connections-only, only their name and photo remain (the same
 * restriction as their profile).
 */
export function toConnectionPeer(peer: ConnectionPeerRow, mutual: boolean): ConnectionPeer {
  if (!mutual && peer.visibility !== 'public') {
    return {
      ...toUserLite(peer),
      headline: '',
      openTo: [],
      location: '',
      githubUsername: null,
      linkedinUrl: null,
      websiteUrl: null,
      contact: null,
    };
  }
  return {
    ...toUserLite(peer, 'entitled'),
    openTo: [...peer.openTo],
    location: peer.location,
    githubUsername: peer.githubUsername,
    linkedinUrl: peer.linkedinUrl,
    websiteUrl: peer.websiteUrl,
    contact: mutual ? toContactInfo(peer) : null,
  };
}

export function toConnectionSummary({ connection, peer, event, mutual }: ConnectionJoin, nowMs: number = Date.now()): ConnectionSummary {
  return {
    id: connection.id,
    peer: toConnectionPeer(peer, mutual),
    notes: connection.notes,
    tags: [...connection.tags],
    event: event ? toEventLite(event, nowMs) : null,
    source: connection.source,
    mutual,
    createdAt: iso(connection.createdAt),
    updatedAt: iso(connection.updatedAt),
  };
}
