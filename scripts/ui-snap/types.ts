import type { ApiErrorBody, ErrorCode } from '@loopin/shared';

/** What a fixture handler receives for an intercepted `/api/**` request. */
export interface FixtureContext {
  url: URL;
  method: string;
  /** Parsed JSON body (undefined when absent or not JSON). */
  body: unknown;
  /** Values of `:name` segments in the handler key, e.g. { handle: 'gpdev' } for 'GET /api/profiles/:handle'. */
  params: Record<string, string>;
  /** True when the request carried an Authorization header (the harness stores a token with --auth). */
  authed: boolean;
}

export interface FixtureResult {
  /** Default 200 (204 when there is no body). */
  status?: number;
  json?: unknown;
  /** Raw body (e.g. an SSE stream); takes precedence over json. */
  body?: string;
  headers?: Record<string, string>;
  /** Simulated latency in ms (useful for loading states). */
  delayMs?: number;
}

export type FixtureHandler = (ctx: FixtureContext) => FixtureResult | Promise<FixtureResult>;

/** Keys are 'METHOD /api/path' with optional `:param` segments, e.g. 'GET /api/events/:id/stats'. */
export type FixtureHandlers = Record<string, FixtureHandler>;

/** 200 with a typed body: `ok<Feed>(feed)`. */
export function ok<T>(json: T, status = 200): FixtureResult {
  return { status, json };
}

export function created<T>(json: T): FixtureResult {
  return { status: 201, json };
}

export function noContent(): FixtureResult {
  return { status: 204 };
}

/** Error envelope exactly as the server sends it. */
export function apiError(status: number, code: ErrorCode, message: string, fields?: Record<string, string>): FixtureResult {
  const body: ApiErrorBody = { error: { code, message, ...(fields ? { fields } : {}) } };
  return { status, json: body };
}

export const unauthorized = (): FixtureResult => apiError(401, 'unauthorized', 'Sign in to continue.');
