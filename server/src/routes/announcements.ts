import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Announcements (SPEC §3.5 "Announcements & feed"): /announcements, /announcements/:id.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/announcements'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createAnnouncementsRouter(_ctx: AppContext): Router {
  return Router();
}
