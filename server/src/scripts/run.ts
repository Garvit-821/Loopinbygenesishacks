import { EnvError } from '../env';
import { pgError } from '../lib/db-errors';
import { serializeError } from '../lib/logger';

/** A failure whose message is meant for the person running the script (usage errors, "not found", …). */
export class ScriptError extends Error {
  override name = 'ScriptError';
}

function describe(error: unknown): string {
  if (error instanceof EnvError || error instanceof ScriptError) return error.message;
  if (pgError(error)?.code === '42P01') return 'The database has no Loopin tables yet. Run `npm run db:migrate` (or start the server once) first.';
  return `Failed: ${JSON.stringify(serializeError(error), null, 2)}`;
}

/** Run a CLI script: exit 0 on success, print a readable reason and exit 1 on failure. */
export async function runScript(main: () => Promise<void>): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error(describe(error));
    process.exit(1);
  }
  process.exit(0);
}
