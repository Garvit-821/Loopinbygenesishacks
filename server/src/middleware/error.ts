/**
 * Final error handler: every failure leaves as the shared envelope `{ error: { code, message, fields? } }`.
 * Internal details (stack traces, SQL, Postgres messages) are never sent; 5xx errors are logged through the
 * request logger with the safe error serializer.
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { issuesToFields } from '@loopin/shared';
import { CONSTRAINT_FIELDS, PG_ERROR, pgError } from '../lib/db-errors';
import { HttpError, errorBody, sendError } from '../lib/errors';

/** Messages for unique-constraint conflicts that reach the error handler unhandled. */
const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  email: 'An account with that email already exists.',
  handle: 'That handle is taken.',
  slug: 'That slug is already used by another event.',
  skill: "You've already vouched for that skill.",
  placement: 'That award was already granted.',
};

function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError || (error instanceof Error && error.name === 'ZodError' && Array.isArray((error as ZodError).issues));
}

function numericStatus(error: object): number | undefined {
  const { status, statusCode } = error as { status?: unknown; statusCode?: unknown };
  if (typeof status === 'number') return status;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

/** Map anything thrown in a request to the HttpError that will be sent. */
export function toHttpError(error: unknown): HttpError {
  if (error instanceof HttpError) return error;
  if (isZodError(error)) return new HttpError('validation_error', undefined, issuesToFields(error.issues));

  if (typeof error === 'object' && error !== null) {
    // body-parser (express.json) failures
    const type = (error as { type?: unknown }).type;
    if (type === 'entity.parse.failed') return new HttpError('bad_request', "That request body isn't valid JSON.");
    if (type === 'entity.too.large') return new HttpError('payload_too_large');

    const pg = pgError(error);
    if (pg) {
      switch (pg.code) {
        case PG_ERROR.uniqueViolation: {
          const field = pg.constraint ? CONSTRAINT_FIELDS[pg.constraint] : undefined;
          const message = (field && CONFLICT_MESSAGES[field]) ?? 'That already exists.';
          return new HttpError('conflict', message, field ? { [field]: message } : undefined);
        }
        case PG_ERROR.foreignKeyViolation:
          return new HttpError('bad_request', 'That refers to something that no longer exists.');
        case PG_ERROR.restrictViolation:
          return new HttpError('conflict', "That can't be deleted while other records depend on it.");
        case PG_ERROR.invalidTextRepresentation:
          return new HttpError('bad_request');
        case PG_ERROR.checkViolation:
          return new HttpError('validation_error', "Some of those values aren't allowed.");
        case PG_ERROR.deadlockDetected:
        case PG_ERROR.serializationFailure:
          return new HttpError('unavailable', 'Please try again');
        default:
          return new HttpError('internal');
      }
    }

    // http-errors style objects (body-parser encoding problems, malformed URL parameters, …)
    const status = numericStatus(error);
    if (status !== undefined && status >= 400 && status < 500) {
      if (status === 401) return new HttpError('unauthorized');
      if (status === 403) return new HttpError('forbidden');
      if (status === 404) return new HttpError('not_found');
      if (status === 413) return new HttpError('payload_too_large');
      if (status === 429) return new HttpError('rate_limited');
      return new HttpError('bad_request');
    }
  }
  return new HttpError('internal');
}

export function createErrorHandler(): ErrorRequestHandler {
  // Four parameters: that is how Express recognises an error handler.
  return (error, _req, res, _next) => {
    const httpError = toHttpError(error);
    // pino-http logs the request with this error (through the safe serializer) when it completes.
    if (httpError.status >= 500) res.err = error instanceof Error ? error : new Error(String(error));
    if (res.headersSent) {
      // Failed mid-response (e.g. a stream): the status can't change any more, so drop the connection.
      // (Express's default handler would print the raw error — possibly SQL parameters — to stderr.)
      res.destroy();
      return;
    }
    sendError(res, httpError);
  };
}

/** Unknown /api routes: JSON 404 envelope (never the SPA's index.html). */
export const apiNotFound: RequestHandler = (_req, res) => {
  res.status(404).json(errorBody('not_found', "That API endpoint doesn't exist."));
};
