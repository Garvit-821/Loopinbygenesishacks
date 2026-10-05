/**
 * Rate limits (SPEC §3.6), built once per AppContext (so per app instance) with in-memory stores. Limits come
 * from env (RATE_LIMIT_*); everything is disabled under NODE_ENV=test unless RATE_LIMIT_IN_TESTS is set.
 *
 * Routers apply them per route, e.g.
 *   const limits = getRateLimiters(ctx);
 *   router.post('/auth/login', ...limits.login, handler);
 *   router.post('/connections/exchange', requireAuth, limits.exchange, handler);
 */
import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { LIMITS } from '@loopin/shared';
import type { AppContext } from '../context';
import { rateLimited, sendError } from '../lib/errors';
import { MINUTE_MS } from '../lib/time';

export interface RateLimiters {
  /** Global on /api: per signed-in user (RATE_LIMIT_API_USER/min) or per anonymous IP (RATE_LIMIT_API_IP/min). */
  api: RequestHandler;
  /** POST /auth/login: per IP (RATE_LIMIT_LOGIN_IP/15 min) + failed attempts per IP+email (RATE_LIMIT_LOGIN/15 min). Spread it. */
  login: RequestHandler[];
  /** POST /auth/signup: per IP (RATE_LIMIT_SIGNUP_IP/15 min). */
  signup: RequestHandler;
  /** POST /auth/forgot: per IP+email (RATE_LIMIT_FORGOT/15 min). */
  forgot: RequestHandler;
  /** POST /auth/reset: per IP (RATE_LIMIT_RESET/15 min). */
  reset: RequestHandler;
  /** POST /auth/github/exchange: per IP (RATE_LIMIT_OAUTH_IP/15 min). */
  oauthExchange: RequestHandler;
  /** POST /connections/exchange: per user (RATE_LIMIT_EXCHANGE_USER/min). Place after requireAuth. */
  exchange: RequestHandler;
  /** POST /events/:id/check-in: per user (RATE_LIMIT_CHECKIN_USER/min). Place after requireRole. */
  checkIn: RequestHandler;
  /** GET /badge/preview: per IP (RATE_LIMIT_PREVIEW_IP/min). */
  preview: RequestHandler;
}

const FIFTEEN_MINUTES_MS = 15 * MINUTE_MS;

const passThrough: RequestHandler = (_req, _res, next) => next();

/** IPv4 as-is, IPv6 grouped by /56 (express-rate-limit's helper; one person usually owns a whole prefix). */
function clientIp(req: Request): string {
  return ipKeyGenerator(req.ip ?? '');
}

function userOrIp(req: Request): string {
  return req.user ? `user:${req.user.id}` : `ip:${clientIp(req)}`;
}

function ipAndEmail(req: Request): string {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  const normalized = typeof email === 'string' ? email.trim().toLowerCase().slice(0, LIMITS.emailMax) : '';
  return `${clientIp(req)}|${normalized}`;
}

interface LimiterSpec {
  name: string;
  windowMs: number;
  limit: number | ((req: Request) => number);
  key: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

function buildRateLimiters(ctx: AppContext): RateLimiters {
  const { env, logger } = ctx;
  const enabled = env.NODE_ENV !== 'test' || env.RATE_LIMIT_IN_TESTS;

  const make = (spec: LimiterSpec): RequestHandler => {
    if (!enabled) return passThrough;
    return rateLimit({
      windowMs: spec.windowMs,
      limit: spec.limit,
      keyGenerator: spec.key,
      skipSuccessfulRequests: spec.skipSuccessfulRequests ?? false,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req, res) => sendError(res, rateLimited()),
      validate: {
        // TRUST_PROXY=true is only accepted outside production, deliberately.
        trustProxy: env.TRUST_PROXY !== true,
        // Covered by the startup warning about TRUST_PROXY.
        xForwardedForHeader: false,
      },
      logger: {
        warn: (error, message) => logger.warn({ err: error, limiter: spec.name }, message ?? 'Rate limiter warning'),
        error: (error, message) => logger.error({ err: error, limiter: spec.name }, message ?? 'Rate limiter error'),
      },
    });
  };

  return {
    api: make({
      name: 'api',
      windowMs: MINUTE_MS,
      limit: (req) => (req.user ? env.RATE_LIMIT_API_USER : env.RATE_LIMIT_API_IP),
      key: userOrIp,
    }),
    login: [
      make({ name: 'login-ip', windowMs: FIFTEEN_MINUTES_MS, limit: env.RATE_LIMIT_LOGIN_IP, key: clientIp }),
      make({ name: 'login', windowMs: FIFTEEN_MINUTES_MS, limit: env.RATE_LIMIT_LOGIN, key: ipAndEmail, skipSuccessfulRequests: true }),
    ],
    signup: make({ name: 'signup', windowMs: FIFTEEN_MINUTES_MS, limit: env.RATE_LIMIT_SIGNUP_IP, key: clientIp }),
    forgot: make({ name: 'forgot', windowMs: FIFTEEN_MINUTES_MS, limit: env.RATE_LIMIT_FORGOT, key: ipAndEmail }),
    // The reset body carries a token, not an email, so this is effectively per IP.
    reset: make({ name: 'reset', windowMs: FIFTEEN_MINUTES_MS, limit: env.RATE_LIMIT_RESET, key: ipAndEmail }),
    oauthExchange: make({ name: 'oauth-exchange', windowMs: FIFTEEN_MINUTES_MS, limit: env.RATE_LIMIT_OAUTH_IP, key: clientIp }),
    exchange: make({ name: 'exchange', windowMs: MINUTE_MS, limit: env.RATE_LIMIT_EXCHANGE_USER, key: userOrIp }),
    checkIn: make({ name: 'check-in', windowMs: MINUTE_MS, limit: env.RATE_LIMIT_CHECKIN_USER, key: userOrIp }),
    preview: make({ name: 'preview', windowMs: MINUTE_MS, limit: env.RATE_LIMIT_PREVIEW_IP, key: clientIp }),
  };
}

const limitersByContext = new WeakMap<AppContext, RateLimiters>();

/** The limiter set for this context, created on first use (one app per context ⇒ per app instance). */
export function getRateLimiters(ctx: AppContext): RateLimiters {
  let limiters = limitersByContext.get(ctx);
  if (!limiters) {
    limiters = buildRateLimiters(ctx);
    limitersByContext.set(ctx, limiters);
  }
  return limiters;
}
