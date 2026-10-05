import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Public profiles (SPEC §3.5 "Profiles"): /profiles/:handle.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/profiles/:handle'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createProfilesRouter(_ctx: AppContext): Router {
  return Router();
}
