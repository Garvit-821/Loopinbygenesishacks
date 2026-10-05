/**
 * Shared test utilities (SPEC §3.7).
 *
 *   let t: TestContext;
 *   beforeAll(async () => { t = await createTestContext(); });
 *   afterAll(() => t.close());
 *   const res = await request(t.app).get('/api/auth/me').set(await authHeader(t, user));
 *
 * Each test file gets its own database: in-memory PGlite, or — when TEST_DATABASE_URL points at a Postgres
 * server — a fresh database created for the file and dropped by close(). Set TEST_LOG_LEVEL=debug to see logs.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { and, eq, isNull } from 'drizzle-orm';
import type { Express } from 'express';
import pg from 'pg';
import {
  badgeSlotAt,
  createBadgeToken,
  isProfileComplete,
  type AwardPlacement,
  type CredentialType,
  type SignedCredentialPayload,
  type StampRole,
  type XpCounts,
} from '@loopin/shared';
import { createApp } from '../src/app';
import type { AppContext, Executor } from '../src/context';
import { createDb, type DbHandle } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import {
  connections,
  credentials,
  events,
  users,
  vouches,
  type ConnectionRow,
  type CredentialRow,
  type EventRow,
  type NewEvent,
  type NewUser,
  type SessionRow,
  type UserRow,
  type VouchRow,
} from '../src/db/schema';
import { PGLITE_MEMORY, loadEnv } from '../src/env';
import { deriveBadgeKey } from '../src/lib/badge';
import { createBus } from '../src/lib/bus';
import { canonicalJson } from '../src/lib/canonical';
import { createLogger } from '../src/lib/logger';
import { createCapturingMailer, type CapturingMailer } from '../src/lib/mailer';
import { createSigner, type Signer } from '../src/lib/signing';
import { createSession } from '../src/services/sessions';

/** Password of every createUser() account. */
export const TEST_PASSWORD = 'password123';
/** Precomputed scrypt hash of TEST_PASSWORD (current parameters), so creating users costs no hashing. */
export const TEST_PASSWORD_HASH =
  'scrypt$16384$8$5$+idwIcbYSxJ4Syyp8CYoRA==$lnI7Hgi8Mb1BYTDnSD6V9X05ATKOeT6SVWTmeakurU1Grlu//hk4r+SGgiWZ/akymJ0MVakf7k62+Ig0AEU85Q==';

/** Fixed secrets (32 bytes each, base64url) so codes and signatures are reproducible. */
export const TEST_SECRETS = {
  QR_SECRET: Buffer.from('loopin-test-qr-secret-32-bytes!!').toString('base64url'),
  SIGNING_KEY: Buffer.from('loopin-test-ed25519-seed-32bytes').toString('base64url'),
} as const;

/** Base env for tests; createTestContext({ env }) overrides individual values. */
export const TEST_ENV: Readonly<Record<string, string>> = {
  NODE_ENV: 'test',
  APP_URL: 'http://localhost:5173',
  SERVE_WEB: 'false',
  ...TEST_SECRETS,
};

export interface TestContext extends AppContext {
  app: Express;
  mailer: CapturingMailer;
  database: DbHandle;
  /** Start a real HTTP server on a random port (e.g. for SSE); returns its base URL. close() stops it. */
  listen(): Promise<string>;
  /** Close servers, live streams and the database (and drop the per-file Postgres database). */
  close(): Promise<void>;
}

export interface TestContextOptions {
  /** Env variables to add or override (strings, exactly as they would appear in process.env). */
  env?: Record<string, string | undefined>;
}

interface ProvisionedDatabase {
  env: Record<string, string>;
  drop(): Promise<void>;
}

async function withAdminClient(url: string, run: (client: pg.Client) => Promise<void>): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await run(client);
  } finally {
    await client.end();
  }
}

async function provisionDatabase(): Promise<ProvisionedDatabase> {
  const adminUrl = process.env.TEST_DATABASE_URL;
  if (!adminUrl) return { env: { PGLITE_DIR: PGLITE_MEMORY }, drop: async () => undefined };
  const name = `loopin_test_${process.pid}_${randomBytes(4).toString('hex')}`;
  await withAdminClient(adminUrl, (client) => client.query(`create database "${name}"`).then(() => undefined));
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return {
    env: { DATABASE_URL: url.toString() },
    drop: () => withAdminClient(adminUrl, (client) => client.query(`drop database if exists "${name}" with (force)`).then(() => undefined)),
  };
}

