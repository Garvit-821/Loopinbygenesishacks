/**
 * Request schemas (zod v4). The server validates every body/query with these; the web app reuses them
 * in forms via @hookform/resolvers/zod. Rules for forms:
 *   - let useForm infer types from the resolver, or use useForm<z.input<S>, unknown, z.output<S>>; never useForm<z.output<S>>
 *   - numeric inputs need `valueAsNumber` (skill levels); nullable selects map '' ↔ null (see EventSelect)
 *   - datetime-local values must be converted to ISO before validation (use a form-only schema that pipes into these)
 *
 * Field conventions on PATCH-style inputs:
 *   - key absent           → leave unchanged
 *   - plain text fields    → send '' to clear (headline, bio, location, notes)
 *   - clearable() fields   → '' or null clears and is stored as NULL (URLs, contact details, optional labels)
 *   - eventId              → undefined = server default (exchange: the active event), null = explicitly no event
 */
import { z } from 'zod';
import {
  ANNOUNCEMENT_KIND_VALUES,
  AWARD_PLACEMENT_VALUES,
  EVENT_KIND_VALUES,
  GITHUB_USERNAME_PATTERN,
  HANDLE_PATTERN,
  LIMITS,
  OPEN_TO_VALUES,
  PHONE_PATTERN,
  RESERVED_HANDLES,
  SLUG_PATTERN,
  STAMP_ROLE_VALUES,
  USER_ROLES,
  VISIBILITY_VALUES,
} from './constants';
import { isUuid } from './encoding';

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** C0 controls, DEL and bidi overrides/isolates — never legitimate in names, titles or tags. */
const SINGLE_LINE_FORBIDDEN = /[\u0000-\u001F\u007F‪-‮⁦-⁩]/;
/** Same, but tab and newline are allowed (CR is normalised away first). */
const MULTI_LINE_FORBIDDEN = /[\u0000-\u0008\u000B-\u001F\u007F‪-‮⁦-⁩]/;
const SPECIAL_CHARS_MESSAGE = 'Remove special characters';

const tooLong = (max: number) => `Keep it under ${max + 1} characters`;

/** Trimmed single-line text (may be empty). */
const line = (max: number) =>
  z.string().trim().max(max, tooLong(max)).refine((v) => !SINGLE_LINE_FORBIDDEN.test(v), SPECIAL_CHARS_MESSAGE);

/** Trimmed single-line text that must not be empty. */
const requiredLine = (max: number, emptyMessage: string) =>
  z
    .string()
    .trim()
    .min(1, emptyMessage)
    .max(max, tooLong(max))
    .refine((v) => !SINGLE_LINE_FORBIDDEN.test(v), SPECIAL_CHARS_MESSAGE);

const normalizeNewlines = (v: string) => v.replace(/\r\n?/g, '\n');

/** Trimmed multi-line text (may be empty). */
const multiline = (max: number) =>
  z
    .string()
    .transform(normalizeNewlines)
    .pipe(z.string().trim().max(max, tooLong(max)).refine((v) => !MULTI_LINE_FORBIDDEN.test(v), SPECIAL_CHARS_MESSAGE));

/** Trimmed multi-line text that must not be empty. */
const requiredMultiline = (max: number, emptyMessage: string) =>
  z
    .string()
    .transform(normalizeNewlines)
    .pipe(
      z
        .string()
        .trim()
        .min(1, emptyMessage)
        .max(max, tooLong(max))
        .refine((v) => !MULTI_LINE_FORBIDDEN.test(v), SPECIAL_CHARS_MESSAGE),
    );

/** Optional value that accepts "" / null as "clear" and validates otherwise. Output: string | null. */
function clearable<T extends z.ZodType<string, string>>(inner: T) {
  return z.union([z.null(), z.string().trim().pipe(z.union([z.literal(''), inner]))]).transform((v) => (v ? (v as string) : null));
}

/** "linkedin.com/in/ada" → "https://linkedin.com/in/ada"; values that already have a scheme are left alone. */
function withDefaultScheme(value: string): string {
  return value && !/^[a-z][a-z0-9+.-]*:/i.test(value) ? `https://${value}` : value;
}

function urlProtocol(value: string): string | null {
  try {
    return new URL(value).protocol;
  } catch {
    return null;
  }
}

