import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Admin tools (SPEC §3.5 "Admin"): /admin/users, /admin/users/:id/role.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/admin/users'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createAdminRouter(_ctx: AppContext): Router {
  return Router();
}
