/**
 * Logging. Never log tokens, passwords, query strings or SQL parameters: request logs keep only method, path
 * and status; database errors are reduced to their Postgres code/constraint/table (drizzle's error message
 * embeds the SQL and its parameters, and driver messages can echo input values).
 */
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { DrizzleQueryError } from 'drizzle-orm';
import type { Request, Response } from 'express';
import pino, { type DestinationStream, type LoggerOptions } from 'pino';
import pinoHttp from 'pino-http';
import type { Logger } from '../context';
import type { DatabaseEnv } from '../env';
import { pgError } from './db-errors';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
];

/** Stack frames without the leading "Name: message" line. */
function stackFrames(error: Error): string | undefined {
  return error.stack
    ?.split('\n')
    .filter((line) => line.trimStart().startsWith('at '))
    .join('\n');
}

/**
 * pino-http hands its `err` serializer pino-std-serializers' copy of the error (whose `message` still embeds
 * drizzle's SQL and parameters); the original error is on the copy's non-enumerable `raw` property.
 */
function unwrapStdSerializedError(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || value instanceof Error) return value;
  const raw = (value as { raw?: unknown }).raw;
  return raw instanceof Error ? raw : value;
}

/** Error serializer used by every logger (including request logs). */
export function serializeError(value: unknown): Record<string, unknown> {
  const error = unwrapStdSerializedError(value);
  if (!(error instanceof Error)) return { type: typeof error, value: String(error).slice(0, 200) };
  const pg = pgError(error);
  if (pg) return { type: error.constructor.name, pgCode: pg.code, constraint: pg.constraint, table: pg.table, stack: stackFrames(error) };
  if (error instanceof DrizzleQueryError) {
    // Not a Postgres error (e.g. the connection failed): the cause is safe to describe, the query is not.
    return { type: 'DrizzleQueryError', cause: error.cause ? serializeError(error.cause) : undefined, stack: stackFrames(error) };
  }
  const code = (error as { code?: unknown }).code;
  return {
    type: error.constructor.name,
    message: error.message,
    ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
    stack: error.stack,
  };
}

/** Path without query string or hash; badge tokens in /c/<token> links are masked. */
export function sanitizeUrl(url: string): string {
  const path = url.split(/[?#]/, 1)[0] ?? '';
  return path.replace(/^\/c\/[^/]+/, '/c/:token');
}

function prettyTransportAvailable(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

/** @param destination where JSON lines go instead of stdout (tests capture logs with it) */
export function createLogger(env: Pick<DatabaseEnv, 'NODE_ENV' | 'LOG_LEVEL'>, destination?: DestinationStream): Logger {
  const options: LoggerOptions = {
    level: env.LOG_LEVEL,
    serializers: { err: serializeError },
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  };
  if (destination) return pino(options, destination);
  // Pretty output only for local development; pino-pretty is a dev dependency.
  if (env.NODE_ENV === 'development' && prettyTransportAvailable()) {
    options.transport = { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } };
  }
  return pino(options);
}

const REQUEST_ID_PATTERN = /^[\w.:-]{1,128}$/;

/** Request logging middleware (first in the chain). Echoes/assigns X-Request-Id. */
export function createHttpLogger(logger: Logger) {
  return pinoHttp<Request, Response>({
    logger,
    genReqId(req, res) {
      const incoming = req.headers['x-request-id'];
      const id = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
      res.setHeader('X-Request-Id', id);
      return id;
    },
    customLogLevel(_req, res, error) {
      if (error || res.statusCode >= 500) return 'error';
      return res.statusCode === 429 ? 'warn' : 'info';
    },
    autoLogging: { ignore: (req) => req.url === '/api/health' },
    customProps: (req) => (req.user ? { userId: req.user.id } : {}),
    serializers: {
      req: (req: { id?: unknown; method?: string; url?: string }) => ({ id: req.id, method: req.method, url: sanitizeUrl(req.url ?? '') }),
      res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
      err: serializeError,
    },
  });
}
