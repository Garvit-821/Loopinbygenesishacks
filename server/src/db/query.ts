import type { SQL } from 'drizzle-orm';
import type { Executor } from '../context';

/**
 * Run a raw SQL query through any executor and return its rows typed as `T` (`ex.execute()` is typed
 * `unknown` on Executor; both drivers return `{ rows }`). Cast aggregates in SQL (`count(*)::int`): node-postgres
 * returns bigint/numeric as strings, PGlite as numbers.
 */
export async function queryRows<T extends Record<string, unknown>>(ex: Executor, query: SQL): Promise<T[]> {
  const result = (await ex.execute(query)) as { rows?: T[] };
  return result.rows ?? [];
}
