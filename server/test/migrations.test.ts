import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Executor } from '../src/context';
import { createDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { queryRows } from '../src/db/query';
import { connections, credentials, sessions, users, vouches } from '../src/db/schema';
import { loadDatabaseEnv } from '../src/env';
import { createLogger } from '../src/lib/logger';
import { MIGRATIONS_DIR } from '../src/paths';
import { createEvent, createTestContext, createUser, type TestContext } from './helpers';

let t: TestContext;
let ex: Executor;
beforeAll(async () => {
  t = await createTestContext();
  ex = t.db;
});
afterAll(() => t.close());

const NAMED_INDEXES = [
  'connections_peer_id_idx',
  'vouches_pair_skill_uq',
  'vouches_recipient_id_idx',
  'credentials_live_stamp_uq',
  'credentials_live_award_uq',
  'credentials_user_id_idx',
  'credentials_event_id_idx',
  'announcements_created_at_idx',
  'announcements_event_id_created_at_idx',
  'notifications_user_id_created_at_idx',
  'one_time_tokens_user_purpose_created_idx',
  'sessions_user_id_idx',
];

const NAMED_CONSTRAINTS = [
  'users_email_unique',
  'users_handle_unique',
  'users_github_id_unique',
  'users_badge_id_unique',
  'users_email_lowercase_check',
  'users_handle_format_check',
  'users_role_check',
  'users_visibility_check',
  'sessions_token_hash_unique',
  'one_time_tokens_token_hash_unique',
  'one_time_tokens_purpose_check',
  'events_slug_unique',
  'events_kind_check',
  'events_ends_after_starts_check',
  'rsvps_pk',
  'connections_owner_peer_uq',
  'connections_source_check',
  'connections_not_self_check',
  'credentials_type_check',
  'credentials_event_id_events_id_fk',
  'announcements_kind_check',
  'notifications_kind_check',
];

async function pgCodeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (error) {
    return (error as { cause?: { code?: string } }).cause?.code;
  }
  return undefined;
}

describe('migrations', () => {
  it('apply cleanly, record every migration and are idempotent', async () => {
    await runMigrations(t.database);
    const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8')) as { entries: unknown[] };
    const sqlFiles = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql'));
    expect(journal.entries).toHaveLength(sqlFiles.length);
    const [{ count }] = await queryRows<{ count: number }>(ex, sql`select count(*)::int as count from drizzle.__drizzle_migrations`);
    expect(count).toBe(sqlFiles.length);
  });

  it('create every named index and constraint', async () => {
    const indexes = await queryRows<{ indexname: string; indexdef: string }>(ex, sql`select indexname, indexdef from pg_indexes where schemaname = 'public'`);
    const names = new Set(indexes.map((row) => row.indexname));
    for (const name of NAMED_INDEXES) expect(names, name).toContain(name);

    const definition = (name: string) => indexes.find((row) => row.indexname === name)?.indexdef ?? '';
    expect(definition('vouches_pair_skill_uq')).toMatch(/lower\(skill\)/);
    expect(definition('credentials_live_stamp_uq')).toMatch(/WHERE \(\(type = 'stamp'::text\) AND \(revoked_at IS NULL\)\)/);
    expect(definition('credentials_live_award_uq')).toMatch(/COALESCE\(track, ''::text\)/);
    expect(definition('credentials_live_award_uq')).toMatch(/WHERE \(\(type = 'award'::text\) AND \(revoked_at IS NULL\)\)/);

    const constraints = await queryRows<{ conname: string }>(ex, sql`select conname from pg_constraint where connamespace = 'public'::regnamespace`);
    const constraintNames = new Set(constraints.map((row) => row.conname));
    for (const name of NAMED_CONSTRAINTS) expect(constraintNames, name).toContain(name);

    const [restrict] = await queryRows<{ confdeltype: string }>(ex, sql`select confdeltype from pg_constraint where conname = 'credentials_event_id_events_id_fk'`);
    expect(restrict?.confdeltype).toBe('r');
  });

  it('runs sessions in UTC', async () => {
    const [row] = await queryRows<{ TimeZone: string }>(ex, sql`show timezone`);
    expect(row?.TimeZone).toBe('UTC');
  });
});

