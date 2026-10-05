/**
 * Product-wide constants. Both the server (validation, notification copy) and
 * the web app (forms, labels) read from here so the two never drift.
 */

export const APP_NAME = 'Loopin';

export const LIMITS = {
  nameMax: 60,
  handleMin: 3,
  handleMax: 24,
  headlineMax: 80,
  bioMax: 280,
  locationMax: 60,
  urlMax: 300,
  phoneMax: 32,
  emailMax: 254,
  skillsMax: 8,
  skillNameMax: 32,
  openToMax: 6,
  noteMax: 2000,
  tagsMax: 10,
  tagMax: 24,
  vouchSkillMax: 48,
  vouchMessageMax: 500,
  passwordMin: 8,
  passwordMax: 128,
  eventNameMax: 100,
  eventTaglineMax: 140,
  eventDescriptionMax: 2000,
  eventLocationMax: 100,
  slugMin: 3,
  slugMax: 60,
  announcementTitleMax: 120,
  announcementBodyMax: 1000,
  actionLabelMax: 40,
  trackMax: 80,
  projectNameMax: 100,
  /** A person can vouch for at most this many different skills of the same recipient. */
  vouchesPerPairMax: 3,
  /** Team awards: max handles in one POST /events/:id/awards. */
  awardHandlesMax: 8,
} as const;

/** Hard caps on list endpoints (server enforces; clients may rely on "all rows up to the cap"). */
export const LIST_CAPS = {
  connections: 5000,
  profileCredentials: 500,
  profileVouches: 500,
  attendees: 5000,
  eventCredentials: 5000,
  feedAnnouncements: 50,
  eventAnnouncements: 200,
  feedEvents: 20,
  events: 50,
  notifications: 50,
  adminUsers: 50,
} as const;

/** Handles are stored lowercase without the leading "@". */
export const HANDLE_PATTERN = /^[a-z0-9_]{3,24}$/;
export const GITHUB_USERNAME_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const PHONE_PATTERN = /^\+?[0-9 ()-]{6,32}$/;

export const RESERVED_HANDLES: readonly string[] = [
  'admin', 'api', 'app', 'auth', 'c', 'exchange', 'genesis', 'genesishacks', 'help', 'live',
  'login', 'logout', 'loopin', 'me', 'network', 'null', 'onboarding', 'organizer', 'passport',
  'privacy', 'root', 'settings', 'signup', 'support', 'system', 'terms', 'u', 'undefined', 'verify',
];

