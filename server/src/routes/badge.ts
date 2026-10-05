import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Badge previews (SPEC §3.5 "Badge & connections"): /badge/preview.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/badge/preview'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createBadgeRouter(_ctx: AppContext): Router {
  return Router();
}
