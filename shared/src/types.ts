/**
 * Response shapes (DTOs) returned by the API. Timestamps are ISO-8601 strings in UTC ("…Z").
 * Handles never include the "@" — render them with formatHandle().
 *
 * Every route returns a *named* type from this file (server handlers end with `res.json(x satisfies T)`),
 * so the web app and server can never disagree about wrappers like `{ event }` vs a bare object.
 */
import type {
  AnnouncementKind,
  AwardPlacement,
  ConnectionSource,
  CredentialType,
  EventKind,
  NotificationKind,
  OpenTo,
  StampRole,
  UserRole,
  Visibility,
} from './constants';
import type { TierName } from './xp';

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface Skill {
  name: string;
  level: number;
}

/** Minimal identity used in lists, chips and attributions. */
export interface UserLite {
  id: string;
  handle: string;
  name: string;
  /** '' for restricted (connections-only) profiles seen by non-connections. */
  headline: string;
  /** Explicit photo URL, else `https://github.com/<githubUsername>.png?size=200` when a GitHub username is set, else null. */
  avatarUrl: string | null;
}

export interface PublicUser extends UserLite {
  bio: string;
  location: string;
  githubUsername: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  skills: Skill[];
  openTo: OpenTo[];
  /** Public views never reveal 'admin' (shown as 'organizer'); only Me and AdminUser carry the real role. */
  role: UserRole;
  createdAt: string;
}

/** Only ever shown to the user themself and to *mutual* connections. */
export interface ContactInfo {
  contactEmail: string | null;
  phone: string | null;
}

/** The signed-in account (GET /api/auth/me). */
export interface Me extends PublicUser, ContactInfo {
  email: string;
  /** True once the email is proven (verified GitHub email, or a completed password reset). */
  emailVerified: boolean;
  visibility: Visibility;
  hasPassword: boolean;
  githubLinked: boolean;
}

export interface MeResponse {
  user: Me;
}

export interface AuthResponse {
  token: string;
  user: Me;
  /** True when this request created the account (signup, or first GitHub sign-in) → client routes to onboarding. */
  isNewUser: boolean;
  /** True when a GitHub sign-in linked an existing account and removed its (unverified) password for safety. */
  passwordRemoved?: boolean;
}

export interface AuthProviders {
  github: boolean;
  /** True when "forgot password" can deliver a reset link (SMTP configured, or development console mode). */
  passwordReset: boolean;
}