export const httpUrlSchema = z
  .string()
  .trim()
  .transform(withDefaultScheme)
  .pipe(
    z
      .string()
      .max(LIMITS.urlMax, 'URL is too long')
      .refine((v) => {
        const protocol = urlProtocol(v);
        return protocol === 'https:' || protocol === 'http:';
      }, 'Enter a valid web address'),
  );

/** Like httpUrlSchema but https only (used for images we render, e.g. avatars). */
export const httpsUrlSchema = z
  .string()
  .trim()
  .transform(withDefaultScheme)
  .pipe(
    z
      .string()
      .max(LIMITS.urlMax, 'URL is too long')
      .refine((v) => urlProtocol(v) === 'https:', 'Use an https:// address'),
  );

const linkedinUrlSchema = httpUrlSchema.refine((v) => {
  try {
    const host = new URL(v).hostname.toLowerCase();
    return host === 'linkedin.com' || host.endsWith('.linkedin.com');
  } catch {
    return false;
  }
}, 'Enter a linkedin.com profile URL');

const githubUsernameSchema = z
  .string()
  .transform((v) => v.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/^@/, '').replace(/\/+$/, ''))
  .pipe(z.string().regex(GITHUB_USERNAME_PATTERN, 'Enter a valid GitHub username'));

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(LIMITS.emailMax, 'Email is too long'));

export const passwordSchema = z
  .string()
  .min(LIMITS.passwordMin, `Use at least ${LIMITS.passwordMin} characters`)
  .max(LIMITS.passwordMax, 'Password is too long');

/** For picking a handle (signup / profile edit): normalises "@Name" → "name" and rejects reserved words. */
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^@/, ''))
  .pipe(
    z
      .string()
      .regex(HANDLE_PATTERN, 'Use 3–24 lowercase letters, numbers or underscores')
      .refine((h) => !RESERVED_HANDLES.includes(h), 'That handle is reserved'),
  );

/** For looking up an existing user by handle (organizer tools). No reserved-word check. */
export const handleLookupSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^@/, ''))
  .pipe(z.string().regex(HANDLE_PATTERN, 'Enter a valid handle'));

/** Any 8-4-4-4-12 hex id (same set Postgres accepts and isUuid() checks). */
export const uuidSchema = z.guid('Invalid id');

export const skillSchema = z.object({
  name: requiredLine(LIMITS.skillNameMax, 'Name the skill'),
  level: z.number().int().min(1).max(5),
});

export const skillsSchema = z
  .array(skillSchema)
  .max(LIMITS.skillsMax, `Add up to ${LIMITS.skillsMax} skills`)
  .refine((arr) => new Set(arr.map((s) => s.name.toLowerCase())).size === arr.length, 'Each skill can only be added once');

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const key = v.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const tagsSchema = z
  .array(requiredLine(LIMITS.tagMax, 'Tags cannot be empty'))
  .max(LIMITS.tagsMax, `Use up to ${LIMITS.tagsMax} tags`)
  .transform(dedupeCaseInsensitive);

const isoDateTime = z.iso.datetime({ offset: true, error: 'Enter a valid date and time' });

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const signupInput = z.object({
  name: requiredLine(LIMITS.nameMax, 'Enter your name'),
  email: emailSchema,
  password: passwordSchema,
  handle: handleSchema,
});
export type SignupInput = z.output<typeof signupInput>;

export const loginInput = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password').max(LIMITS.passwordMax),
});
export type LoginInput = z.output<typeof loginInput>;

export const forgotPasswordInput = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.output<typeof forgotPasswordInput>;

export const resetPasswordInput = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.output<typeof resetPasswordInput>;

