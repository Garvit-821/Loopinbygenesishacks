/**
 * The Express application (no listen — index.ts and the tests do that). Mount order is part of the contract
 * (SPEC §3.6): request log → security headers → CORS → health → JSON body → no-store → authenticate →
 * global limiter → feature routers → /api 404 → web app + SPA fallback → error handler.
 *
 * Router scheme: every feature router is mounted at /api and declares its own full paths, so a feature owns
 * whatever paths it needs (credentials.ts serves /events/:id/check-in as well as /credentials/:id) without
 * touching this file. Routers attach auth guards and limiters per route (or via `router.use('/prefix', …)`
 * for a prefix only they serve, e.g. /admin) — never with an unscoped `router.use()`, and never on a shared
 * prefix: /events/* is served by events.ts, credentials.ts and announcements.ts, so a `router.use('/events', …)`
 * in one of them would also run for the others' routes.
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import cors, { type CorsOptions } from 'cors';
import express, { type Express, type RequestHandler, type Router } from 'express';
import helmet from 'helmet';
import type { AppContext } from './context';
import type { Env } from './env';
import { createHttpLogger } from './lib/logger';
import { authenticate } from './middleware/auth';
import { apiNotFound, createErrorHandler } from './middleware/error';
import { noStore } from './middleware/noStore';
import { getRateLimiters } from './middleware/rateLimit';
import { createAdminRouter } from './routes/admin';
import { createAnnouncementsRouter } from './routes/announcements';
import { createAuthRouter } from './routes/auth';
import { createBadgeRouter } from './routes/badge';
import { createConnectionsRouter } from './routes/connections';
import { createCredentialsRouter } from './routes/credentials';
import { createEventsRouter } from './routes/events';
import { createFeedRouter } from './routes/feed';
import { createHealthRouter } from './routes/health';
import { createMeRouter } from './routes/me';
import { createNotificationsRouter } from './routes/notifications';
import { createOrganizerRouter } from './routes/organizer';
import { createProfilesRouter } from './routes/profiles';
import { createStreamRouter } from './routes/stream';
import { createVouchesRouter } from './routes/vouches';

const JSON_BODY_LIMIT = '100kb';
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';

/** Feature routers, each mounted at /api in this order. */
const API_ROUTERS: readonly ((ctx: AppContext) => Router)[] = [
  createAuthRouter,
  createMeRouter,
  createProfilesRouter,
  createBadgeRouter,
  createConnectionsRouter,
  createVouchesRouter,
  createNotificationsRouter,
  createStreamRouter,
  createEventsRouter,
  createOrganizerRouter,
  createCredentialsRouter,
  createAnnouncementsRouter,
  createFeedRouter,
  createAdminRouter,
];

function isApiPath(urlPath: string): boolean {
  return urlPath === '/api' || urlPath.startsWith('/api/');
}

/** CSP for the served web app (SPEC §3.6); the API keeps helmet's defaults. */
function webCspDirectives(env: Env): Record<string, string[]> {
  const directives: Record<string, string[]> = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    fontSrc: ["'self'", 'data:'],
    connectSrc: [...new Set(["'self'", new URL(env.API_URL).origin])],
    workerSrc: ["'self'", 'blob:'],
    mediaSrc: ["'self'", 'blob:'],
    manifestSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
  };
  if (env.NODE_ENV === 'production' && env.APP_URL.startsWith('https://')) directives.upgradeInsecureRequests = [];
  return directives;
}

function securityHeaders(env: Env): RequestHandler {
  // HSTS only in production: a development server reached through https://localhost (a local TLS proxy) would
  // otherwise make the browser insist on HTTPS for localhost and its subdomains for a year.
  const strictTransportSecurity = env.NODE_ENV === 'production';
  const api = helmet({ xFrameOptions: { action: 'deny' }, strictTransportSecurity });
  const web = helmet({
    contentSecurityPolicy: { useDefaults: false, directives: webCspDirectives(env) },
    xFrameOptions: { action: 'deny' },
    strictTransportSecurity,
  });
  return (req, res, next) => (isApiPath(req.path) ? api : web)(req, res, next);
}

function corsOptions(env: Env): CorsOptions {
  const allowed = new Set(env.ALLOWED_ORIGINS);
  return {
    origin: (origin, callback) => callback(null, origin !== undefined && allowed.has(origin)),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    exposedHeaders: ['Content-Disposition', 'Retry-After', 'RateLimit', 'RateLimit-Policy', 'X-Request-Id'],
    maxAge: 600,
    credentials: false,
  };
}

/**
 * Serve the web build when it exists: hashed /assets/* cached forever, everything else revalidated. Unknown
 * paths fall back to index.html only for GET/HEAD navigations (Accept: text/html, no file extension).
 */
function mountWebApp(app: Express, env: Env): void {
  if (!env.SERVE_WEB) return;
  const indexFile = path.join(env.WEB_DIST_DIR, 'index.html');
  if (!existsSync(indexFile)) return;
  const assetsDir = path.join(env.WEB_DIST_DIR, 'assets') + path.sep;

  app.use(
    express.static(env.WEB_DIST_DIR, {
      index: false,
      setHeaders: (res, filePath) => res.setHeader('Cache-Control', filePath.startsWith(assetsDir) ? IMMUTABLE_CACHE : 'no-cache'),
    }),
  );
  app.use((req, res, next) => {
    const isNavigation =
      (req.method === 'GET' || req.method === 'HEAD') &&
      !isApiPath(req.path) &&
      path.extname(req.path) === '' &&
      (req.headers.accept?.includes('text/html') ?? false);
    if (!isNavigation) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexFile, { cacheControl: false });
  });
}

export function createApp(ctx: AppContext): Express {
  const { env } = ctx;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(createHttpLogger(ctx.logger));
  app.use(securityHeaders(env));
  app.use('/api', cors(corsOptions(env)));
  app.use('/api', createHealthRouter(ctx));
  app.use('/api', express.json({ limit: JSON_BODY_LIMIT }));
  app.use('/api', noStore);
  app.use('/api', authenticate(ctx));
  app.use('/api', getRateLimiters(ctx).api);
  for (const createRouter of API_ROUTERS) app.use('/api', createRouter(ctx));
  app.use('/api', apiNotFound);

  mountWebApp(app, env);
  app.use((_req, res) => {
    res.status(404).type('text/plain').send('Not found');
  });
  app.use(createErrorHandler());
  return app;
}