export interface HandleAvailability {
  available: boolean;
  /** The normalised handle that was checked (lowercase, no "@"), when it was well-formed. */
  handle?: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface EventLite {
  id: string;
  slug: string;
  name: string;
  kind: EventKind;
  location: string;
  startsAt: string;
  endsAt: string;
  /** Organizer toggle AND not yet ended (is_active && ends_at > now). */
  isActive: boolean;
}

export interface EventSummary extends EventLite {
  tagline: string;
  description: string;
  rsvpCount: number;
  /** False when the request is anonymous. */
  myRsvp: boolean;
}

export interface EventList {
  events: EventSummary[];
}

export interface EventResponse {
  event: EventSummary;
}

export interface RsvpState {
  rsvpCount: number;
  myRsvp: boolean;
}

export interface EventStats {
  /** Non-revoked stamps issued at the event (one person can hold several roles). */
  checkIns: number;
  /** Distinct people holding at least one non-revoked stamp for the event. */
  attendees: number;
  rsvpCount: number;
  /** Exchanges (source 'scan') whose event is this event. */
  connectionsMade: number;
  /** Non-revoked awards. */
  awards: number;
  announcements: number;
}

/** Organizer home: every event with its stats in one request (GET /organizer/events). */
export interface OrganizerEvent extends EventSummary {
  stats: EventStats;
}

export interface OrganizerEventList {
  events: OrganizerEvent[];
}

// ---------------------------------------------------------------------------
// Credentials (stamps & awards)
// ---------------------------------------------------------------------------

export interface Credential {
  id: string;
  type: CredentialType;
  /** Set for stamps. */
  role: StampRole | null;
  /** Set for awards. */
  placement: AwardPlacement | null;
  track: string | null;
  projectName: string | null;
  projectUrl: string | null;
  event: EventLite;
  issuer: UserLite | null;
  issuedAt: string;
  revokedAt: string | null;
}

/** A credential together with the person who holds it (organizer views). */
export interface IssuedCredential extends Credential {
  holder: UserLite;
}

export interface IssuedCredentialList {
  credentials: IssuedCredential[];
}

/** POST /events/:id/awards — one credential per awarded handle. */
export interface AwardResult {
  credentials: IssuedCredential[];
}

export interface Attendee {
  user: UserLite;
  role: StampRole;
  credentialId: string;
  /** Equals the stamp credential's issuedAt. */
  stampedAt: string;
}

export interface AttendeeList {
  attendees: Attendee[];
}

export interface CheckInResult {
  credential: Credential;
  holder: UserLite;
  /** True when a live stamp for this person + role already existed (nothing new was issued). */
  alreadyStamped: boolean;
}

/** The exact object that is canonical-JSON-serialised and signed (keys sorted, no whitespace). */
export interface SignedCredentialPayload {
  v: 1;
  id: string;
  type: CredentialType;
  holder: { id: string; handle: string; name: string };
  event: { id: string; slug: string; name: string };
  role: StampRole | null;
  placement: AwardPlacement | null;
  track: string | null;
  /** null when neither project name nor URL was given. */
  project: { name: string | null; url: string | null } | null;
  issuer: { id: string; handle: string } | null;
  issuedAt: string;
}

/** GET /credentials/:id — everything needed to verify a credential independently. */
export interface CredentialVerification {
  credential: Credential;
  holder: UserLite;
  /** The exact canonical JSON string that was signed (copy this verbatim when verifying). */
  payload: string;
  /** base64url Ed25519 signature over the UTF-8 bytes of `payload`. */
  signature: string;
  algorithm: 'Ed25519';
  /** Key id stored with the credential at signing time. */
  keyId: string;
  /** base64url raw 32-byte Ed25519 public key for `keyId` (empty string when the key is unknown). */
  publicKey: string;
  /** The server still knows the public key for `keyId` (current or a listed previous key). */
  keyKnown: boolean;
  /** Signature verifies with the key for `keyId` AND the payload's id matches this credential. */
  valid: boolean;
  revoked: boolean;
}

export interface SigningKeyInfo {
  keyId: string;
  algorithm: 'Ed25519';
  publicKey: string;
  publicKeyPem: string;
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export interface Vouch {
  id: string;
  voucher: UserLite;
  recipientId: string;
  skill: string;
  message: string;
  event: EventLite | null;
  createdAt: string;
}

export interface VouchResponse {
  vouch: Vouch;
}

/** One day of Loopin activity (connections made, credentials earned, vouches given/received). */
export interface ActivityDay {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface ProfileStats {
  xp: number;
  tier: TierName;
  tierMinXp: number;
  nextTier: { name: TierName; minXp: number } | null;
  progress: number;
  /** 1-based position by XP among all users. */
  rank: number;
  totalRanked: number;
  /** Mutual connections. */
  connections: number;
  /** Distinct events with at least one non-revoked stamp. */
  events: number;
  /** Non-revoked stamps. */
  stamps: number;
  /** Non-revoked awards. */
  awards: number;
  /** Vouches received (total; XP counts distinct vouchers only). */
  vouches: number;
}

export interface ProfileView {
  user: PublicUser;
  /** Present only for the user themself and mutual connections. */
  contact: ContactInfo | null;
  stats: ProfileStats;
  /** Non-revoked credentials, newest first (cap LIST_CAPS.profileCredentials). */
  credentials: Credential[];
  /** Vouches received, newest first (cap LIST_CAPS.profileVouches). */
  vouches: Vouch[];
  /** Non-zero days in the last 365 days, ascending by date. */
  activity: ActivityDay[];
  visibility: Visibility;
  relationship: {
    isSelf: boolean;
    /** The viewer's own connection row id to this user (even if the connection is no longer mutual). */
    connectionId: string | null;
    /** Both directions exist (contact details and vouching require this). */
    mutual: boolean;
  };
}

/** GET /profiles/:handle — connections-only profiles are restricted for viewers who aren't mutual connections. */
export type ProfileResponse = { restricted: false; profile: ProfileView } | { restricted: true; user: UserLite };

// ---------------------------------------------------------------------------
// Badge & connections
// ---------------------------------------------------------------------------

/** GET /me/badge-key — material the device needs to mint rotating codes offline. */
export interface BadgeKey {
  key: string; // base64url, 32 bytes
  badgeId: string;
  slotSeconds: number;
  /** Server clock at response time. Clients compute their clock offset once, at fetch time (midpoint of request). */
  serverTime: string;
}

/** GET /badge/preview?token= — only for fresh, genuine codes (expired/forged codes return an error, never an identity). */
export interface BadgePreview {
  user: UserLite;
  /** When the scanned code itself stops working. */
  expiresAt: string;
  /** Lets a signed-out viewer connect after signing up (valid CONNECT_TICKET.ttlSeconds; pass as exchangeInput.token). */
  connectTicket: string;
}

export interface ConnectionPeer extends UserLite {
  openTo: OpenTo[];
  location: string;
  githubUsername: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  /** Their contact details — null unless the connection is mutual. */
  contact: ContactInfo | null;
}

export interface ConnectionSummary {
  id: string;
  peer: ConnectionPeer;
  /** Private to the owner. */
  notes: string;
  /** Private to the owner. */
  tags: string[];
  event: EventLite | null;
  source: ConnectionSource;
  /** Both directions exist. */
  mutual: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionList {
  /** All of the owner's connections, newest first (cap LIST_CAPS.connections). */
  connections: ConnectionSummary[];
}

export interface ConnectionResponse {
  connection: ConnectionSummary;
}

export interface ConnectionDetail {
  connection: ConnectionSummary;
  /** Restricted when the peer's passport is connections-only and they removed you. */
  profile: ProfileResponse;
}

export interface ExchangeResult {
  connection: ConnectionSummary;
  alreadyConnected: boolean;
}

// ---------------------------------------------------------------------------
// Live: announcements, feed, notifications
// ---------------------------------------------------------------------------

export interface Announcement {
  id: string;
  title: string;
  body: string;
  kind: AnnouncementKind;
  urgent: boolean;
  actionLabel: string | null;
  actionUrl: string | null;
  location: string | null;
  event: EventLite | null;
  author: UserLite | null;
  createdAt: string;
}

export interface AnnouncementResponse {
  announcement: Announcement;
}

export interface AnnouncementList {
  announcements: Announcement[];
}

export interface Feed {
  /** Newest first (cap LIST_CAPS.feedAnnouncements). */
  announcements: Announcement[];
  /** Active and upcoming events (cap LIST_CAPS.feedEvents). */
  events: EventSummary[];
  activeEvent: EventSummary | null;
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  actor: UserLite | null;
  title: string;
  body: string;
  /** In-app path to open, e.g. "/network/<id>" (always starts with a single "/"). */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList {
  notifications: Notification[];
  unreadCount: number;
}

export interface UnreadCount {
  unreadCount: number;
}

// ---------------------------------------------------------------------------
// Admin, account, health, stream
// ---------------------------------------------------------------------------

export interface AdminUser extends UserLite {
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface AdminUserList {
  users: AdminUser[];
}

export interface AdminUserResponse {
  user: AdminUser;
}

/** GET /me/export — everything Loopin stores about the signed-in user. Fetched with apiFetch and saved as a file. */
export interface AccountExport {
  exportedAt: string;
  account: Me;
  profile: ProfileView;
  /** Connections owned by the user, with private notes and tags. */
  connections: ConnectionSummary[];
  vouchesGiven: Vouch[];
  vouchesReceived: Vouch[];
  /** Including revoked ones. */
  credentials: Credential[];
  credentialsIssued: IssuedCredential[];
  eventsCreated: EventLite[];
  announcementsAuthored: Announcement[];
  rsvps: { event: EventLite; createdAt: string }[];
  notifications: Notification[];
  sessions: { createdAt: string; lastUsedAt: string; expiresAt: string; userAgent: string | null; current: boolean }[];
}

export interface HealthResponse {
  /** 'degraded' is returned with HTTP 503. */
  status: 'ok' | 'degraded';
  db: 'ok' | 'error';
  version: string;
  time: string;
}

/**
 * Messages on GET /api/stream (server-sent events, one JSON object per `data:` line).
 * There is no replay: `ready` means (re)subscribed — clients refetch feed/notifications on every `ready` after the first.
 */
export type StreamEvent =
  | { type: 'ready' }
  | { type: 'notification'; notification: Notification }
  | { type: 'announcement'; announcement: Announcement }
  | { type: 'announcement_deleted'; id: string }
  | { type: 'badge_rotated' };
