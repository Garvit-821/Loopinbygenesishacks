/**
 * Authentication & authorization.
 *  - authenticate(ctx): global on /api, optional. A valid bearer session sets req.user / req.session /
 *    req.sessionId; anything else (no header, malformed, unknown, expired) continues anonymously, so public
 *    routes keep working and protected ones answer 401 via requireAuth.
 *  - requireAuth / requireRole(role): per-route guards (admin includes organizer).
 */
import { eq } from 'drizzle-orm';
import type { Request, RequestHandler } from 'express';
import type { UserRole } from '@loopin/shared';
import type { AppContext } from '../context';
import { sessions, users, type UserRow } from '../db/schema';
import { forbidden, unauthorized } from '../lib/errors';
import { MINUTE_MS } from '../lib/time';
import { sha256Hex } from '../lib/tokens';
import { sessionRefresh } from '../services/sessions';

const BEARER = /^Bearer\s+(lp_[A-Za-z0-9_-]{43})$/i;

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  return typeof header === 'string' ? (BEARER.exec(header.trim())?.[1] ?? null) : null;
}

export function authenticate(ctx: AppContext): RequestHandler {
  return async (req, _res, next) => {
    const token = bearerToken(req);
    if (!token) return next();
    const [found] = await ctx.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(eq(sessions.tokenHash, sha256Hex(token)))
      .limit(1);
    const now = Date.now();
    if (!found || found.session.expiresAt.getTime() <= now) return next();

    const { session, user } = found;
    const refresh = sessionRefresh(session, now, ctx.env.SESSION_TTL_DAYS);
    if (refresh) {
      await ctx.db.update(sessions).set(refresh).where(eq(sessions.id, session.id));
      Object.assign(session, refresh);
    }
    req.user = user;
    req.session = session;
    req.sessionId = session.id;
    next();
  };
}

/** 401 unauthorized unless a valid session was presented. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  next(req.user ? undefined : unauthorized());
};

const ROLE_RANK: Record<UserRole, number> = { member: 0, organizer: 1, admin: 2 };

/** Admins can do everything organizers can. */
export function hasRole(user: Pick<UserRow, 'role'>, role: 'organizer' | 'admin'): boolean {
  return ROLE_RANK[user.role] >= ROLE_RANK[role];
}

/** 401 when signed out, 403 forbidden when signed in without the role. Includes requireAuth. */
export function requireRole(role: 'organizer' | 'admin'): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!hasRole(req.user, role)) return next(forbidden(role === 'admin' ? 'Only admins can do that.' : 'Only organizers can do that.'));
    next();
  };
}

/** The signed-in user (use after requireAuth/requireRole; throws 401 if absent). */
export function currentUser(req: Request): UserRow {
  if (!req.user) throw unauthorized();
  return req.user;
}

/** True when the current session was created less than `maxAgeMs` ago (re-authentication for sensitive actions). */
export function isFreshSession(req: Request, maxAgeMs: number = 10 * MINUTE_MS, nowMs: number = Date.now()): boolean {
  return req.session !== undefined && nowMs - req.session.createdAt.getTime() < maxAgeMs;
}
