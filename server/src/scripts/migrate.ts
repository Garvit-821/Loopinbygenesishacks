/** `npm run db:migrate` — apply pending migrations to the configured database (DATABASE_URL or PGlite). */
import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { loadDatabaseEnv, loadDotEnvFile } from '../env';
import { createLogger } from '../lib/logger';
import { runScript } from './run';

await runScript(async () => {
  loadDotEnvFile();
  const { env } = loadDatabaseEnv();
  const database = await createDb(env, createLogger(env));
  try {
    await runMigrations(database);
    console.log(`Database schema is up to date (${database.driver === 'pg' ? 'PostgreSQL' : `PGlite at ${env.PGLITE_DIR}`}).`);
  } finally {
    await database.close();
  }
});
