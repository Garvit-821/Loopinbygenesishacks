import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Signed-in account (SPEC §3.5 "Me"): /me, /me/profile, /me/badge-key, /me/badge-key/rotate, /me/export.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/me'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createMeRouter(_ctx: AppContext): Router {
  return Router();
}
