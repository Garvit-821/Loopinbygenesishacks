import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Live server-sent events (SPEC §3.5 "Stream"): /stream.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/stream'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createStreamRouter(_ctx: AppContext): Router {
  return Router();
}
