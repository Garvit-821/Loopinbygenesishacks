import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { MIGRATIONS_DIR } from '../paths';
import type { DbHandle } from './client';
import * as schema from './schema';

/** Arbitrary constant key for pg_advisory_lock so concurrently starting instances migrate one at a time. */
const MIGRATION_LOCK_KEY = 726_150_401;

/** Apply pending SQL migrations from server/drizzle (idempotent). */
export async function runMigrations(handle: DbHandle, migrationsFolder: string = MIGRATIONS_DIR): Promise<void> {
  if (handle.driver === 'pglite') {
    await migratePglite(handle.db, { migrationsFolder });
    return;
  }
  // Session-level advisory lock on one dedicated connection; the migrator runs on that same connection.
  const client = await handle.pool.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    try {
      await migrateNodePg(drizzleNodePg(client, { schema }), { migrationsFolder });
    } finally {
      await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}