export const USER_ROLES = ['member', 'organizer', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const VISIBILITY_OPTIONS = [
  { value: 'public', label: 'Public', description: 'Anyone with your link can see your passport. Contact details stay visible to connections only.' },
  { value: 'connections', label: 'Connections only', description: "Only people you've exchanged with see your full passport. Others see just your name and photo." },
] as const;
export type Visibility = (typeof VISIBILITY_OPTIONS)[number]['value'];
export const VISIBILITY_VALUES = ['public', 'connections'] as const satisfies readonly Visibility[];

export const OPEN_TO_OPTIONS = [
  { value: 'team', label: 'Looking for a team' },
  { value: 'collab', label: 'Open to collaborate' },
  { value: 'cofounder', label: 'Open to co-founding' },
  { value: 'job', label: 'Open to work' },
  { value: 'hiring', label: 'Hiring' },
  { value: 'mentoring', label: 'Happy to mentor' },
] as const;
export type OpenTo = (typeof OPEN_TO_OPTIONS)[number]['value'];
export const OPEN_TO_VALUES = ['team', 'collab', 'cofounder', 'job', 'hiring', 'mentoring'] as const satisfies readonly OpenTo[];

export const SKILL_SUGGESTIONS = [
  'AI / ML', 'Backend', 'Frontend', 'Mobile', 'DevOps & Cloud', 'Systems',
  'Data', 'Security', 'Web3', 'Design / UX', 'Hardware & IoT', 'Product',
] as const;

export const SKILL_LEVELS = [
  { value: 1, label: 'Learning' },
  { value: 2, label: 'Familiar' },
  { value: 3, label: 'Proficient' },
  { value: 4, label: 'Advanced' },
  { value: 5, label: 'Expert' },
] as const;

export const STAMP_ROLES = [
  { value: 'hacker', label: 'Hacker' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'judge', label: 'Judge' },
  { value: 'speaker', label: 'Speaker' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'organizer', label: 'Organizer' },
  { value: 'sponsor', label: 'Sponsor' },
] as const;
export type StampRole = (typeof STAMP_ROLES)[number]['value'];
export const STAMP_ROLE_VALUES = ['hacker', 'mentor', 'judge', 'speaker', 'volunteer', 'organizer', 'sponsor'] as const satisfies readonly StampRole[];

export const AWARD_PLACEMENTS = [
  { value: 'first', label: '1st place' },
  { value: 'second', label: '2nd place' },
  { value: 'third', label: '3rd place' },
  { value: 'finalist', label: 'Finalist' },
  { value: 'special', label: 'Special prize' },
] as const;
export type AwardPlacement = (typeof AWARD_PLACEMENTS)[number]['value'];
export const AWARD_PLACEMENT_VALUES = ['first', 'second', 'third', 'finalist', 'special'] as const satisfies readonly AwardPlacement[];

export const EVENT_KINDS = [
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'meetup', label: 'Meetup' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'conference', label: 'Conference' },
] as const;
export type EventKind = (typeof EVENT_KINDS)[number]['value'];
export const EVENT_KIND_VALUES = ['hackathon', 'meetup', 'workshop', 'conference'] as const satisfies readonly EventKind[];

export const ANNOUNCEMENT_KINDS = [
  { value: 'alert', label: 'Alert' },
  { value: 'update', label: 'Update' },
  { value: 'info', label: 'Info' },
] as const;
export type AnnouncementKind = (typeof ANNOUNCEMENT_KINDS)[number]['value'];
export const ANNOUNCEMENT_KIND_VALUES = ['alert', 'update', 'info'] as const satisfies readonly AnnouncementKind[];

/**
 * What organizers pick in the composer (one control instead of kind + urgent).
 * "Urgent alert" = kind 'alert' + urgent true; it is pinned in Live for 6 hours and toasts open apps.
 */
export const ANNOUNCEMENT_TYPE_OPTIONS = [
  { value: 'info', label: 'Info', kind: 'info', urgent: false },
  { value: 'update', label: 'Update', kind: 'update', urgent: false },
  { value: 'urgent', label: 'Urgent alert', kind: 'alert', urgent: true },
] as const satisfies readonly { value: string; label: string; kind: AnnouncementKind; urgent: boolean }[];

/** Urgent announcements stay pinned at the top of Live for this long (and only while their event is active or global). */
export const URGENT_PIN_HOURS = 6;

/** Quick tags offered after an exchange (merged with the user's own existing tags). */
export const QUICK_TAG_SUGGESTIONS = ['Follow up', 'Teammate', 'Mentor', 'Hiring', 'Investor'] as const;

export const CREDENTIAL_TYPES = ['stamp', 'award'] as const;
export type CredentialType = (typeof CREDENTIAL_TYPES)[number];

export const NOTIFICATION_KINDS = ['connection', 'stamp', 'award', 'vouch', 'role'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** 'scan' = I scanned their code. 'scanned' = they scanned mine (row created for me automatically). */
export const CONNECTION_SOURCES = ['scan', 'scanned'] as const;
export type ConnectionSource = (typeof CONNECTION_SOURCES)[number];

type LabeledOption = { readonly value: string | number; readonly label: string };

/** Look up the human label for an option value, falling back to the raw value. */
export function labelOf<T extends readonly LabeledOption[]>(options: T, value: T[number]['value'] | null | undefined): string {
  if (value === null || value === undefined) return '';
  return options.find((o) => o.value === value)?.label ?? String(value);
}

export function formatHandle(handle: string): string {
  return `@${handle}`;
}
