/**
 * Base fixtures: a coherent, realistic Genesis Hacks 2026 world for every route in SPEC §3.5.
 * The signed-in user (with --auth) is @gpdev (Garvit Prakash, admin). Times are relative to when the harness
 * starts; event times are anchored to Bengaluru (the harness runs the browser in Asia/Kolkata).
 *
 * Feature fixtures (fixtures/<feature>.ts) can import the exported data and builders below to compose
 * screen-specific states, and override any handler by registering the same key.
 */
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import {
  computeXp,
  formatHandle,
  handleSchema,
  isProfileComplete,
  isUuid,
  tierProgress,
  type AccountExport,
  type ActivityDay,
  type AdminUser,
  type AdminUserList,
  type AdminUserResponse,
  type Announcement,
  type AnnouncementList,
  type AnnouncementResponse,
  type Attendee,
  type AttendeeList,
  type AuthProviders,
  type AuthResponse,
  type AwardPlacement,
  type AwardResult,
  type BadgeKey,
  type BadgePreview,
  type CheckInResult,
  type ConnectionDetail,
  type ConnectionList,
  type ConnectionPeer,
  type ConnectionResponse,
  type ConnectionSummary,
  type ContactInfo,
  type Credential,
  type CredentialVerification,
  type EventKind,
  type EventList,
  type EventLite,
  type EventResponse,
  type EventStats,
  type EventSummary,
  type ExchangeResult,
  type Feed,
  type HandleAvailability,
  type HealthResponse,
  type IssuedCredential,
  type IssuedCredentialList,
  type Me,
  type MeResponse,
  type Notification,
  type NotificationList,
  type OpenTo,
  type OrganizerEvent,
  type OrganizerEventList,
  type ProfileResponse,
  type ProfileStats,
  type ProfileView,
  type PublicUser,
  type RsvpState,
  type SignedCredentialPayload,
  type SigningKeyInfo,
  type Skill,
  type StampRole,
  type UnreadCount,
  type UserLite,
  type UserRole,
  type Visibility,
  type Vouch,
  type VouchResponse,
} from '@loopin/shared';
import { apiError, created, noContent, ok, unauthorized, type FixtureContext, type FixtureHandlers } from '../types';

// ---------------------------------------------------------------------------
// Clock, ids, randomness
// ---------------------------------------------------------------------------

export const NOW = Date.now();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const IST_OFFSET = 5.5 * HOUR;

export const ago = (ms: number): string => new Date(NOW - ms).toISOString();

/** Wall-clock time in Bengaluru, `dayOffset` days from today. */
export function istAt(dayOffset: number, hours: number, minutes = 0): string {
  const wall = new Date(NOW + IST_OFFSET);
  return new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + dayOffset, hours, minutes) - IST_OFFSET).toISOString();
}

const uuid = (group: number, n: number) => `${group.toString(16).padStart(8, '0')}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

/** Deterministic PRNG (mulberry32) so every run produces the same world. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (ms: number) => new Date(ms).toISOString();

// ---------------------------------------------------------------------------
// Signing (real Ed25519 so the Verify page's Node snippet actually verifies)
// ---------------------------------------------------------------------------

const SIGNING_SEED = createHash('sha256').update('loopin-ui-snap-fixture-signing-key').digest();
const PRIVATE_KEY = createPrivateKey({
  key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), SIGNING_SEED]),
  format: 'der',
  type: 'pkcs8',
});
const PUBLIC_KEY = createPublicKey(PRIVATE_KEY);
const RAW_PUBLIC_KEY = PUBLIC_KEY.export({ format: 'der', type: 'spki' }).subarray(12);

export const signingKey: SigningKeyInfo = {
  keyId: createHash('sha256').update(RAW_PUBLIC_KEY).digest('hex').slice(0, 16),
  algorithm: 'Ed25519',
  publicKey: RAW_PUBLIC_KEY.toString('base64url'),
  publicKeyPem: PUBLIC_KEY.export({ format: 'pem', type: 'spki' }).toString(),
};

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

interface PersonSeed {
  n: number;
  handle: string;
  name: string;
  headline: string;
  bio?: string;
  location?: string;
  role?: UserRole;
  visibility?: Visibility;
  skills?: Skill[];
  openTo?: OpenTo[];
  githubUsername?: string | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
  contact?: ContactInfo;
  email?: string;
  createdDaysAgo?: number;
  /** Mutual connections (for people whose network isn't modelled in detail). */
  connections?: number;
}

export interface Person {
  id: string;
  /** Real role (Me/AdminUser); public views show admin as organizer. */
  role: UserRole;
  email: string;
  visibility: Visibility;
  contact: ContactInfo;
  user: PublicUser;
  lite: UserLite;
  connections: number;
}

function makePerson(seed: PersonSeed): Person {
  const github = seed.githubUsername ?? null;
  const role = seed.role ?? 'member';
  const user: PublicUser = {
    id: uuid(0x1000, seed.n),
    handle: seed.handle,
    name: seed.name,
    headline: seed.headline,
    avatarUrl: github ? `https://github.com/${encodeURIComponent(github)}.png?size=200` : null,
    bio: seed.bio ?? '',
    location: seed.location ?? '',
    githubUsername: github,
    linkedinUrl: seed.linkedinUrl ?? null,
    websiteUrl: seed.websiteUrl ?? null,
    skills: seed.skills ?? [],
    openTo: seed.openTo ?? [],
    role: role === 'admin' ? 'organizer' : role,
    createdAt: ago((seed.createdDaysAgo ?? 200) * DAY),
  };
  return {
    id: user.id,
    role,
    email: seed.email ?? `${seed.handle}@example.com`,
    visibility: seed.visibility ?? 'public',
    contact: seed.contact ?? { contactEmail: null, phone: null },
    user,
    lite: { id: user.id, handle: user.handle, name: user.name, headline: user.headline, avatarUrl: user.avatarUrl },
    connections: seed.connections ?? 0,
  };
}

