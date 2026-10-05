import { isApiErrorBody, type ErrorCode } from '@loopin/shared';
import { ApiError, CLIENT_ERROR_MESSAGES } from './api-error';

/** `/api` on the same origin, or on VITE_API_URL when the web app is hosted apart from the API (and in native shells). */
export const API_BASE = `${(import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '')}/api`;

// ---------------------------------------------------------------------------
// Session token
// ---------------------------------------------------------------------------

/** localStorage key of the bearer token (the screenshot harness seeds it too). */
export const TOKEN_STORAGE_KEY = 'loopin.token';

/** Reads the token persisted on this device (null when absent or when storage is blocked). */
export function readStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

let token: string | null = readStoredToken();
const tokenListeners = new Set<() => void>();

export function getToken(): string | null {
  return token;
}

/** Store or clear the session token, then notify subscribers (auth state, the live stream). */
export function setToken(next: string | null): void {
  if (next === token) return;
  token = next;
  try {
    if (next) window.localStorage.setItem(TOKEN_STORAGE_KEY, next);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, site data disabled): the session lasts for this page only.
  }
  tokenListeners.forEach((listener) => listener());
}

export function subscribeToken(listener: () => void): () => void {
  tokenListeners.add(listener);
  return () => {
    tokenListeners.delete(listener);
  };
}

let unauthorizedHandler: (() => void) | null = null;

/** Registered by AuthProvider: what to do when the server says the session is gone. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

/**
 * A request sent with `sentToken` came back 401 'unauthorized'. Ignored when the session changed in the meantime,
 * so a late response for an old session can never sign out the account that is signed in now.
 */
export function reportUnauthorized(sentToken: string): void {
  if (sentToken === token) unauthorizedHandler?.();
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type QueryValue = string | number | boolean | null | undefined;

export interface ApiFetchOptions {
  method?: HttpMethod;
  /** Sent as JSON. */
  body?: unknown;
  /** Query-string parameters; null and undefined values are left out. */
  query?: Record<string, QueryValue>;
  /** Cancels the request (e.g. TanStack Query's signal); the promise rejects with the abort reason. */
  signal?: AbortSignal;
  /** Send the session token (default true). */
  auth?: boolean;
  /** Fails with code 'timeout' after this long (default 15 s), including reading the body. */
  timeoutMs?: number;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

/** Absolute API URL for a path such as '/auth/github' (also used for full-page navigations to the API). */
export function apiUrl(path: string, query?: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== null && value !== undefined) search.set(key, String(value));
  }
  const queryString = search.toString();
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}${queryString ? `?${queryString}` : ''}`;
}

/** Used only when a failed response has no error envelope (e.g. a proxy or gateway answered). */
const FALLBACK_MESSAGES: Partial<Record<ErrorCode, string>> = {
  unauthorized: 'Sign in to continue.',
  forbidden: "You don't have access to that.",
  not_found: "We couldn't find that.",
  conflict: 'That conflicts with something that already exists.',
  payload_too_large: "That's too large to send.",
  rate_limited: "You're going a bit fast. Wait a moment and try again.",
  unavailable: 'Loopin is busy right now. Try again in a moment.',
  internal: 'Something went wrong on our side. Please try again.',
};
const BAD_REQUEST_MESSAGE = "That didn't work. Please try again.";
const UNEXPECTED_RESPONSE_MESSAGE = 'The server sent a response Loopin could not read.';

function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 413:
      return 'payload_too_large';
    case 429:
      return 'rate_limited';
    case 502:
    case 503:
    case 504:
      return 'unavailable';
    default:
      return status >= 500 ? 'internal' : 'bad_request';
  }
}

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('The request was aborted.', 'AbortError');
}

function toResult<T>(response: Response, text: string, sentToken: string | null): T {
  let data: unknown;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }

  if (response.ok) {
    if (!text) return undefined as T;
    if (data === undefined) throw new ApiError({ status: response.status, code: 'internal', message: UNEXPECTED_RESPONSE_MESSAGE });
    return data as T;
  }

  const envelope = isApiErrorBody(data) ? data.error : null;
  const code = envelope?.code ?? codeForStatus(response.status);
  const error = new ApiError({
    status: response.status,
    code,
    message: envelope?.message || FALLBACK_MESSAGES[code] || BAD_REQUEST_MESSAGE,
    ...(envelope?.fields ? { fields: envelope.fields } : {}),
  });
  // Only the server's own 'unauthorized' code means "signed out" ('invalid_credentials' is a wrong password,
  // and a bare 401 from a proxy proves nothing about the session).
  if (response.status === 401 && envelope?.code === 'unauthorized' && sentToken) reportUnauthorized(sentToken);
  throw error;
}

/**
 * Call the Loopin API. Resolves with the parsed JSON body (undefined for 204), rejects with an ApiError
 * (server envelope, 'network_error' or 'timeout'), or with the abort reason when `signal` aborts.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const sentToken = auth ? token : null;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) controller.abort(signal.reason);
  else signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    let response: Response;
    let text: string;
    try {
      response = await fetch(apiUrl(path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        credentials: 'omit',
      });
      text = response.status === 204 ? '' : await response.text();
    } catch {
      if (signal?.aborted) throw abortReason(signal);
      if (timedOut) throw new ApiError({ status: 0, code: 'timeout', message: CLIENT_ERROR_MESSAGES.timeout });
      throw new ApiError({ status: 0, code: 'network_error', message: CLIENT_ERROR_MESSAGES.network_error });
    }
    return toResult<T>(response, text, sentToken);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}
