import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Events (SPEC §3.5 "Events"): /events, /events/:idOrSlug, /events/:id/rsvp, /events/:id/stats,
 * /events/:id/attendees, /events/:id/announcements.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/events'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createEventsRouter(_ctx: AppContext): Router {
  return Router();
}