const KNOWN: PersonSeed[] = [
  {
    n: 1,
    handle: 'gpdev',
    name: 'Garvit Prakash',
    headline: 'Full-stack developer · building Loopin',
    bio: 'I build tools for hackathon communities. Currently: rotating QR codes, signed credentials and far too much filter coffee.',
    location: 'Bengaluru',
    role: 'admin',
    skills: [
      { name: 'TypeScript', level: 5 },
      { name: 'React', level: 5 },
      { name: 'Node.js', level: 4 },
      { name: 'PostgreSQL', level: 4 },
      { name: 'Rust', level: 2 },
    ],
    openTo: ['collab', 'mentoring'],
    githubUsername: 'Garvit-821',
    contact: { contactEmail: 'garvit@demo.loopin.dev', phone: null },
    email: 'garvit@demo.loopin.dev',
    createdDaysAgo: 412,
  },
  {
    n: 2,
    handle: 'ananya_ml',
    name: 'Ananya Iyer',
    headline: 'ML engineer · organizing Genesis Hacks',
    bio: 'Applied ML for health care by day. I run Genesis Hacks with a wonderful crew of volunteers — come say hi at the help desk.',
    location: 'Bengaluru',
    role: 'organizer',
    skills: [
      { name: 'AI / ML', level: 5 },
      { name: 'Python', level: 5 },
      { name: 'Data', level: 4 },
      { name: 'Product', level: 3 },
    ],
    openTo: ['mentoring', 'hiring'],
    websiteUrl: 'https://ananya.example.com',
    contact: { contactEmail: 'ananya@example.com', phone: null },
    email: 'ananya@demo.loopin.dev',
    createdDaysAgo: 398,
    connections: 186,
  },
  {
    n: 3,
    handle: 'rohan_sys',
    name: 'Rohan Mehta',
    headline: 'Systems engineer · Rust & distributed systems',
    bio: 'Writing a CRDT-backed notes app in Rust. Ask me about consensus, cache lines, or the best vada pav in Pune.',
    location: 'Pune',
    skills: [
      { name: 'Rust', level: 5 },
      { name: 'Systems', level: 5 },
      { name: 'Backend', level: 4 },
      { name: 'DevOps & Cloud', level: 3 },
    ],
    openTo: ['team', 'cofounder'],
    websiteUrl: 'https://rohan.example.com',
    contact: { contactEmail: 'rohan@example.com', phone: null },
    email: 'rohan@demo.loopin.dev',
    createdDaysAgo: 301,
    connections: 64,
  },
  {
    n: 4,
    handle: 'marcus_v',
    name: 'Marcus Vance',
    headline: 'Design engineer · prototypes that feel real',
    bio: 'Bridging Figma and production code. Visiting Bengaluru for the hackathon season.',
    location: 'San Francisco',
    skills: [
      { name: 'Design / UX', level: 5 },
      { name: 'Frontend', level: 4 },
      { name: 'Motion', level: 4 },
    ],
    openTo: ['collab'],
    websiteUrl: 'https://marcus.example.com',
    contact: { contactEmail: 'marcus@example.com', phone: '+1 555 0142' },
    email: 'marcus@demo.loopin.dev',
    createdDaysAgo: 240,
    connections: 38,
  },
  {
    n: 5,
    handle: 'elena_zk',
    name: 'Elena Kovač',
    headline: 'Cryptography researcher · zero-knowledge proofs',
    bio: 'Researching practical zero-knowledge systems. Judging the security track this weekend.',
    location: 'Zagreb',
    skills: [
      { name: 'Security', level: 5 },
      { name: 'Zero-knowledge proofs', level: 5 },
      { name: 'Web3', level: 3 },
    ],
    openTo: ['collab', 'mentoring'],
    contact: { contactEmail: 'elena@example.com', phone: null },
    email: 'elena@demo.loopin.dev',
    createdDaysAgo: 150,
    connections: 41,
  },
  {
    n: 6,
    handle: 'priya_builds',
    name: 'Priya Sharma',
    headline: 'Mobile developer · React Native & Kotlin',
    bio: 'I ship mobile apps for a fintech and hack on side projects at every hackathon I can find.',
    location: 'Bengaluru',
    skills: [
      { name: 'Mobile', level: 5 },
      { name: 'React Native', level: 4 },
      { name: 'Kotlin', level: 4 },
      { name: 'Design / UX', level: 3 },
    ],
    openTo: ['team', 'job'],
    contact: { contactEmail: 'priya@example.com', phone: null },
    email: 'priya@demo.loopin.dev',
    createdDaysAgo: 120,
    connections: 27,
  },
  {
    n: 7,
    handle: 'arjun_n',
    name: 'Arjun Nair',
    headline: 'Backend engineer · Go and Postgres',
    location: 'Kochi',
    skills: [
      { name: 'Backend', level: 5 },
      { name: 'Go', level: 4 },
      { name: 'PostgreSQL', level: 4 },
    ],
    openTo: ['team'],
    contact: { contactEmail: 'arjun@example.com', phone: null },
    createdDaysAgo: 210,
    connections: 19,
  },
  {
    n: 8,
    handle: 'meera_k',
    name: 'Meera Krishnan',
    headline: 'Product designer · accessibility advocate',
    bio: 'Designing inclusive products. Happy to review your forms for accessibility.',
    location: 'Chennai',
    skills: [
      { name: 'Design / UX', level: 5 },
      { name: 'Accessibility', level: 5 },
      { name: 'Product', level: 4 },
    ],
    openTo: ['mentoring'],
    contact: { contactEmail: 'meera@example.com', phone: null },
    createdDaysAgo: 330,
    connections: 52,
  },
  {
    n: 9,
    handle: 'kabir_dev',
    name: 'Kabir Singh',
    headline: 'Platform engineer · Kubernetes and Terraform',
    location: 'Delhi',
    skills: [
      { name: 'DevOps & Cloud', level: 5 },
      { name: 'Kubernetes', level: 4 },
    ],
    openTo: ['hiring'],
    contact: { contactEmail: 'kabir@example.com', phone: null },
    createdDaysAgo: 90,
    connections: 23,
  },
  {
    n: 10,
    handle: 'sarathomas',
    name: 'Sara Thomas',
    headline: 'Data scientist · climate datasets',
    location: 'Bengaluru',
    skills: [
      { name: 'Data', level: 5 },
      { name: 'AI / ML', level: 4 },
      { name: 'Python', level: 4 },
    ],
    openTo: ['collab'],
    contact: { contactEmail: 'sara@example.com', phone: null },
    createdDaysAgo: 380,
    connections: 33,
  },
  {
    n: 11,
    handle: 'vik_j',
    name: 'Vikram Joshi',
    headline: 'Hardware hacker · ESP32 and LoRa',
    bio: 'Making badges that blink. Currently putting Loopin codes on e-ink.',
    location: 'Pune',
    skills: [
      { name: 'Hardware & IoT', level: 5 },
      { name: 'Embedded C', level: 4 },
    ],
    openTo: ['team', 'collab'],
    contact: { contactEmail: 'vikram@example.com', phone: null },
    createdDaysAgo: 60,
    connections: 15,
  },
  {
    n: 12,
    handle: 'nehag',
    name: 'Neha Gupta',
    headline: 'Frontend engineer · performance and accessibility',
    location: 'Hyderabad',
    skills: [
      { name: 'Frontend', level: 5 },
      { name: 'Performance', level: 4 },
    ],
    openTo: ['job'],
    createdDaysAgo: 170,
    connections: 21,
  },
  {
    n: 13,
    handle: 'dpark',
    name: 'Daniel Park',
    headline: 'Security engineer · appsec and bug bounties',
    location: 'Seoul',
    visibility: 'connections',
    skills: [{ name: 'Security', level: 5 }],
    createdDaysAgo: 95,
    connections: 30,
  },
  {
    n: 14,
    handle: 'ishaan_v',
    name: 'Ishaan Verma',
    headline: 'CS student · building with LLMs',
    location: 'Bengaluru',
    skills: [
      { name: 'AI / ML', level: 3 },
      { name: 'Frontend', level: 3 },
    ],
    openTo: ['team'],
    contact: { contactEmail: 'ishaan@example.com', phone: null },
    createdDaysAgo: 3,
    connections: 4,
  },
];

const FIRST_NAMES = [
  'Aditi', 'Aarav', 'Kavya', 'Rahul', 'Sneha', 'Vivek', 'Ritika', 'Nikhil', 'Pooja', 'Siddharth', 'Tanvi', 'Karan',
  'Divya', 'Harsh', 'Ira', 'Manav', 'Nandini', 'Omkar', 'Pallavi', 'Rohit', 'Shruti', 'Tejas', 'Uma', 'Varun',
  'Zoya', 'Farhan', 'Lakshmi', 'Gautam', 'Anjali', 'Dev',
] as const;
const LAST_NAMES = [
  'Rao', 'Kapoor', 'Menon', 'Pillai', 'Desai', 'Shah', 'Bhat', 'Reddy', 'Kulkarni', 'Chopra', 'Das', 'Ghosh',
  'Hegde', 'Jain', 'Khan', 'Mishra', 'Naidu', 'Patil', 'Qureshi', 'Saxena', 'Thakur', 'Varma', 'Wadhwa', 'Yadav',
] as const;
const HEADLINES = [
  'CS student', 'Frontend developer', 'ML engineer', 'Product designer', 'Backend developer', 'Hardware tinkerer',
  'Data analyst', 'Mobile developer', 'DevOps engineer', 'Founder · early stage', 'Open-source maintainer', 'Game developer',
] as const;
const CITIES = ['Bengaluru', 'Pune', 'Mumbai', 'Chennai', 'Hyderabad', 'Delhi', 'Kochi', 'Mysuru'] as const;