describe('schema rules', () => {
  it('enforces lowercase emails, handle format and role values', async () => {
    expect(await pgCodeOf(createUser(ex, { email: 'Upper@Example.com' }))).toBe('23514');
    expect(await pgCodeOf(createUser(ex, { handle: 'Bad Handle' }))).toBe('23514');
    expect(await pgCodeOf(ex.execute(sql`insert into users (email, handle, name, role) values ('role@example.com', 'role_check', 'R', 'owner')`))).toBe('23514');
    expect(await pgCodeOf(ex.execute(sql`insert into users (email, handle, name, visibility) values ('vis@example.com', 'vis_check', 'V', 'secret')`))).toBe('23514');
  });

  it('fills profile defaults', async () => {
    const user = await createUser(ex);
    expect(user).toMatchObject({ headline: '', bio: '', location: '', skills: [], openTo: [], role: 'member', visibility: 'public' });
    expect(user.badgeId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('keeps one vouch per pair and skill, case-insensitively', async () => {
    const [a, b] = [await createUser(ex), await createUser(ex)];
    await ex.insert(vouches).values({ voucherId: a.id, recipientId: b.id, skill: 'Rust', message: 'Great' });
    expect(await pgCodeOf(ex.insert(vouches).values({ voucherId: a.id, recipientId: b.id, skill: 'rust', message: 'Again' }))).toBe('23505');
    await ex.insert(vouches).values({ voucherId: b.id, recipientId: a.id, skill: 'Rust', message: 'Back' });
  });

  it('keeps one live stamp per user, event and role, and one live award per placement and track', async () => {
    const user = await createUser(ex);
    const event = await createEvent(ex);
    const credential = (values: Partial<typeof credentials.$inferInsert>) => ({
      type: 'stamp' as const,
      userId: user.id,
      eventId: event.id,
      payload: '{}',
      signature: 's',
      keyId: 'k',
      issuedAt: new Date(),
      ...values,
    });
    const [stamp] = await ex.insert(credentials).values(credential({ role: 'hacker' })).returning();
    expect(await pgCodeOf(ex.insert(credentials).values(credential({ role: 'hacker' })))).toBe('23505');
    await ex.insert(credentials).values(credential({ role: 'mentor' }));
    await ex.update(credentials).set({ revokedAt: new Date() }).where(eq(credentials.id, stamp!.id));
    await ex.insert(credentials).values(credential({ role: 'hacker' }));

    await ex.insert(credentials).values(credential({ type: 'award', placement: 'first', track: null }));
    expect(await pgCodeOf(ex.insert(credentials).values(credential({ type: 'award', placement: 'first', track: '' })))).toBe('23505');
    await ex.insert(credentials).values(credential({ type: 'award', placement: 'first', track: 'AI' }));
    await ex.insert(credentials).values(credential({ type: 'award', placement: 'second', track: null }));
  });

  it('rejects self-connections and duplicate directions, and cascades user deletion', async () => {
    const [a, b] = [await createUser(ex), await createUser(ex)];
    expect(await pgCodeOf(ex.insert(connections).values({ ownerId: a.id, peerId: a.id, source: 'scan' }))).toBe('23514');
    await ex.insert(connections).values({ ownerId: a.id, peerId: b.id, source: 'scan' });
    expect(await pgCodeOf(ex.insert(connections).values({ ownerId: a.id, peerId: b.id, source: 'scan' }))).toBe('23505');
    await ex.insert(sessions).values({ userId: a.id, tokenHash: `hash-${a.id}`, expiresAt: new Date(Date.now() + 60_000) });
    await ex.delete(users).where(eq(users.id, a.id));
    expect(await ex.select().from(connections).where(eq(connections.peerId, b.id))).toHaveLength(0);
    expect(await ex.select().from(sessions).where(eq(sessions.userId, a.id))).toHaveLength(0);
  });

  it('requires events to end after they start', async () => {
    const start = new Date();
    expect(await pgCodeOf(createEvent(ex, { startsAt: start, endsAt: start }))).toBe('23514');
  });
});

describe('PGlite data directory lock', () => {
  const dirs: string[] = [];
  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  function setup() {
    const root = mkdtempSync(path.join(tmpdir(), 'loopin-pglite-'));
    dirs.push(root);
    const dir = path.join(root, 'pglite');
    const { env } = loadDatabaseEnv({ NODE_ENV: 'test', PGLITE_DIR: dir });
    return { dir, lockFile: `${dir}.lock`, env, logger: createLogger(env) };
  }

  it('holds a lock while open, refuses a live owner on this host and replaces stale locks', async () => {
    const { dir, lockFile, env, logger } = setup();
    const first = await createDb(env, logger);
    await runMigrations(first);
    expect(JSON.parse(readFileSync(lockFile, 'utf8'))).toEqual({ pid: process.pid, host: hostname() });
    await first.close();
    expect(existsSync(lockFile)).toBe(false);

    writeFileSync(lockFile, JSON.stringify({ pid: process.ppid, host: hostname() }));
    await expect(createDb(env, logger)).rejects.toThrow(/in use by another process/);

    const exited = spawnSync(process.execPath, ['-e', 'process.exit(0)']);
    writeFileSync(lockFile, JSON.stringify({ pid: exited.pid, host: hostname() }));
    const second = await createDb(env, logger);
    expect((await queryRows<{ n: number }>(second.db, sql`select count(*)::int as n from users`))[0]?.n).toBe(0);
    await second.close();

    writeFileSync(lockFile, JSON.stringify({ pid: process.ppid, host: 'another-container' }));
    const third = await createDb(env, logger);
    await third.close();
    expect(existsSync(dir)).toBe(true);
  });

  // Root ignores directory permissions (common in CI containers), so the scenario can't be built there.
  it.skipIf(process.getuid?.() === 0)('explains how to fix PGLITE_DIR when the lock file cannot be created next to it', async () => {
    const { dir, logger } = setup();
    mkdirSync(dir);
    const parent = path.dirname(dir);
    chmodSync(parent, 0o555);
    try {
      const { env } = loadDatabaseEnv({ NODE_ENV: 'test', PGLITE_DIR: dir });
      await expect(createDb(env, logger)).rejects.toThrow(/Could not create the lock file .*inside a writable volume/);
    } finally {
      chmodSync(parent, 0o755);
    }
  });

  it('keeps the lock file next to the data directory when PGLITE_DIR ends with a slash', async () => {
    const { dir, lockFile, logger } = setup();
    const { env } = loadDatabaseEnv({ NODE_ENV: 'test', PGLITE_DIR: `${dir}${path.sep}` });
    const db = await createDb(env, logger);
    expect(existsSync(lockFile)).toBe(true);
    expect(existsSync(path.join(dir, '.lock'))).toBe(false);
    await db.close();
    expect(existsSync(lockFile)).toBe(false);
  });
});
