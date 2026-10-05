import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Stamps, awards and verification (SPEC §3.5 "Credentials"): /events/:id/check-in, /events/:id/awards,
 * /events/:id/credentials, /credentials/:id, /keys.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/events/:id/check-in'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createCredentialsRouter(_ctx: AppContext): Router {
  return Router();
}