function generatePeople(count: number): PersonSeed[] {
  const next = random(2026);
  const seeds: PersonSeed[] = [];
  const taken = new Set(KNOWN.map((seed) => seed.handle));
  let n = 100;
  while (seeds.length < count) {
    const first = FIRST_NAMES[Math.floor(next() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(next() * LAST_NAMES.length)];
    let handle = `${first}_${last}`.toLowerCase();
    if (taken.has(handle)) handle = `${handle}${Math.floor(next() * 90) + 10}`;
    if (taken.has(handle)) continue;
    taken.add(handle);
    seeds.push({
      n: n++,
      handle,
      name: `${first} ${last}`,
      headline: HEADLINES[Math.floor(next() * HEADLINES.length)],
      location: CITIES[Math.floor(next() * CITIES.length)],
      createdDaysAgo: Math.floor(next() * 300) + 2,
      connections: Math.floor(next() * 25),
    });
  }
  return seeds;
}

export const people: Person[] = [...KNOWN, ...generatePeople(220)].map(makePerson);
const byHandle = new Map(people.map((person) => [person.user.handle, person]));
const byId = new Map(people.map((person) => [person.id, person]));

export function person(handle: string): Person {
  const found = byHandle.get(handle);
  if (!found) throw new Error(`fixtures: unknown handle ${handle}`);
  return found;
}

export const me = person('gpdev');
const generated = people.slice(KNOWN.length);
/** Not checked in anywhere: badge-token check-ins resolve to this person, so the default door flow issues a new stamp. */
export const walkIn = generated[214];

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

interface EventSeed extends EventLite {
  tagline: string;
  description: string;
  rsvpCount: number;
  myRsvp: boolean;
}

function makeEvent(n: number, slug: string, name: string, kind: EventKind, location: string, startsAt: string, endsAt: string, extra: Partial<EventSeed>): EventSeed {
  return {
    id: uuid(0x2000, n),
    slug,
    name,
    kind,
    location,
    startsAt,
    endsAt,
    isActive: false,
    tagline: '',
    description: '',
    rsvpCount: 0,
    myRsvp: false,
    ...extra,
  };
}

export const events = {
  genesis2026: makeEvent(1, 'genesis-hacks-2026', 'Genesis Hacks 2026', 'hackathon', 'Bengaluru', istAt(-1, 9), istAt(1, 18), {
    isActive: true,
    tagline: '36 hours of building, mentoring and shipping.',
    description:
      'Genesis Hacks is a 36-hour hackathon for students and early-career builders. Tracks: Health & AI, Fintech, Climate and Open hardware.\nHacking ends tomorrow at 2 PM; demos and judging follow in Hall B.',
    rsvpCount: 412,
    myRsvp: true,
  }),
  aiMeetup: makeEvent(3, 'blr-ai-builders-meetup', 'Bengaluru AI Builders Meetup', 'meetup', 'Indiranagar, Bengaluru', istAt(9, 18, 30), istAt(9, 21), {
    tagline: 'Lightning talks and demos from people shipping with LLMs.',
    description: 'Five lightning talks, open demos and plenty of time to meet people. Bring something you built.',
    rsvpCount: 140,
    myRsvp: true,
  }),
  winter: makeEvent(2, 'genesis-winter-invitational', 'Genesis Winter Invitational', 'hackathon', 'Goa', istAt(45, 10), istAt(47, 17), {
    tagline: 'An invite-only weekend for this season’s finalists.',
    description: 'Finalists from Genesis events build together for a long weekend by the sea. Applications close in three weeks.',
    rsvpCount: 86,
    myRsvp: false,
  }),
  pune: makeEvent(4, 'hackers-occupied-pune', 'Hackers Occupied Pune', 'meetup', 'Pune', istAt(-120, 10), istAt(-120, 20), {
    tagline: 'A day of demos, talks and late-night hacking.',
    description: 'A community meetup with talks on systems, design and open source.',
    rsvpCount: 95,
  }),
  genesis2025: makeEvent(5, 'genesis-hacks-2025', 'Genesis Hacks 2025', 'hackathon', 'Bengaluru', istAt(-366, 9), istAt(-364, 18), {
    tagline: 'Where it all started.',
    description: 'The first Genesis Hacks: 300 builders, 48 hours, 74 projects.',
    rsvpCount: 380,
  }),
} satisfies Record<string, EventSeed>;

const allEvents: EventSeed[] = Object.values(events);

export function eventLite(event: EventSeed): EventLite {
  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    kind: event.kind,
    location: event.location,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    isActive: event.isActive,
  };
}

export function eventSummary(event: EventSeed, authed = true): EventSummary {
  return { ...eventLite(event), tagline: event.tagline, description: event.description, rsvpCount: event.rsvpCount, myRsvp: authed && event.myRsvp };
}

/** Active first, then upcoming (soonest first), then past (most recent first). */
function eventOrder(a: EventSeed, b: EventSeed): number {
  const rank = (event: EventSeed) => (event.isActive ? 0 : Date.parse(event.endsAt) >= NOW ? 1 : 2);
  const diff = rank(a) - rank(b);
  if (diff !== 0) return diff;
  return rank(a) === 2 ? Date.parse(b.startsAt) - Date.parse(a.startsAt) : Date.parse(a.startsAt) - Date.parse(b.startsAt);
}

function findEvent(idOrSlug: string): EventSeed | undefined {
  return allEvents.find((event) => (isUuid(idOrSlug) ? event.id === idOrSlug : event.slug === idOrSlug));
}

// ---------------------------------------------------------------------------
// Credentials: stamps (check-ins) and awards
// ---------------------------------------------------------------------------

let credentialSerial = 0;
export const credentials: IssuedCredential[] = [];

function issue(
  event: EventSeed,
  holder: Person,
  issuedAt: string,
  details: { role: StampRole } | { placement: AwardPlacement; track?: string; projectName?: string; projectUrl?: string },
  issuer: Person = person('ananya_ml'),
  revokedAt: string | null = null,
): IssuedCredential {
  credentialSerial += 1;
  const isStamp = 'role' in details;
  const credential: IssuedCredential = {
    id: uuid(0x4000, credentialSerial),
    type: isStamp ? 'stamp' : 'award',
    role: isStamp ? details.role : null,
    placement: isStamp ? null : details.placement,
    track: isStamp ? null : (details.track ?? null),
    projectName: isStamp ? null : (details.projectName ?? null),
    projectUrl: isStamp ? null : (details.projectUrl ?? null),
    event: eventLite(event),
    issuer: issuer.lite,
    issuedAt,
    revokedAt,
    holder: holder.lite,
  };
  credentials.push(credential);
  return credential;
}

function rolePick(next: () => number): StampRole {
  const roll = next();
  if (roll < 0.84) return 'hacker';
  if (roll < 0.9) return 'mentor';
  if (roll < 0.93) return 'judge';
  if (roll < 0.98) return 'volunteer';
  return 'speaker';
}

function stampEvent(event: EventSeed, attendees: [Person, StampRole][], windowStart: number, windowEnd: number, seed: number) {
  const next = random(seed);
  for (const [holder, role] of attendees) {
    const at = windowStart + Math.floor(next() * (windowEnd - windowStart));
    issue(event, holder, iso(at), { role });
  }
}

// Genesis Hacks 2026 (live): known people + 172 generated attendees, a few with a second role, one revoked mistake.
{
  const event = events.genesis2026;
  const start = Date.parse(event.startsAt);
  const known: [Person, StampRole][] = [
    [me, 'hacker'],
    [person('ananya_ml'), 'organizer'],
    [person('rohan_sys'), 'hacker'],
    [person('marcus_v'), 'mentor'],
    [person('elena_zk'), 'judge'],
    [person('priya_builds'), 'hacker'],
    [person('meera_k'), 'mentor'],
    [person('vik_j'), 'hacker'],
    [person('kabir_dev'), 'volunteer'],
    [person('ishaan_v'), 'hacker'],
    [person('sarathomas'), 'hacker'],
    [person('nehag'), 'speaker'],
  ];
  const next = random(11);
  const crowd: [Person, StampRole][] = generated.slice(0, 174).map((attendee) => [attendee, rolePick(next)]);
  // Six people also volunteer (a second, different role — live stamps are unique per person + role).
  const doubles: [Person, StampRole][] = crowd.slice(0, 6).map(([attendee, role]) => [attendee, role === 'volunteer' ? 'speaker' : 'volunteer']);
  // My own stamp at a fixed, readable time: yesterday 9:42 AM.
  issue(event, known[0][0], istAt(-1, 9, 42), { role: 'hacker' });
  stampEvent(event, known.slice(1), start + 20 * MINUTE, start + 3 * HOUR, 21);
  stampEvent(event, [...crowd, ...doubles], start + 10 * MINUTE, NOW - 4 * MINUTE, 22);
  issue(event, generated[10], iso(start + 2 * HOUR), { role: 'mentor' }, person('ananya_ml'), iso(start + 2 * HOUR + 3 * MINUTE));
}

