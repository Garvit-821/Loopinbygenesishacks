import { Router } from 'express';
import type { AppContext } from '../context';

/**
 * Auth (SPEC §3.5 "Auth"): /auth/providers, /auth/handle-available, /auth/signup, /auth/login, /auth/logout,
 * /auth/logout-all, /auth/me, /auth/password, /auth/forgot, /auth/reset, /auth/github, /auth/github/callback,
 * /auth/github/exchange.
 *
 * Mounted at /api like every router, so routes declare their full path under /api
 * (e.g. `'/auth/providers'`) and attach guards/limiters per route — never via an unscoped
 * `router.use()`, which would run for every /api request that reaches this router.
 */
export function createAuthRouter(_ctx: AppContext): Router {
  return Router();
}
