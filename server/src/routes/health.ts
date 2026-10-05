import { sql } from 'drizzle-orm';
import { Router } from 'express';
import type { HealthResponse } from '@loopin/shared';
import type { AppContext } from '../context';
import { SERVER_VERSION } from '../paths';

/** A database that needs longer than this to answer `select 1` counts as degraded. */
const DB_TIMEOUT_MS = 2000;

async function checkDatabase(ctx: AppContext): Promise<HealthResponse['db']> {
  let timer: NodeJS.Timeout | undefined;
  const timedOut = new Promise<'error'>((resolve) => {
    timer = setTimeout(() => resolve('error'), DB_TIMEOUT_MS);
  });
  const query = ctx.db.execute(sql`select 1`).then(
    () => 'ok' as const,
    () => 'error' as const,
  );
  try {
    return await Promise.race([query, timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/health — mounted before the body parser, auth and rate limits (load balancers poll it). */
export function createHealthRouter(ctx: AppContext): Router {
  const router = Router();
  router.get('/health', async (_req, res) => {
    const db = await checkDatabase(ctx);
    const status = db === 'ok' ? 'ok' : 'degraded';
    res.status(status === 'ok' ? 200 : 503).json({
      status,
      db,
      version: SERVER_VERSION,
      time: new Date().toISOString(),
    } satisfies HealthResponse);
  });
  return router;
}