// Hackers Occupied Pune: 40 attendees; I spoke there and won the live-demo prize.
{
  const event = events.pune;
  const start = Date.parse(event.startsAt);
  const known: [Person, StampRole][] = [
    [me, 'speaker'],
    [person('rohan_sys'), 'hacker'],
    [person('marcus_v'), 'hacker'],
    [person('arjun_n'), 'hacker'],
    [person('nehag'), 'hacker'],
    [person('ananya_ml'), 'organizer'],
  ];
  const next = random(41);
  stampEvent(event, [...known, ...generated.slice(180, 214).map((p): [Person, StampRole] => [p, rolePick(next)])], start + 15 * MINUTE, start + 5 * HOUR, 42);
  issue(event, me, iso(Date.parse(event.endsAt) - 40 * MINUTE), { placement: 'special', track: 'Best live demo', projectName: 'Pulse' });
}

// Genesis Hacks 2025: past hackathon with a full podium.
{
  const event = events.genesis2025;
  const start = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt);
  const known: [Person, StampRole][] = [
    [me, 'hacker'],
    [person('sarathomas'), 'hacker'],
    [person('rohan_sys'), 'hacker'],
    [person('arjun_n'), 'hacker'],
    [person('meera_k'), 'mentor'],
    [person('ananya_ml'), 'organizer'],
  ];
  const next = random(51);
  stampEvent(event, [...known, ...generated.slice(120, 178).map((p): [Person, StampRole] => [p, rolePick(next)])], start + 15 * MINUTE, start + 4 * HOUR, 52);
  const awardAt = iso(end - 2 * HOUR);
  const team = (handles: string[], details: { placement: AwardPlacement; track?: string; projectName?: string; projectUrl?: string }) =>
    handles.forEach((handle) => issue(event, person(handle), awardAt, details));
  team(['gpdev', 'sarathomas'], { placement: 'first', track: 'Health & AI', projectName: 'Pocket Triage' });
  team(['rohan_sys', 'arjun_n', generated[120].user.handle], { placement: 'second', track: 'Health & AI', projectName: 'Ledgerline' });
  team([generated[121].user.handle, generated[122].user.handle], { placement: 'third', track: 'Health & AI', projectName: 'Clinic Queue' });
  team([generated[123].user.handle], { placement: 'special', track: 'Best use of hardware', projectName: 'Soil Whisper' });
  team([generated[124].user.handle, generated[125].user.handle, generated[126].user.handle], { placement: 'finalist', track: 'Climate', projectName: 'Heatmap Hero' });
}

const liveCredentials = () => credentials.filter((credential) => credential.revokedAt === null);

function stripHolder(credential: IssuedCredential): Credential {
  const { holder: _holder, ...rest } = credential;
  return rest;
}

export function credentialsFor(holder: Person): Credential[] {
  return liveCredentials()
    .filter((credential) => credential.holder.id === holder.id)
    .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))
    .map(stripHolder);
}

export function signedPayload(credential: IssuedCredential): string {
  const holder = byId.get(credential.holder.id) ?? me;
  const issuer = credential.issuer ? (byId.get(credential.issuer.id) ?? null) : null;
  const payload: SignedCredentialPayload = {
    v: 1,
    id: credential.id,
    type: credential.type,
    holder: { id: holder.id, handle: holder.user.handle, name: holder.user.name },
    event: { id: credential.event.id, slug: credential.event.slug, name: credential.event.name },
    role: credential.role,
    placement: credential.placement,
    track: credential.track,
    project: credential.projectName || credential.projectUrl ? { name: credential.projectName, url: credential.projectUrl } : null,
    issuer: issuer ? { id: issuer.id, handle: issuer.user.handle } : null,
    issuedAt: credential.issuedAt,
  };
  return canonicalJson(payload);
}

export function verification(credential: IssuedCredential): CredentialVerification {
  const payload = signedPayload(credential);
  return {
    credential: stripHolder(credential),
    holder: credential.holder,
    payload,
    signature: sign(null, Buffer.from(payload), PRIVATE_KEY).toString('base64url'),
    algorithm: 'Ed25519',
    keyId: signingKey.keyId,
    publicKey: signingKey.publicKey,
    keyKnown: true,
    valid: true,
    revoked: credential.revokedAt !== null,
  };
}

// ---------------------------------------------------------------------------
// Vouches
// ---------------------------------------------------------------------------

let vouchSerial = 0;
export const vouches: Vouch[] = [];

function vouch(from: string, to: string, skill: string, message: string, createdAt: string, event: EventSeed | null): Vouch {
  vouchSerial += 1;
  const entry: Vouch = {
    id: uuid(0x5000, vouchSerial),
    voucher: person(from).lite,
    recipientId: person(to).id,
    skill,
    message,
    event: event ? eventLite(event) : null,
    createdAt,
  };
  vouches.push(entry);
  return entry;
}

vouch('elena_zk', 'gpdev', 'Node.js', 'Clean API design — his Ed25519 signing service passed my review on the first try.', ago(6 * MINUTE), events.genesis2026);
vouch('ananya_ml', 'gpdev', 'React', 'Ships polished UI fast and genuinely cares about accessibility.', ago(62 * MINUTE), events.genesis2026);
vouch('ananya_ml', 'gpdev', 'TypeScript', 'Rebuilt our check-in flow overnight before Genesis Hacks — typed end to end, zero surprises at the door.', ago(20 * HOUR), events.genesis2026);
vouch('rohan_sys', 'gpdev', 'PostgreSQL', 'Helped me untangle a nasty deadlock in our migrations. Knows his indexes.', ago(110 * DAY), events.pune);
vouch('gpdev', 'rohan_sys', 'Rust', 'Explained ownership to half the room at the Pune meetup. Writes Rust that reads like prose.', ago(110 * DAY), events.pune);
vouch('gpdev', 'ananya_ml', 'AI / ML', 'Her triage model was the most practical ML demo I saw all year.', ago(20 * HOUR), events.genesis2026);
vouch('meera_k', 'ananya_ml', 'Product', 'Turns messy feedback into clear priorities. Every organizer should work like this.', ago(30 * DAY), null);
vouch('marcus_v', 'priya_builds', 'Mobile', 'Her gesture work in React Native is better than most native apps.', ago(3 * HOUR), events.genesis2026);

const vouchesFor = (holder: Person) =>
  vouches.filter((entry) => entry.recipientId === holder.id).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

// ---------------------------------------------------------------------------
// Connections (owned by @gpdev)
// ---------------------------------------------------------------------------

interface ConnectionSeed {
  handle: string;
  mutual: boolean;
  event: EventSeed | null;
  source: 'scan' | 'scanned';
  createdAt: string;
  notes?: string;
  tags?: string[];
}

