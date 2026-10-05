import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from 'drizzle-orm/pg-core';
import type { Logger as PinoLogger } from 'pino';
import type * as schema from './db/schema';
import type { Env } from './env';
import type { Bus } from './lib/bus';
import type { Mailer } from './lib/mailer';
import type { Signer } from './lib/signing';

export type Schema = typeof schema;

/**
 * The application database (node-postgres pool or embedded PGlite) with the driver erased. Both concrete drivers
 * (see DbHandle in db/client.ts) are assignable to it. Their union is deliberately not used here: it breaks
 * overloaded builder calls such as `.returning({ id })`, on the database and on the `tx` from `transaction()`.
 * With this type, `ctx.db.transaction(async (tx) => …)` hands out a `Tx`.
 */
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

/** A transaction handle, as passed to `db.transaction(async (tx) => …)`. */
export type Tx = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

/**
 * What every DB-touching service takes as its first parameter: `ctx.db` or a `tx`.
 * Inside a transaction use only `tx` — PGlite has one connection, so a query on `ctx.db` there deadlocks.
 */
export type Executor = Db | Tx;

export type Logger = PinoLogger;

export interface AppContext {
  env: Env;
  db: Db;
  logger: Logger;
  signer: Signer;
  bus: Bus;
  mailer: Mailer;
}
