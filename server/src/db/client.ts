/**
 * Database connection: node-postgres for DATABASE_URL, otherwise embedded PGlite (a directory, or
 * `memory://`). Sessions run in UTC on both drivers.
 */
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleNodePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite';
import pg from 'pg';
import type { Logger, Schema } from '../context';
import { PGLITE_MEMORY, type DatabaseEnv } from '../env';
import * as schema from './schema';

export type DbHandle =
  | { driver: 'pg'; db: NodePgDatabase<Schema>; pool: pg.Pool; close(): Promise<void> }
  | { driver: 'pglite'; db: PgliteDatabase<Schema>; client: PGlite; close(): Promise<void> };

/** Run `close` once; later calls return the same promise. */
function once(close: () => Promise<void>): () => Promise<void> {
  let closing: Promise<void> | undefined;
  return () => (closing ??= close());
}

export async function createDb(env: DatabaseEnv, logger: Logger): Promise<DbHandle> {
  return env.DATABASE_URL ? openPostgres(env.DATABASE_URL, env.DATABASE_SSL, logger) : openPglite(env.PGLITE_DIR);
}

function sslConfig(mode: DatabaseEnv['DATABASE_SSL']): pg.PoolConfig['ssl'] {
  if (mode === 'true') return true;
  if (mode === 'no-verify') return { rejectUnauthorized: false };
  return false;
}

async function openPostgres(url: string, sslMode: DatabaseEnv['DATABASE_SSL'], logger: Logger): Promise<DbHandle> {
  let connectionString = url;
  let ssl: pg.PoolConfig['ssl'];
  if (sslMode !== null) {
    // node-postgres lets parameters in the URL override the config object, so DATABASE_SSL is made
    // authoritative by removing the URL's own TLS switches.
    const parsed = new URL(url);
    parsed.searchParams.delete('sslmode');
    parsed.searchParams.delete('ssl');
    connectionString = parsed.toString();
    ssl = sslConfig(sslMode);
  }
  const pool = new pg.Pool({
    connectionString,
    ...(ssl === undefined ? {} : { ssl }),
    options: '-c TimeZone=UTC',
    application_name: 'loopin',
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // Without a listener an idle client's network error would crash the process.
  pool.on('error', (error) => logger.error({ err: error }, 'Idle PostgreSQL client error'));
  try {
    const client = await pool.connect();
    client.release();
  } catch (error) {
    await pool.end().catch(() => undefined);
    throw error;
  }
  return { driver: 'pg', db: drizzleNodePg(pool, { schema }), pool, close: once(() => pool.end()) };
}

async function openPglite(dir: string): Promise<DbHandle> {
  if (dir === PGLITE_MEMORY) {
    const client = new PGlite(PGLITE_MEMORY);
    await client.waitReady;
    await client.exec("SET TIME ZONE 'UTC'");
    return { driver: 'pglite', db: drizzlePglite(client, { schema }), client, close: once(() => client.close()) };
  }

  mkdirSync(dir, { recursive: true });
  const releaseLock = acquirePgliteLock(`${dir}.lock`, dir);
  let client: PGlite | undefined;
  try {
    client = new PGlite(dir);
    await client.waitReady;
    await client.exec("SET TIME ZONE 'UTC'");
  } catch (error) {
    await client?.close().catch(() => undefined);
    releaseLock();
    throw error;
  }
  const opened = client;
  const close = once(async () => {
    try {
      await opened.close();
    } finally {
      releaseLock();
    }
  });
  return { driver: 'pglite', db: drizzlePglite(opened, { schema }), client: opened, close };
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to someone else.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

interface LockOwner {
  pid: number;
  host: string;
}

function readLockOwner(lockFile: string): LockOwner | null {
  try {
    const parsed = JSON.parse(readFileSync(lockFile, 'utf8')) as Partial<LockOwner>;
    return Number.isInteger(parsed.pid) && typeof parsed.host === 'string' ? { pid: parsed.pid as number, host: parsed.host } : null;
  } catch {
    return null;
  }
}

/**
 * PGlite is single-process: two servers on one data directory corrupt it. A lock file next to the directory
 * records the owner's pid and hostname. A live owner on this host makes us refuse; anything else is a stale
 * lock from a crash and is replaced (the hostname check matters in containers, where pids restart at 1 and a
 * crashed instance's pid may belong to an unrelated process in the new one). Returns the release function.
 */
function acquirePgliteLock(lockFile: string, dir: string): () => void {
  const me: LockOwner = { pid: process.pid, host: hostname() };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      writeFileSync(lockFile, JSON.stringify(me), { flag: 'wx' });
      return () => {
        const owner = readLockOwner(lockFile);
        if (owner?.pid === me.pid && owner.host === me.host) {
          try {
            unlinkSync(lockFile);
          } catch {
            // Already gone.
          }
        }
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') {
        throw new Error(
          `Could not create the lock file ${lockFile} (${code}). It is created next to PGLITE_DIR, so point PGLITE_DIR at ` +
            `a directory inside a writable volume (e.g. /data/pglite rather than the mount point /data).`,
        );
      }
      if (code !== 'EEXIST') throw error;
      const owner = readLockOwner(lockFile);
      if (owner && owner.host === me.host && owner.pid !== me.pid && isProcessAlive(owner.pid)) {
        throw new Error(
          `The embedded database at ${dir} is in use by another process (pid ${owner.pid}). Stop that server first, ` +
            `or point PGLITE_DIR somewhere else. If no such server is running, delete ${path.basename(lockFile)} next to it.`,
        );
      }
      try {
        unlinkSync(lockFile);
      } catch {
        // Someone else removed it; retry the exclusive create.
      }
    }
  }
  throw new Error(`Could not lock the embedded database at ${dir}`);
}