export async function createTestContext(options: TestContextOptions = {}): Promise<TestContext> {
  const provisioned = await provisionDatabase();
  const { env } = loadEnv({
    ...TEST_ENV,
    LOG_LEVEL: process.env.TEST_LOG_LEVEL ?? 'silent',
    ...provisioned.env,
    ...options.env,
  });
  const logger = createLogger(env);
  const database = await createDb(env, logger);
  await runMigrations(database);
  const mailer = createCapturingMailer();
  const ctx: AppContext = {
    env,
    db: database.db,
    logger,
    signer: createSigner(env.SIGNING_KEY, env.SIGNING_PUBLIC_KEYS_PREVIOUS),
    bus: createBus({ maxStreams: env.STREAM_MAX }),
    mailer,
  };
  const app = createApp(ctx);
  const servers = new Set<Server>();

  // Extend the same object: rate limiters are memoized per AppContext identity.
  return Object.assign(ctx, {
    app,
    mailer,
    database,
    async listen() {
      const server = createServer(app);
      servers.add(server);
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    },
    async close() {
      ctx.bus.closeAll();
      await Promise.all(
        [...servers].map(
          (server) =>
            new Promise<void>((resolve) => {
              server.closeAllConnections();
              server.close(() => resolve());
            }),
        ),
      );
      await database.close();
      await provisioned.drop();
    },
  });
}

let sequence = 0;
function uniqueSuffix(): string {
  sequence += 1;
  return `${sequence}${randomBytes(2).toString('hex')}`;
}

/** Insert a user directly (password TEST_PASSWORD). Override any column, e.g. { role: 'organizer' }. */
export async function createUser(ex: Executor, overrides: Partial<NewUser> = {}): Promise<UserRow> {
  const suffix = uniqueSuffix();
  const [user] = await ex
    .insert(users)
    .values({
      email: `user${suffix}@test.loopin.dev`,
      handle: `user_${suffix}`,
      name: `Test User ${suffix}`,
      passwordHash: TEST_PASSWORD_HASH,
      ...overrides,
    })
    .returning();
  if (!user) throw new Error('createUser: insert returned no row');
  return user;
}

/** Create a session row for `user` and return its raw token, the row, and ready-to-use headers. */
export async function createTestSession(
  ctx: AppContext,
  user: Pick<UserRow, 'id'>,
): Promise<{ token: string; session: SessionRow; headers: { Authorization: string } }> {
  const { token, session } = await createSession(ctx.db, { userId: user.id, userAgent: 'vitest', ttlDays: ctx.env.SESSION_TTL_DAYS });
  return { token, session, headers: { Authorization: `Bearer ${token}` } };
}

/** `{ Authorization: 'Bearer lp_…' }` for a new session of `user` (use with supertest's `.set()`). */
export async function authHeader(ctx: AppContext, user: Pick<UserRow, 'id'>): Promise<{ Authorization: string }> {
  return (await createTestSession(ctx, user)).headers;
}

async function setRole(ex: Executor, user: Pick<UserRow, 'id'>, role: UserRow['role']): Promise<UserRow> {
  const [updated] = await ex.update(users).set({ role }).where(eq(users.id, user.id)).returning();
  if (!updated) throw new Error('setRole: user not found');
  return updated;
}

export const makeOrganizer = (ex: Executor, user: Pick<UserRow, 'id'>): Promise<UserRow> => setRole(ex, user, 'organizer');
export const makeAdmin = (ex: Executor, user: Pick<UserRow, 'id'>): Promise<UserRow> => setRole(ex, user, 'admin');

/** The badge token `user`'s device would show now (+ slotOffset × 30 s). */
export function mintBadgeToken(ctx: Pick<AppContext, 'env'>, user: Pick<UserRow, 'badgeId'>, slotOffset = 0): Promise<string> {
  return createBadgeToken(deriveBadgeKey(ctx.env, user.badgeId), user.badgeId, badgeSlotAt(Date.now()) + slotOffset);
}

/** Both connection rows (a → b as 'scan', b → a as 'scanned'), i.e. a mutual connection. */
export async function connectMutually(
  ex: Executor,
  a: Pick<UserRow, 'id'>,
  b: Pick<UserRow, 'id'>,
  options: { eventId?: string | null } = {},
): Promise<{ aToB: ConnectionRow; bToA: ConnectionRow }> {
  const eventId = options.eventId ?? null;
  const rows = await ex
    .insert(connections)
    .values([
      { ownerId: a.id, peerId: b.id, source: 'scan', eventId },
      { ownerId: b.id, peerId: a.id, source: 'scanned', eventId },
    ])
    .returning();
  const aToB = rows.find((row) => row.ownerId === a.id);
  const bToA = rows.find((row) => row.ownerId === b.id);
  if (!aToB || !bToA) throw new Error('connectMutually: insert returned no rows');
  return { aToB, bToA };
}

/** Insert an event (default: a hackathon that started an hour ago, ends tomorrow, not switched active). */
export async function createEvent(ex: Executor, overrides: Partial<NewEvent> = {}): Promise<EventRow> {
  const suffix = uniqueSuffix();
  const now = Date.now();
  const [event] = await ex
    .insert(events)
    .values({
      slug: `test-event-${suffix}`,
      name: `Test Event ${suffix}`,
      kind: 'hackathon',
      startsAt: new Date(now - 60 * 60 * 1000),
      endsAt: new Date(now + 24 * 60 * 60 * 1000),
      ...overrides,
    })
    .returning();
  if (!event) throw new Error('createEvent: insert returned no row');
  return event;
}