const CONNECTION_SEEDS: ConnectionSeed[] = [
  { handle: 'elena_zk', mutual: true, event: events.genesis2026, source: 'scanned', createdAt: ago(10 * MINUTE) },
  {
    handle: 'vik_j',
    mutual: true,
    event: events.genesis2026,
    source: 'scanned',
    createdAt: ago(2 * HOUR),
    notes: 'ESP32 badge hack — wants Loopin codes on e-ink. Send him the token format doc.',
    tags: ['Follow up'],
  },
  {
    handle: 'priya_builds',
    mutual: true,
    event: events.genesis2026,
    source: 'scan',
    createdAt: ago(3 * HOUR + 12 * MINUTE),
    notes: 'Ships React Native apps for a fintech. Interested in the Winter Invitational — intro her to Ananya.',
    tags: ['Teammate'],
  },
  {
    handle: 'rohan_sys',
    mutual: true,
    event: events.genesis2026,
    source: 'scan',
    createdAt: ago(5 * HOUR),
    notes: 'Building a CRDT-backed notes app in Rust; looking for a frontend teammate for the Invitational.',
    tags: ['Teammate', 'Rust'],
  },
  {
    handle: 'meera_k',
    mutual: true,
    event: events.genesis2026,
    source: 'scan',
    createdAt: ago(20 * HOUR),
    notes: 'Offered to audit our forms for accessibility. Book 30 minutes next week.',
    tags: ['Mentor', 'Follow up'],
  },
  {
    handle: 'ananya_ml',
    mutual: true,
    event: events.genesis2026,
    source: 'scan',
    createdAt: ago(26 * HOUR),
    notes: 'Runs Genesis Hacks. Wants a judging mode in Loopin — follow up after demo day.',
    tags: ['Follow up', 'Mentor'],
  },
  { handle: 'kabir_dev', mutual: true, event: null, source: 'scan', createdAt: ago(31 * DAY), tags: ['Hiring'] },
  { handle: 'dpark', mutual: false, event: null, source: 'scan', createdAt: ago(60 * DAY), notes: 'AppSec. Ask about running a bug bounty for Loopin.', tags: ['Follow up'] },
  {
    handle: 'nehag',
    mutual: false,
    event: events.pune,
    source: 'scan',
    createdAt: ago(118 * DAY),
    notes: 'Frontend performance. Gave the Core Web Vitals talk.',
  },
  {
    handle: 'marcus_v',
    mutual: true,
    event: events.pune,
    source: 'scan',
    createdAt: ago(120 * DAY + 3 * HOUR),
    notes: 'Design engineer from SF. Promised to share his Figma-to-code prototype kit.',
    tags: ['Follow up'],
  },
  { handle: 'arjun_n', mutual: true, event: events.pune, source: 'scan', createdAt: ago(120 * DAY + 5 * HOUR), notes: 'Go + Postgres. Knows PGlite internals.' },
  {
    handle: 'sarathomas',
    mutual: true,
    event: events.genesis2025,
    source: 'scan',
    createdAt: ago(365 * DAY),
    notes: 'Teammate at Genesis Hacks 2025 (Pocket Triage). Climate datasets.',
    tags: ['Teammate'],
  },
];

function connectionPeer(peer: Person, mutual: boolean): ConnectionPeer {
  return {
    ...peer.lite,
    openTo: peer.user.openTo,
    location: peer.user.location,
    githubUsername: peer.user.githubUsername,
    linkedinUrl: peer.user.linkedinUrl,
    websiteUrl: peer.user.websiteUrl,
    contact: mutual ? peer.contact : null,
  };
}

export const connections: ConnectionSummary[] = CONNECTION_SEEDS.map((seed, index) => {
  const peer = person(seed.handle);
  return {
    id: uuid(0x3000, index + 1),
    peer: connectionPeer(peer, seed.mutual),
    notes: seed.notes ?? '',
    tags: seed.tags ?? [],
    event: seed.event ? eventLite(seed.event) : null,
    source: seed.source,
    mutual: seed.mutual,
    createdAt: seed.createdAt,
    updatedAt: seed.notes ? iso(Date.parse(seed.createdAt) + 4 * MINUTE) : seed.createdAt,
  };
});

const connectionTo = (peer: Person) => connections.find((connection) => connection.peer.id === peer.id) ?? null;

// ---------------------------------------------------------------------------
// Profiles & stats
// ---------------------------------------------------------------------------

function activityFor(holder: Person): ActivityDay[] {
  const next = random(holder.user.handle.length * 7919 + holder.id.charCodeAt(holder.id.length - 1));
  const days = new Map<string, number>();
  const busy = holder.id === me.id ? 0.24 : 0.08;
  for (let offset = 364; offset >= 0; offset--) {
    if (next() < busy) days.set(new Date(NOW - offset * DAY).toISOString().slice(0, 10), 1 + Math.floor(next() * (next() < 0.2 ? 9 : 4)));
  }
  // Event days are always busy.
  for (const credential of credentialsFor(holder)) {
    const day = credential.issuedAt.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 3);
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
}

function xpFor(holder: Person): number {
  const held = credentialsFor(holder);
  const awards: Partial<Record<AwardPlacement, number>> = {};
  for (const credential of held) if (credential.placement) awards[credential.placement] = (awards[credential.placement] ?? 0) + 1;
  return computeXp({
    connections: holder.id === me.id ? connections.filter((connection) => connection.mutual).length : holder.connections,
    stamps: held.filter((credential) => credential.type === 'stamp').length,
    vouchesReceived: new Set(vouchesFor(holder).map((entry) => entry.voucher.id)).size,
    awards,
    profileComplete: isProfileComplete(holder.user),
  });
}

const xpTable = new Map(people.map((entry) => [entry.id, xpFor(entry)]));

export function statsFor(holder: Person): ProfileStats {
  const xp = xpTable.get(holder.id) ?? 0;
  const held = credentialsFor(holder);
  const stamps = held.filter((credential) => credential.type === 'stamp');
  return {
    xp,
    ...tierProgress(xp),
    rank: 1 + [...xpTable.values()].filter((other) => other > xp).length,
    totalRanked: people.length,
    connections: holder.id === me.id ? connections.filter((connection) => connection.mutual).length : holder.connections,
    events: new Set(stamps.map((credential) => credential.event.id)).size,
    stamps: stamps.length,
    awards: held.length - stamps.length,
    vouches: vouchesFor(holder).length,
  };
}

/** Full profile as `viewer` sees it (null = signed out). */
export function profileView(holder: Person, viewer: Person | null): ProfileView {
  const isSelf = viewer?.id === holder.id;
  const own = viewer && !isSelf && viewer.id === me.id ? connectionTo(holder) : null;
  const mutual = Boolean(own?.mutual);
  return {
    user: holder.user,
    contact: isSelf || mutual ? holder.contact : null,
    stats: statsFor(holder),
    credentials: credentialsFor(holder),
    vouches: vouchesFor(holder),
    activity: activityFor(holder),
    visibility: holder.visibility,
    relationship: { isSelf, connectionId: own?.id ?? null, mutual },
  };
}

export function profileResponse(holder: Person, viewer: Person | null): ProfileResponse {
  const view = profileView(holder, viewer);
  if (holder.visibility === 'connections' && !view.relationship.isSelf && !view.relationship.mutual) {
    return { restricted: true, user: { ...holder.lite, headline: '' } };
  }
  return { restricted: false, profile: view };
}

export function meAccount(): Me {
  return {
    ...me.user,
    role: me.role,
    ...me.contact,
    email: me.email,
    emailVerified: true,
    visibility: me.visibility,
    hasPassword: true,
    githubLinked: true,
  };
}

// ---------------------------------------------------------------------------
// Live: announcements, notifications
// ---------------------------------------------------------------------------

let announcementSerial = 0;
function announcement(fields: Omit<Announcement, 'id' | 'event' | 'author'> & { event: EventSeed | null; author: Person }): Announcement {
  announcementSerial += 1;
  return { ...fields, id: uuid(0x6000, announcementSerial), event: fields.event ? eventLite(fields.event) : null, author: fields.author.lite };
}

const ananya = person('ananya_ml');

