import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Organizer console data (SPEC §3.5 "Events"): /organizer/events.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/organizer/events'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createOrganizerRouter(_ctx: AppContext): Router {
  return Router();
}
