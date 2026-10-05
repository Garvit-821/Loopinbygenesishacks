import type { RequestHandler } from 'express';

const CREDENTIAL_PATH = /^\/credentials\/[^/]+\/?$/;

/** Paths (relative to /api) that may be cached: health, the public signing key and credential verification. */
function isCacheable(method: string, path: string): boolean {
  if (path === '/health' || path === '/keys') return true;
  return (method === 'GET' || method === 'HEAD') && CREDENTIAL_PATH.test(path);
}

/** Mounted on /api: `Cache-Control: no-store` for everything personal (i.e. almost every response). */
export const noStore: RequestHandler = (req, res, next) => {
  if (!isCacheable(req.method, req.path)) res.setHeader('Cache-Control', 'no-store');
  next();
};