export const announcements: Announcement[] = [
  announcement({
    title: 'Final judging moves to Hall B',
    body: 'Judging starts at 4:30 PM in Hall B (ground floor). Teams presenting in slots 1–12, please be seated by 4:15 with your demo ready.',
    kind: 'alert',
    urgent: true,
    actionLabel: null,
    actionUrl: null,
    location: 'Hall B, ground floor',
    event: events.genesis2026,
    author: ananya,
    createdAt: ago(18 * MINUTE),
  }),
  announcement({
    title: 'Dinner is served',
    body: 'The food court is open until 10 PM. Vegan and Jain options are on the left counter — please bring your badge.',
    kind: 'update',
    urgent: false,
    actionLabel: null,
    actionUrl: null,
    location: 'Food court, level 2',
    event: events.genesis2026,
    author: ananya,
    createdAt: ago(2 * HOUR + 5 * MINUTE),
  }),
  announcement({
    title: 'Mentor office hours',
    body: 'Book a 15-minute slot with mentors from the Health & AI, Fintech and hardware tracks. New slots open every hour.',
    kind: 'info',
    urgent: false,
    actionLabel: 'Book a slot',
    actionUrl: 'https://example.com/genesis-hacks/mentors',
    location: null,
    event: events.genesis2026,
    author: me,
    createdAt: ago(5 * HOUR),
  }),
  announcement({
    title: 'Welcome to Genesis Hacks 2026',
    body: 'Wi-Fi: GenesisHacks-Guest · password build2026\nCheck in at the registration desk to get your Hacker stamp. Hacking ends tomorrow at 2 PM.',
    kind: 'info',
    urgent: false,
    actionLabel: null,
    actionUrl: null,
    location: 'Registration desk',
    event: events.genesis2026,
    author: ananya,
    createdAt: istAt(-1, 8, 45),
  }),
  announcement({
    title: 'Winter Invitational applications are open',
    body: 'Finalists from this season can apply for the Genesis Winter Invitational in Goa. Applications close in three weeks.',
    kind: 'update',
    urgent: false,
    actionLabel: 'Apply',
    actionUrl: 'https://example.com/genesis-hacks/winter',
    location: null,
    event: null,
    author: ananya,
    createdAt: ago(2 * DAY + 3 * HOUR),
  }),
  announcement({
    title: 'Venue change: Hall 2',
    body: 'The meetup has moved to Hall 2 on the first floor. Follow the yellow signs from the main entrance.',
    kind: 'alert',
    urgent: true,
    actionLabel: null,
    actionUrl: null,
    location: 'Hall 2, first floor',
    event: events.pune,
    author: ananya,
    createdAt: iso(Date.parse(events.pune.startsAt) - 40 * MINUTE),
  }),
].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

const elenaConnection = connections[0];
const myHackerStamp = credentialsFor(me).find((credential) => credential.role === 'hacker' && credential.event.id === events.genesis2026.id);

export const notifications: Notification[] = [
  {
    id: uuid(0x7000, 1),
    kind: 'vouch',
    actor: person('elena_zk').lite,
    title: 'Elena Kovač vouched for your Node.js',
    body: 'Clean API design — his Ed25519 signing service passed my review on the first try.',
    link: '/passport?tab=vouches',
    readAt: null,
    createdAt: ago(6 * MINUTE),
  },
  {
    id: uuid(0x7000, 2),
    kind: 'connection',
    actor: person('elena_zk').lite,
    title: 'Elena Kovač connected with you',
    body: 'Met at Genesis Hacks 2026',
    link: `/network/${elenaConnection.id}`,
    readAt: null,
    createdAt: ago(10 * MINUTE),
  },
  {
    id: uuid(0x7000, 3),
    kind: 'vouch',
    actor: ananya.lite,
    title: 'Ananya Iyer vouched for your React',
    body: 'Ships polished UI fast and genuinely cares about accessibility.',
    link: '/passport?tab=vouches',
    readAt: null,
    createdAt: ago(62 * MINUTE),
  },
  {
    id: uuid(0x7000, 4),
    kind: 'connection',
    actor: person('vik_j').lite,
    title: 'Vikram Joshi connected with you',
    body: 'Met at Genesis Hacks 2026',
    link: `/network/${connections[1].id}`,
    readAt: ago(90 * MINUTE),
    createdAt: ago(2 * HOUR),
  },
  {
    id: uuid(0x7000, 5),
    kind: 'stamp',
    actor: ananya.lite,
    title: "You're checked in to Genesis Hacks 2026",
    body: 'Hacker stamp added to your passport',
    link: myHackerStamp ? `/verify/${myHackerStamp.id}` : null,
    readAt: istAt(-1, 10),
    createdAt: istAt(-1, 9, 42),
  },
  {
    id: uuid(0x7000, 6),
    kind: 'award',
    actor: ananya.lite,
    title: 'Special prize · Hackers Occupied Pune',
    body: 'Best live demo · Pulse',
    link: '/passport?tab=awards',
    readAt: ago(119 * DAY),
    createdAt: iso(Date.parse(events.pune.endsAt) - 40 * MINUTE),
  },
];

// ---------------------------------------------------------------------------
// Organizer & admin views
// ---------------------------------------------------------------------------

function attendeesOf(event: EventSeed): Attendee[] {
  return liveCredentials()
    .filter((credential) => credential.type === 'stamp' && credential.event.id === event.id && credential.role)
    .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))
    .map((credential) => ({ user: credential.holder, role: credential.role as StampRole, credentialId: credential.id, stampedAt: credential.issuedAt }));
}

const CONNECTIONS_MADE: Record<string, number> = {
  [events.genesis2026.id]: 1240,
  [events.pune.id]: 212,
  [events.genesis2025.id]: 980,
};

export function eventStats(event: EventSeed): EventStats {
  const live = liveCredentials().filter((credential) => credential.event.id === event.id);
  const stamps = live.filter((credential) => credential.type === 'stamp');
  return {
    checkIns: stamps.length,
    attendees: new Set(stamps.map((credential) => credential.holder.id)).size,
    rsvpCount: event.rsvpCount,
    connectionsMade: CONNECTIONS_MADE[event.id] ?? 0,
    awards: live.length - stamps.length,
    announcements: announcements.filter((entry) => entry.event?.id === event.id).length,
  };
}

