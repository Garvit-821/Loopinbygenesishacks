import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Vouches (SPEC §3.5 "Vouches"): /vouches, /vouches/:id.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/vouches'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createVouchesRouter(_ctx: AppContext): Router {
  return Router();
}
