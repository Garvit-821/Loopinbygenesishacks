/**
 * Typed HTTP errors. Throw these from routes/services; the error middleware turns them into the shared error
 * envelope `{ error: { code, message, fields? } }`. Messages are user-facing: short, friendly, and never
 * contain identities, tokens or internals.
 */
import type { Response } from 'express';
import type { ApiErrorBody, ErrorCode } from '@loopin/shared';

export const ERROR_STATUS: Record<ErrorCode, number> = {
  validation_error: 400,
  bad_request: 400,
  unauthorized: 401,
  invalid_credentials: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  rate_limited: 429,
  badge_invalid: 400,
  badge_expired: 400,
  self_exchange: 400,
  not_connected: 403,
  unavailable: 503,
  internal: 500,
};

export const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
  validation_error: 'Please check the highlighted fields.',
  bad_request: "That request isn't valid.",
  unauthorized: 'Please sign in to continue.',
  invalid_credentials: 'Incorrect email or password.',
  forbidden: "You don't have permission to do that.",
  not_found: "We couldn't find that.",
  conflict: 'That already exists.',
  payload_too_large: 'That request is too large.',
  rate_limited: 'Too many requests — please wait a moment and try again.',
  badge_invalid: "That code isn't valid.",
  badge_expired: 'That code has expired.',
  self_exchange: "That's your own code.",
  not_connected: 'You need to be connected with this person first.',
  unavailable: 'Please try again.',
  internal: 'Something went wrong on our side. Please try again.',
};

export class HttpError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string = DEFAULT_ERROR_MESSAGES[code],
    /** Field path → message, for form errors ('_' = the form as a whole). */
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'HttpError';
    this.status = ERROR_STATUS[code];
  }

  toBody(): ApiErrorBody {
    return errorBody(this.code, this.message, this.fields);
  }
}

export function errorBody(code: ErrorCode, message: string, fields?: Record<string, string>): ApiErrorBody {
  return { error: fields && Object.keys(fields).length > 0 ? { code, message, fields } : { code, message } };
}

/** Write an HttpError as the JSON envelope (for middleware that responds directly). */
export function sendError(res: Response, error: HttpError): void {
  res.status(error.status).json(error.toBody());
}

type Fields = Record<string, string>;

export const validationError = (fields: Fields, message?: string) => new HttpError('validation_error', message, fields);
export const badRequest = (message?: string, fields?: Fields) => new HttpError('bad_request', message, fields);
export const unauthorized = (message?: string) => new HttpError('unauthorized', message);
export const invalidCredentials = (message?: string, fields?: Fields) => new HttpError('invalid_credentials', message, fields);
export const forbidden = (message?: string) => new HttpError('forbidden', message);
export const notFound = (message?: string, fields?: Fields) => new HttpError('not_found', message, fields);
export const conflict = (message?: string, fields?: Fields) => new HttpError('conflict', message, fields);
export const rateLimited = (message?: string) => new HttpError('rate_limited', message);
export const badgeInvalid = (message?: string) => new HttpError('badge_invalid', message);
export const badgeExpired = (message?: string) => new HttpError('badge_expired', message);
export const selfExchange = (message?: string) => new HttpError('self_exchange', message);
export const notConnected = (message?: string) => new HttpError('not_connected', message);
export const unavailable = (message?: string) => new HttpError('unavailable', message);