function adminUser(entry: Person): AdminUser {
  return { ...entry.lite, email: entry.email, role: entry.role, createdAt: entry.user.createdAt };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const asRecord = (body: unknown): Record<string, unknown> => (body && typeof body === 'object' ? (body as Record<string, unknown>) : {});
const str = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

function requireEvent(ctx: FixtureContext, param = 'id') {
  return findEvent(ctx.params[param] ?? '');
}

const notFound = (message = "We couldn't find that.") => apiError(404, 'not_found', message);

function authResponse(isNewUser: boolean, account: Me = meAccount()): AuthResponse {
  return { token: 'lp_ui_snap_fixture_session_token', user: account, isNewUser };
}

function badgeKey(): BadgeKey {
  return {
    key: createHash('sha256').update('loopin-ui-snap-badge-key').digest().toString('base64url'),
    badgeId: uuid(0x8000, 1),
    slotSeconds: 30,
    serverTime: new Date().toISOString(),
  };
}

export const handlers: FixtureHandlers = {
  'GET /api/health': () => ok<HealthResponse>({ status: 'ok', db: 'ok', version: '1.0.0', time: new Date().toISOString() }),

  // --- Auth -----------------------------------------------------------------
  'GET /api/auth/providers': () => ok<AuthProviders>({ github: true, passwordReset: true }),
  'GET /api/auth/handle-available': (ctx) => {
    const parsed = handleSchema.safeParse(ctx.url.searchParams.get('handle') ?? '');
    if (!parsed.success) return ok<HandleAvailability>({ available: false, reason: parsed.error.issues[0]?.message ?? 'Invalid handle' });
    if (byHandle.has(parsed.data) && !(ctx.authed && parsed.data === me.user.handle)) {
      return ok<HandleAvailability>({ available: false, handle: parsed.data, reason: 'That handle is taken' });
    }
    return ok<HandleAvailability>({ available: true, handle: parsed.data });
  },
  'POST /api/auth/signup': (ctx) => {
    const body = asRecord(ctx.body);
    const handle = str(body.handle)?.toLowerCase().replace(/^@/, '') ?? 'newbuilder';
    if (byHandle.has(handle)) return apiError(409, 'conflict', 'That handle is taken', { handle: 'That handle is taken' });
    const account: Me = {
      id: uuid(0x1000, 999),
      handle,
      name: str(body.name) ?? 'New Builder',
      headline: '',
      avatarUrl: null,
      bio: '',
      location: '',
      githubUsername: null,
      linkedinUrl: null,
      websiteUrl: null,
      skills: [],
      openTo: [],
      role: 'member',
      createdAt: new Date().toISOString(),
      contactEmail: null,
      phone: null,
      email: str(body.email) ?? `${handle}@example.com`,
      emailVerified: false,
      visibility: 'public',
      hasPassword: true,
      githubLinked: false,
    };
    return created<AuthResponse>(authResponse(true, account));
  },
  'POST /api/auth/login': (ctx) => {
    const body = asRecord(ctx.body);
    if (str(body.password) !== 'loopin-demo') return apiError(401, 'invalid_credentials', 'Incorrect email or password.');
    return ok<AuthResponse>(authResponse(false));
  },
  'POST /api/auth/logout': () => noContent(),
  'POST /api/auth/logout-all': () => noContent(),
  'GET /api/auth/me': (ctx) => (ctx.authed ? ok<MeResponse>({ user: meAccount() }) : unauthorized()),
  'POST /api/auth/password': (ctx) => {
    if (!ctx.authed) return unauthorized();
    if (str(asRecord(ctx.body).currentPassword) !== 'loopin-demo') {
      return apiError(401, 'invalid_credentials', 'Your current password is incorrect.', { currentPassword: 'Your current password is incorrect.' });
    }
    return noContent();
  },
  'POST /api/auth/forgot': () => noContent(),
  'POST /api/auth/reset': () => ok<AuthResponse>(authResponse(false)),
  'POST /api/auth/github/exchange': () => ok<AuthResponse>(authResponse(false)),

  // --- Me -------------------------------------------------------------------
  'PATCH /api/me': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const body = asRecord(ctx.body);
    const handle = str(body.handle);
    if (handle && handle !== me.user.handle && byHandle.has(handle)) return apiError(409, 'conflict', 'That handle is taken', { handle: 'That handle is taken' });
    return ok<MeResponse>({ user: { ...meAccount(), ...(body as Partial<Me>) } });
  },
  'GET /api/me/profile': (ctx) => (ctx.authed ? ok<ProfileView>(profileView(me, me)) : unauthorized()),
  'GET /api/me/badge-key': (ctx) => (ctx.authed ? ok<BadgeKey>(badgeKey()) : unauthorized()),
  'POST /api/me/badge-key/rotate': (ctx) => (ctx.authed ? ok<BadgeKey>({ ...badgeKey(), badgeId: uuid(0x8000, 2) }) : unauthorized()),
  'GET /api/me/export': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const exported: AccountExport = {
      exportedAt: new Date().toISOString(),
      account: meAccount(),
      profile: profileView(me, me),
      connections,
      vouchesGiven: vouches.filter((entry) => entry.voucher.id === me.id),
      vouchesReceived: vouchesFor(me),
      credentials: credentials.filter((credential) => credential.holder.id === me.id).map(stripHolder),
      credentialsIssued: credentials.filter((credential) => credential.issuer?.id === me.id),
      eventsCreated: [],
      announcementsAuthored: announcements.filter((entry) => entry.author?.id === me.id),
      rsvps: allEvents.filter((event) => event.myRsvp).map((event) => ({ event: eventLite(event), createdAt: ago(12 * DAY) })),
      notifications,
      sessions: [
        { createdAt: ago(3 * DAY), lastUsedAt: ago(4 * MINUTE), expiresAt: iso(NOW + 27 * DAY), userAgent: 'Safari on iPhone', current: true },
        { createdAt: ago(20 * DAY), lastUsedAt: ago(2 * DAY), expiresAt: iso(NOW + 10 * DAY), userAgent: 'Chrome on macOS', current: false },
      ],
    };
    return { status: 200, json: exported, headers: { 'content-disposition': `attachment; filename="loopin-export-${me.user.handle}.json"` } };
  },
  'DELETE /api/me': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const confirm = str(asRecord(ctx.body).confirmHandle)?.toLowerCase().replace(/^@/, '');
    if (confirm !== me.user.handle) return apiError(400, 'bad_request', 'Type your handle to confirm.', { confirmHandle: 'Type your handle to confirm.' });
    return noContent();
  },

  // --- Profiles -------------------------------------------------------------
  'GET /api/profiles/:handle': (ctx) => {
    const holder = byHandle.get(ctx.params.handle.toLowerCase());
    if (!holder) return notFound('No one with that handle.');
    return ok<ProfileResponse>(profileResponse(holder, ctx.authed ? me : null));
  },

  // --- Badge & connections --------------------------------------------------
  'GET /api/badge/preview': () =>
    ok<BadgePreview>({
      user: person('priya_builds').lite,
      expiresAt: iso(NOW + 75_000),
      connectTicket: `lpt_${createHash('sha256').update('loopin-ui-snap-ticket').digest().toString('base64url')}${'A'.repeat(7)}`,
    }),
  'POST /api/connections/exchange': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const peer = person('ishaan_v');
    const result: ExchangeResult = {
      connection: {
        id: uuid(0x3000, 100),
        peer: connectionPeer(peer, true),
        notes: '',
        tags: [],
        event: eventLite(events.genesis2026),
        source: 'scan',
        mutual: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      alreadyConnected: false,
    };
    return created<ExchangeResult>(result);
  },
  'GET /api/connections': (ctx) => (ctx.authed ? ok<ConnectionList>({ connections }) : unauthorized()),
  'GET /api/connections/:id': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const connection = connections.find((entry) => entry.id === ctx.params.id);
    if (!connection) return notFound();
    const peer = byId.get(connection.peer.id);
    if (!peer) return notFound();
    return ok<ConnectionDetail>({ connection, profile: profileResponse(peer, me) });
  },
  'PATCH /api/connections/:id': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const connection = connections.find((entry) => entry.id === ctx.params.id);
    if (!connection) return notFound();
    const body = asRecord(ctx.body);
    const eventId = body.eventId;
    const event = typeof eventId === 'string' ? findEvent(eventId) : undefined;
    return ok<ConnectionResponse>({
      connection: {
        ...connection,
        notes: str(body.notes) ?? connection.notes,
        tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === 'string') : connection.tags,
        event: eventId === null ? null : event ? eventLite(event) : connection.event,
        updatedAt: new Date().toISOString(),
      },
    });
  },
  'DELETE /api/connections/:id': (ctx) => (ctx.authed ? noContent() : unauthorized()),

  // --- Vouches --------------------------------------------------------------
  'POST /api/vouches': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const body = asRecord(ctx.body);
    const recipient = byId.get(str(body.recipientId) ?? '');
    if (!recipient) return apiError(400, 'bad_request', "That person doesn't exist");
    if (!connectionTo(recipient)?.mutual) return apiError(403, 'not_connected', 'You can only vouch for people you’re connected with.');
    const entry: Vouch = {
      id: uuid(0x5000, 900),
      voucher: me.lite,
      recipientId: recipient.id,
      skill: str(body.skill) ?? 'TypeScript',
      message: str(body.message) ?? '',
      event: eventLite(events.genesis2026),
      createdAt: new Date().toISOString(),
    };
    return created<VouchResponse>({ vouch: entry });
  },
  'DELETE /api/vouches/:id': (ctx) => (ctx.authed ? noContent() : unauthorized()),

  // --- Notifications & stream -----------------------------------------------
  'GET /api/notifications': (ctx) =>
    ctx.authed
      ? ok<NotificationList>({ notifications, unreadCount: notifications.filter((entry) => entry.readAt === null).length })
      : unauthorized(),
  'POST /api/notifications/read': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const ids = asRecord(ctx.body).ids;
    const read = Array.isArray(ids) ? new Set(ids) : null;
    return ok<UnreadCount>({ unreadCount: read ? notifications.filter((entry) => entry.readAt === null && !read.has(entry.id)).length : 0 });
  },
  'GET /api/stream': (ctx) =>
    ctx.authed
      ? {
          status: 200,
          headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform' },
          body: 'retry: 5000\n\ndata: {"type":"ready"}\n\n',
        }
      : unauthorized(),

  // --- Events ---------------------------------------------------------------
  'GET /api/events': (ctx) => ok<EventList>({ events: [...allEvents].sort(eventOrder).map((event) => eventSummary(event, ctx.authed)) }),
  'GET /api/events/:idOrSlug': (ctx) => {
    const event = findEvent(ctx.params.idOrSlug);
    return event ? ok<EventResponse>({ event: eventSummary(event, ctx.authed) }) : notFound();
  },
  'POST /api/events': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const body = asRecord(ctx.body);
    const name = str(body.name) ?? 'New event';
    const event = makeEvent(50, name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name, 'hackathon', str(body.location) ?? '', str(body.startsAt) ?? istAt(30, 9), str(body.endsAt) ?? istAt(31, 18), {
      tagline: str(body.tagline) ?? '',
      description: str(body.description) ?? '',
      isActive: body.isActive === true,
    });
    return created<EventResponse>({ event: eventSummary(event) });
  },
  'PATCH /api/events/:id': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const event = requireEvent(ctx);
    if (!event) return notFound();
    return ok<EventResponse>({ event: { ...eventSummary(event), ...(asRecord(ctx.body) as Partial<EventSummary>) } });
  },
  'DELETE /api/events/:id': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const event = requireEvent(ctx);
    if (!event) return notFound();
    if (credentials.some((credential) => credential.event.id === event.id)) {
      return apiError(409, 'conflict', "This event has issued stamps or awards, so it can't be deleted. Turn off Active instead.");
    }
    return noContent();
  },
  'PUT /api/events/:id/rsvp': (ctx) => {
    const event = requireEvent(ctx);
    if (!ctx.authed) return unauthorized();
    if (!event) return notFound();
    return ok<RsvpState>({ rsvpCount: event.rsvpCount + (event.myRsvp ? 0 : 1), myRsvp: true });
  },
  'DELETE /api/events/:id/rsvp': (ctx) => {
    const event = requireEvent(ctx);
    if (!ctx.authed) return unauthorized();
    if (!event) return notFound();
    return ok<RsvpState>({ rsvpCount: event.rsvpCount - (event.myRsvp ? 1 : 0), myRsvp: false });
  },
  'GET /api/events/:id/stats': (ctx) => {
    const event = requireEvent(ctx);
    return event ? ok<EventStats>(eventStats(event)) : notFound();
  },
  'GET /api/events/:id/attendees': (ctx) => {
    const event = requireEvent(ctx);
    return event ? ok<AttendeeList>({ attendees: attendeesOf(event) }) : notFound();
  },
  'GET /api/events/:id/announcements': (ctx) => {
    const event = requireEvent(ctx);
    return event ? ok<AnnouncementList>({ announcements: announcements.filter((entry) => entry.event?.id === event.id) }) : notFound();
  },
  'GET /api/organizer/events': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const list: OrganizerEvent[] = [...allEvents].sort(eventOrder).map((event) => ({ ...eventSummary(event), stats: eventStats(event) }));
    return ok<OrganizerEventList>({ events: list });
  },

  // --- Credentials ----------------------------------------------------------
  'POST /api/events/:id/check-in': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const event = requireEvent(ctx);
    if (!event) return notFound();
    const body = asRecord(ctx.body);
    const role = (str(body.role) ?? 'hacker') as StampRole;
    const handle = str(body.handle)?.toLowerCase().replace(/^@/, '');
    const holder = handle ? byHandle.get(handle) : walkIn;
    if (!holder) return apiError(404, 'not_found', 'No one with that handle', { handle: 'No one with that handle' });
    const existing = liveCredentials().find(
      (credential) => credential.type === 'stamp' && credential.event.id === event.id && credential.holder.id === holder.id && credential.role === role,
    );
    if (existing) return ok<CheckInResult>({ credential: stripHolder(existing), holder: holder.lite, alreadyStamped: true });
    const credential: Credential = {
      id: uuid(0x4000, 9000),
      type: 'stamp',
      role,
      placement: null,
      track: null,
      projectName: null,
      projectUrl: null,
      event: eventLite(event),
      issuer: me.lite,
      issuedAt: new Date().toISOString(),
      revokedAt: null,
    };
    return created<CheckInResult>({ credential, holder: holder.lite, alreadyStamped: false });
  },
  'POST /api/events/:id/awards': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const event = requireEvent(ctx);
    if (!event) return notFound();
    const body = asRecord(ctx.body);
    const handles = Array.isArray(body.handles) ? body.handles.filter((value): value is string => typeof value === 'string') : [];
    const unknown = handles.filter((handle) => !byHandle.has(handle.toLowerCase().replace(/^@/, '')));
    if (unknown.length > 0) {
      const message = `No one with handle ${unknown.map((handle) => formatHandle(handle)).join(', ')}`;
      return apiError(404, 'not_found', message, { handles: message });
    }
    const placement = (str(body.placement) ?? 'first') as AwardPlacement;
    const issued: IssuedCredential[] = handles.map((handle, index) => ({
      id: uuid(0x4000, 9100 + index),
      type: 'award',
      role: null,
      placement,
      track: str(body.track) || null,
      projectName: str(body.projectName) || null,
      projectUrl: str(body.projectUrl) || null,
      event: eventLite(event),
      issuer: me.lite,
      issuedAt: new Date().toISOString(),
      revokedAt: null,
      holder: person(handle.toLowerCase().replace(/^@/, '')).lite,
    }));
    return created<AwardResult>({ credentials: issued });
  },
  'GET /api/events/:id/credentials': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const event = requireEvent(ctx);
    if (!event) return notFound();
    return ok<IssuedCredentialList>({
      credentials: credentials
        .filter((credential) => credential.event.id === event.id)
        .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt)),
    });
  },
  'DELETE /api/credentials/:id': (ctx) => (ctx.authed ? noContent() : unauthorized()),
  'GET /api/credentials/:id': (ctx) => {
    const credential = credentials.find((entry) => entry.id === ctx.params.id);
    return credential ? ok<CredentialVerification>(verification(credential)) : notFound("We couldn't find that credential.");
  },
  'GET /api/keys': () => ok<SigningKeyInfo>(signingKey),

  // --- Announcements & feed -------------------------------------------------
  'GET /api/feed': (ctx) => {
    const upcoming = [...allEvents].filter((event) => event.isActive || Date.parse(event.endsAt) >= NOW).sort(eventOrder);
    const active = upcoming.find((event) => event.isActive) ?? null;
    return ok<Feed>({
      announcements,
      events: upcoming.map((event) => eventSummary(event, ctx.authed)),
      activeEvent: active ? eventSummary(active, ctx.authed) : null,
    });
  },
  'POST /api/announcements': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const body = asRecord(ctx.body);
    const event = typeof body.eventId === 'string' ? findEvent(body.eventId) : undefined;
    const entry: Announcement = {
      id: uuid(0x6000, 900),
      title: str(body.title) ?? 'Announcement',
      body: str(body.body) ?? '',
      kind: (str(body.kind) as Announcement['kind'] | undefined) ?? 'info',
      urgent: body.urgent === true,
      actionLabel: str(body.actionLabel) || null,
      actionUrl: str(body.actionUrl) || null,
      location: str(body.location) || null,
      event: event ? eventLite(event) : null,
      author: me.lite,
      createdAt: new Date().toISOString(),
    };
    return created<AnnouncementResponse>({ announcement: entry });
  },
  'DELETE /api/announcements/:id': (ctx) => (ctx.authed ? noContent() : unauthorized()),

  // --- Admin ----------------------------------------------------------------
  'GET /api/admin/users': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const query = (ctx.url.searchParams.get('q') ?? '').trim().toLowerCase();
    const users = people
      .filter((entry) => !query || [entry.user.handle, entry.user.name, entry.email].some((field) => field.toLowerCase().includes(query)))
      .sort((a, b) => Date.parse(b.user.createdAt) - Date.parse(a.user.createdAt))
      .slice(0, 50)
      .map(adminUser);
    return ok<AdminUserList>({ users });
  },
  'PATCH /api/admin/users/:id/role': (ctx) => {
    if (!ctx.authed) return unauthorized();
    const target = byId.get(ctx.params.id);
    if (!target) return notFound();
    if (target.id === me.id) return apiError(400, 'bad_request', "You can't change your own role.");
    const role = str(asRecord(ctx.body).role) as UserRole | undefined;
    return ok<AdminUserResponse>({ user: { ...adminUser(target), role: role ?? target.role } });
  },
};
