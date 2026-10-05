import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Connections (SPEC §3.5 "Badge & connections"): /connections/exchange, /connections, /connections/:id.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/connections/exchange'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createConnectionsRouter(_ctx: AppContext): Router {
  return Router();
}
