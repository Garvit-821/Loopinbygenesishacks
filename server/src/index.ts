/**
 * Server entry point: configuration → database (migrations, optional demo seed) → HTTP server, plus the
 * retention job and an idempotent graceful shutdown.
 */
import { createServer, type Server } from 'node:http';
import { createApp } from './app';
import type { AppContext, Logger } from './context';
import { createDb, type DbHandle } from './db/client';
import { runMigrations } from './db/migrate';
import { seedDemo, type SeedResult } from './db/seed';
import { EnvError, loadDotEnvFile, loadEnv, seedAllowed, type Env } from './env';
import { createBus } from './lib/bus';
import { createLogger } from './lib/logger';
import { createMailer } from './lib/mailer';
import { createSigner } from './lib/signing';
import { HOUR_MS } from './lib/time';
import { purgeExpiredAuthRecords } from './services/sessions';

const PURGE_INTERVAL_MS = 6 * HOUR_MS;
/** Connections still open this long after shutdown starts are cut. */
const FORCE_CLOSE_AFTER_MS = 8_000;

function logSeed(env: Env, logger: Logger, result: SeedResult): void {
  if (!result.seeded) return;
  if (env.NODE_ENV === 'development') {
    logger.info({ accounts: result.accounts ?? [], password: env.DEMO_PASSWORD }, 'Seeded demo data — sign in with any of these accounts');
  } else {
    logger.info({ accounts: result.accounts?.length ?? 0 }, 'Seeded demo data');
  }
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

interface Running {
  db: DbHandle;
  ctx: AppContext;
  server: Server;
}

/** Migrated (and possibly seeded) database plus a listening HTTP server. A failure closes the database again. */
async function boot(env: Env, logger: Logger): Promise<Running> {
  let db: DbHandle | undefined;
  try {
    db = await createDb(env, logger);
    await runMigrations(db);
    const signer = createSigner(env.SIGNING_KEY, env.SIGNING_PUBLIC_KEYS_PREVIOUS);
    const bus = createBus({ maxStreams: env.STREAM_MAX, onError: (error) => logger.warn({ err: error }, 'Dropped a live stream') });
    const mailer = createMailer(env, logger);
    const ctx: AppContext = { env, db: db.db, logger, signer, bus, mailer };
    if (seedAllowed(env)) logSeed(env, logger, await seedDemo(ctx.db, { env, signer, logger }));
    const server = createServer(createApp(ctx));
    await listen(server, env.PORT);
    return { db, ctx, server };
  } catch (error) {
    await db?.close().catch(() => undefined);
    throw error;
  }
}

async function start(env: Env, logger: Logger): Promise<void> {
  const { db, ctx, server } = await boot(env, logger);
  const { bus, mailer } = ctx;
  const address = server.address();
  logger.info(
    { port: typeof address === 'object' && address ? address.port : env.PORT, env: env.NODE_ENV, database: db.driver, mail: mailer.kind },
    'Loopin API listening',
  );

  const purge = async (): Promise<void> => {
    try {
      const removed = await purgeExpiredAuthRecords(ctx.db);
      if (removed.sessions > 0 || removed.oneTimeTokens > 0) logger.info(removed, 'Purged expired sessions and one-time tokens');
    } catch (error) {
      logger.error({ err: error }, 'Purging expired sessions failed');
    }
  };
  void purge();
  const purgeTimer = setInterval(() => void purge(), PURGE_INTERVAL_MS);
  purgeTimer.unref();

  let shutdown: Promise<void> | undefined;
  const stop = (signal: string): Promise<void> =>
    (shutdown ??= (async () => {
      logger.info({ signal }, 'Shutting down');
      clearInterval(purgeTimer);
      const closed = new Promise<void>((resolve) => server.close(() => resolve()));
      bus.closeAll();
      server.closeIdleConnections();
      const force = setTimeout(() => server.closeAllConnections(), FORCE_CLOSE_AFTER_MS);
      force.unref();
      await closed;
      clearTimeout(force);
      mailer.close();
      await db.close();
      logger.info('Shutdown complete');
    })());

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      stop(signal).then(
        () => process.exit(0),
        (error: unknown) => {
          logger.error({ err: error }, 'Shutdown failed');
          process.exit(1);
        },
      );
    });
  }
  process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled promise rejection'));
  process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception — exiting');
    process.exit(1);
  });
}

function main(): void {
  let env: Env;
  let warnings: string[];
  try {
    loadDotEnvFile();
    ({ env, warnings } = loadEnv());
  } catch (error) {
    console.error(error instanceof EnvError ? error.message : `Could not load configuration: ${(error as Error).message}`);
    process.exit(1);
  }
  const logger = createLogger(env);
  for (const warning of warnings) logger.warn(warning);
  start(env, logger).catch((error: unknown) => {
    logger.fatal({ err: error }, 'Loopin failed to start');
    process.exit(1);
  });
}

main();
