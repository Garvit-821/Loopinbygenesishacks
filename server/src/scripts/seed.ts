/**
 * `npm run db:seed` — add the demo data to an empty database. Always allowed in development (even with
 * SEED_DEMO=false, since running it is explicit); elsewhere only with SEED_DEMO=force and DEMO_PASSWORD.
 */
import { createDb } from '../db/client';
import { runMigrations } from '../db/migrate';
import { seedDemo } from '../db/seed';
import { loadDotEnvFile, loadEnv } from '../env';
import { createLogger } from '../lib/logger';
import { createSigner } from '../lib/signing';
import { ScriptError, runScript } from './run';

await runScript(async () => {
  loadDotEnvFile();
  const { env, warnings } = loadEnv();
  const logger = createLogger(env);
  for (const warning of warnings) logger.warn(warning);
  if (env.NODE_ENV !== 'development' && env.SEED_DEMO !== 'force') {
    throw new ScriptError(`Refusing to seed demo data with NODE_ENV=${env.NODE_ENV}. Set SEED_DEMO=force and DEMO_PASSWORD to do it deliberately.`);
  }
  const database = await createDb(env, logger);
  try {
    await runMigrations(database);
    const signer = createSigner(env.SIGNING_KEY, env.SIGNING_PUBLIC_KEYS_PREVIOUS);
    const result = await seedDemo(database.db, { env, signer, logger });
    if (!result.seeded) {
      console.log('Nothing was seeded: demo data is only added to a database without users.');
      return;
    }
    console.log('Seeded demo data. Accounts:');
    for (const account of result.accounts ?? []) console.log(`  ${account.email} (${account.role})`);
    if (env.NODE_ENV === 'development') console.log(`Password for every demo account: ${env.DEMO_PASSWORD}`);
  } finally {
    await database.close();
  }
});