export interface TestCredentialInput {
  holder: Pick<UserRow, 'id' | 'handle' | 'name'>;
  event: Pick<EventRow, 'id' | 'slug' | 'name'>;
  issuer?: Pick<UserRow, 'id' | 'handle'> | null;
  /** Default 'stamp'. */
  type?: CredentialType;
  /** Stamps only (default 'hacker'). */
  role?: StampRole;
  /** Awards only (default 'first'). */
  placement?: AwardPlacement;
  track?: string | null;
  projectName?: string | null;
  projectUrl?: string | null;
  issuedAt?: Date;
  revokedAt?: Date | null;
}

/**
 * Insert a signed stamp or award directly (canonical payload signed with `signer`), e.g. back-dated test data.
 * Routes issue credentials through the credentials service instead.
 */
export async function createCredential(ex: Executor, signer: Signer, input: TestCredentialInput): Promise<CredentialRow> {
  const type = input.type ?? 'stamp';
  const role = type === 'stamp' ? (input.role ?? 'hacker') : null;
  const placement = type === 'award' ? (input.placement ?? 'first') : null;
  const track = input.track ?? null;
  const projectName = input.projectName ?? null;
  const projectUrl = input.projectUrl ?? null;
  const id = randomUUID();
  const issuedAt = input.issuedAt ?? new Date();
  const signed: SignedCredentialPayload = {
    v: 1,
    id,
    type,
    holder: { id: input.holder.id, handle: input.holder.handle, name: input.holder.name },
    event: { id: input.event.id, slug: input.event.slug, name: input.event.name },
    role,
    placement,
    track,
    project: projectName === null && projectUrl === null ? null : { name: projectName, url: projectUrl },
    issuer: input.issuer ? { id: input.issuer.id, handle: input.issuer.handle } : null,
    issuedAt: issuedAt.toISOString(),
  };
  const payload = canonicalJson(signed);
  const [credential] = await ex
    .insert(credentials)
    .values({
      id,
      type,
      userId: input.holder.id,
      eventId: input.event.id,
      issuedBy: input.issuer?.id ?? null,
      role,
      placement,
      track,
      projectName,
      projectUrl,
      payload,
      signature: signer.sign(payload),
      keyId: signer.keyId,
      issuedAt,
      revokedAt: input.revokedAt ?? null,
    })
    .returning();
  if (!credential) throw new Error('createCredential: insert returned no row');
  return credential;
}

/** Insert a vouch directly (skill defaults to a unique name). */
export async function createVouch(
  ex: Executor,
  input: {
    voucher: Pick<UserRow, 'id'>;
    recipient: Pick<UserRow, 'id'>;
    skill?: string;
    message?: string;
    eventId?: string | null;
    createdAt?: Date;
  },
): Promise<VouchRow> {
  const [vouch] = await ex
    .insert(vouches)
    .values({
      voucherId: input.voucher.id,
      recipientId: input.recipient.id,
      skill: input.skill ?? `Skill ${uniqueSuffix()}`,
      message: input.message ?? 'Great to work with.',
      eventId: input.eventId ?? null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    })
    .returning();
  if (!vouch) throw new Error('createVouch: insert returned no row');
  return vouch;
}

/**
 * The XP inputs of a user computed independently of the stats service (plain queries + the shared
 * isProfileComplete), for asserting `computeProfileStats(...).xp === computeXp(await xpCountsFor(ex, id))`.
 */
export async function xpCountsFor(ex: Executor, userId: string): Promise<XpCounts> {
  const [user] = await ex.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error('xpCountsFor: user not found');
  const outgoing = await ex.select({ peerId: connections.peerId }).from(connections).where(eq(connections.ownerId, userId));
  const incoming = await ex.select({ ownerId: connections.ownerId }).from(connections).where(eq(connections.peerId, userId));
  const live = await ex
    .select({ type: credentials.type, placement: credentials.placement })
    .from(credentials)
    .where(and(eq(credentials.userId, userId), isNull(credentials.revokedAt)));
  const received = await ex.select({ voucherId: vouches.voucherId }).from(vouches).where(eq(vouches.recipientId, userId));

  const connectedBack = new Set(incoming.map((row) => row.ownerId));
  const awards: Partial<Record<AwardPlacement, number>> = {};
  for (const credential of live) {
    if (credential.type === 'award' && credential.placement) awards[credential.placement] = (awards[credential.placement] ?? 0) + 1;
  }
  return {
    connections: outgoing.filter((row) => connectedBack.has(row.peerId)).length,
    stamps: live.filter((credential) => credential.type === 'stamp').length,
    vouchesReceived: new Set(received.map((row) => row.voucherId)).size,
    awards,
    profileComplete: isProfileComplete(user),
  };
}
