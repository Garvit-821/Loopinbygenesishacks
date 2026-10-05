import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Notification inbox (SPEC §3.5 "Notifications"): /notifications, /notifications/read.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/notifications'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createNotificationsRouter(_ctx: AppContext): Router {
  return Router();
}