/** currentPassword is required by the server when the account already has a password. */
export const changePasswordInput = z.object({
  currentPassword: z.string().max(LIMITS.passwordMax).optional(),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.output<typeof changePasswordInput>;

/** One-time code from the GitHub OAuth redirect (/auth/callback#code=...). */
export const oauthExchangeInput = z.object({ code: z.string().min(10).max(200) });
export type OAuthExchangeInput = z.output<typeof oauthExchangeInput>;

/** GET /auth/handle-available?handle= — validated loosely; the route reports format problems as `reason`. */
export const handleAvailabilityQuery = z.object({ handle: z.string().max(64) });
export type HandleAvailabilityQuery = z.output<typeof handleAvailabilityQuery>;

// ---------------------------------------------------------------------------
// Profile & account
// ---------------------------------------------------------------------------

export const updateProfileInput = z.object({
  name: requiredLine(LIMITS.nameMax, 'Enter your name').optional(),
  handle: handleSchema.optional(),
  headline: line(LIMITS.headlineMax).optional(),
  bio: multiline(LIMITS.bioMax).optional(),
  location: line(LIMITS.locationMax).optional(),
  avatarUrl: clearable(httpsUrlSchema).optional(),
  githubUsername: clearable(githubUsernameSchema).optional(),
  linkedinUrl: clearable(linkedinUrlSchema).optional(),
  websiteUrl: clearable(httpUrlSchema).optional(),
  contactEmail: clearable(z.email('Enter a valid email address').max(LIMITS.emailMax)).optional(),
  phone: clearable(z.string().regex(PHONE_PATTERN, 'Enter a valid phone number')).optional(),
  skills: skillsSchema.optional(),
  openTo: z
    .array(z.enum(OPEN_TO_VALUES))
    .max(LIMITS.openToMax)
    .transform((v) => Array.from(new Set(v)))
    .optional(),
  visibility: z.enum(VISIBILITY_VALUES).optional(),
});
export type UpdateProfileInput = z.output<typeof updateProfileInput>;

/** confirmHandle must equal the account's handle; password is required when the account has one. */
export const deleteAccountInput = z.object({
  confirmHandle: z.string().trim().toLowerCase().transform((v) => v.replace(/^@/, '')),
  password: z.string().max(LIMITS.passwordMax).optional(),
});
export type DeleteAccountInput = z.output<typeof deleteAccountInput>;

// ---------------------------------------------------------------------------
// Badge, connections & vouches
// ---------------------------------------------------------------------------

/** GET /badge/preview?token= — token may be a bare badge token or a Loopin link. */
export const badgePreviewQuery = z.object({ token: z.string().trim().min(10).max(500) });
export type BadgePreviewQuery = z.output<typeof badgePreviewQuery>;

/**
 * `token` may be a bare badge token, a full Loopin link (".../c/<token>"), or a connect ticket ("lpt_…")
 * obtained from GET /badge/preview while signed out.
 */
export const exchangeInput = z.object({
  token: z.string().trim().min(10).max(500),
  eventId: uuidSchema.nullable().optional(),
});
export type ExchangeInput = z.output<typeof exchangeInput>;

export const updateConnectionInput = z.object({
  notes: multiline(LIMITS.noteMax).optional(),
  tags: tagsSchema.optional(),
  eventId: uuidSchema.nullable().optional(),
});
export type UpdateConnectionInput = z.output<typeof updateConnectionInput>;

export const createVouchInput = z.object({
  recipientId: uuidSchema,
  skill: requiredLine(LIMITS.vouchSkillMax, 'What are you vouching for?'),
  message: requiredMultiline(LIMITS.vouchMessageMax, 'Add a sentence about their work'),
  eventId: uuidSchema.nullable().optional(),
});
export type CreateVouchInput = z.output<typeof createVouchInput>;

// ---------------------------------------------------------------------------
// Events, credentials, announcements (organizer tools)
// ---------------------------------------------------------------------------

const eventFields = {
  name: requiredLine(LIMITS.eventNameMax, 'Name the event'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(LIMITS.slugMin, `Use at least ${LIMITS.slugMin} characters`)
    .max(LIMITS.slugMax, tooLong(LIMITS.slugMax))
    .regex(SLUG_PATTERN, 'Use lowercase letters, numbers and dashes')
    .refine((v) => !isUuid(v), "A slug can't look like an id"),
  tagline: line(LIMITS.eventTaglineMax),
  description: multiline(LIMITS.eventDescriptionMax),
  kind: z.enum(EVENT_KIND_VALUES),
  location: line(LIMITS.eventLocationMax),
  startsAt: isoDateTime,
  endsAt: isoDateTime,
  isActive: z.boolean(),
};

const endsAfterStart = (v: { startsAt?: string; endsAt?: string }) =>
  !v.startsAt || !v.endsAt || new Date(v.endsAt).getTime() > new Date(v.startsAt).getTime();

/** slug is generated from the name when omitted. */
export const createEventInput = z
  .object({
    name: eventFields.name,
    slug: eventFields.slug.optional(),
    tagline: eventFields.tagline.default(''),
    description: eventFields.description.default(''),
    kind: eventFields.kind.default('hackathon'),
    location: eventFields.location.default(''),
    startsAt: eventFields.startsAt,
    endsAt: eventFields.endsAt,
    isActive: eventFields.isActive.default(false),
  })
  .refine(endsAfterStart, { message: 'End time must be after the start time', path: ['endsAt'] });
export type CreateEventInput = z.output<typeof createEventInput>;

/** The server re-checks endsAt > startsAt against the stored row when only one of them is sent. */
export const updateEventInput = z
  .object({
    name: eventFields.name.optional(),
    slug: eventFields.slug.optional(),
    tagline: eventFields.tagline.optional(),
    description: eventFields.description.optional(),
    kind: eventFields.kind.optional(),
    location: eventFields.location.optional(),
    startsAt: eventFields.startsAt.optional(),
    endsAt: eventFields.endsAt.optional(),
    isActive: eventFields.isActive.optional(),
  })
  .refine(endsAfterStart, { message: 'End time must be after the start time', path: ['endsAt'] });
export type UpdateEventInput = z.output<typeof updateEventInput>;

/** Organizer check-in: scan the attendee's badge (token) or type their handle. */
export const checkInInput = z
  .object({
    token: z.string().trim().min(10).max(500).optional(),
    handle: handleLookupSchema.optional(),
    role: z.enum(STAMP_ROLE_VALUES).default('hacker'),
  })
  .refine((v) => Boolean(v.token) !== Boolean(v.handle), { message: 'Provide a badge code or a handle', path: ['handle'] });
export type CheckInInput = z.output<typeof checkInInput>;

/** Team awards: every handle gets its own signed credential with the same placement/track/project. All-or-nothing. */
export const createAwardInput = z.object({
  handles: z
    .array(handleLookupSchema)
    .min(1, 'Add at least one person')
    .max(LIMITS.awardHandlesMax, `Up to ${LIMITS.awardHandlesMax} people per award`)
    .transform((v) => Array.from(new Set(v))),
  placement: z.enum(AWARD_PLACEMENT_VALUES),
  track: clearable(line(LIMITS.trackMax)).optional(),
  projectName: clearable(line(LIMITS.projectNameMax)).optional(),
  projectUrl: clearable(httpUrlSchema).optional(),
});
export type CreateAwardInput = z.output<typeof createAwardInput>;

/** Announcements are public. Omitting eventId (or null) makes it a global announcement. */
export const createAnnouncementInput = z
  .object({
    title: requiredLine(LIMITS.announcementTitleMax, 'Add a title'),
    body: requiredMultiline(LIMITS.announcementBodyMax, 'Add a message'),
    kind: z.enum(ANNOUNCEMENT_KIND_VALUES).default('info'),
    urgent: z.boolean().default(false),
    actionLabel: clearable(line(LIMITS.actionLabelMax)).optional(),
    actionUrl: clearable(httpUrlSchema).optional(),
    location: clearable(line(LIMITS.eventLocationMax)).optional(),
    eventId: uuidSchema.nullable().optional(),
  })
  .refine((v) => !v.actionLabel || Boolean(v.actionUrl), { message: 'Add a link for the button', path: ['actionUrl'] });
export type CreateAnnouncementInput = z.output<typeof createAnnouncementInput>;

// ---------------------------------------------------------------------------
// Notifications & admin
// ---------------------------------------------------------------------------

/** Marks the given notifications read, or all of them when `ids` is omitted (an empty body is fine). */
export const markNotificationsReadInput = z.object({
  ids: z.array(uuidSchema).max(100).optional(),
});
export type MarkNotificationsReadInput = z.output<typeof markNotificationsReadInput>;

export const adminUsersQuery = z.object({ q: z.string().trim().max(100).default('') });
export type AdminUsersQuery = z.output<typeof adminUsersQuery>;

export const updateRoleInput = z.object({ role: z.enum(USER_ROLES) });
export type UpdateRoleInput = z.output<typeof updateRoleInput>;
