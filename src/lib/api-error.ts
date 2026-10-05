import type { ClientErrorCode, ErrorCode } from '@loopin/shared';

export type ApiErrorCode = ErrorCode | ClientErrorCode;

/** Thrown by apiFetch for every failed request (server error envelope, network failure or timeout). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  /** Field path → message for form errors ('_' = form-level). */
  readonly fields?: Record<string, string>;

  constructor(init: { status: number; code: ApiErrorCode; message: string; fields?: Record<string, string> }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    if (init.fields) this.fields = init.fields;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Messages for the client-only codes (status 0); apiFetch uses these when building the error. */
export const CLIENT_ERROR_MESSAGES: Record<ClientErrorCode, string> = {
  network_error: "You're offline or the server can't be reached.",
  timeout: 'The connection is too slow — try again.',
};

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/** True when retrying the same request may succeed (connectivity, throttling, transient server trouble). */
export function isRetryableError(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return ['network_error', 'timeout', 'rate_limited', 'unavailable', 'internal'].includes(error.code);
}

/**
 * One-line, user-facing message for any thrown value. Server messages are already written for people;
 * codes whose server text is generic get friendlier copy. Non-API errors never leak technical details.
 */
export function errorMessage(error: unknown, fallback: string = GENERIC_MESSAGE): string {
  if (!isApiError(error)) return fallback;
  switch (error.code) {
    case 'network_error':
    case 'timeout':
      return CLIENT_ERROR_MESSAGES[error.code];
    case 'rate_limited':
      return "You're going a bit fast. Wait a moment and try again.";
    case 'unavailable':
      return 'Loopin is busy right now. Try again in a moment.';
    case 'internal':
      return 'Something went wrong on our side. Please try again.';
    case 'unauthorized':
      return 'Your session has ended. Sign in again to continue.';
    default:
      return error.message || fallback;
  }
}

export interface ErrorDescription {
  title: string;
  message: string;
  retryable: boolean;
  kind: 'offline' | 'slow' | 'throttled' | 'forbidden' | 'not_found' | 'signed_out' | 'generic';
}

/** Title + message pair for full error states (ErrorState, route errors). */
export function describeError(error: unknown): ErrorDescription {
  const message = errorMessage(error);
  const retryable = isRetryableError(error);
  if (!isApiError(error)) return { title: 'Something went wrong', message, retryable, kind: 'generic' };
  switch (error.code) {
    case 'network_error':
      return { title: "You're offline", message, retryable, kind: 'offline' };
    case 'timeout':
      return { title: 'Slow connection', message, retryable, kind: 'slow' };
    case 'rate_limited':
      return { title: 'Too many requests', message, retryable, kind: 'throttled' };
    case 'forbidden':
    case 'not_connected':
      return { title: "You don't have access", message, retryable, kind: 'forbidden' };
    case 'not_found':
      return { title: "We couldn't find that", message, retryable, kind: 'not_found' };
    case 'unauthorized':
      return { title: 'Signed out', message, retryable, kind: 'signed_out' };
    default:
      return { title: 'Something went wrong', message, retryable, kind: 'generic' };
  }
}
