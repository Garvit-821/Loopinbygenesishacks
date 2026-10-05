/**
 * Error envelope used by every non-2xx API response:
 *   { "error": { "code": "validation_error", "message": "…", "fields": { "email": "…" } } }
 */

export const ERROR_CODES = [
  'validation_error', // 400 — body/query failed schema validation (see `fields`)
  'bad_request', // 400 — semantically invalid request (malformed JSON, unknown referenced event, …)
  'unauthorized', // 401 — missing/expired/revoked session. The ONLY code that means "you are signed out".
  'invalid_credentials', // 401 — wrong email/password or wrong current password. Never means the session expired.
  'forbidden', // 403 — signed in but not allowed (e.g. not an organizer, or re-authentication required)
  'not_found', // 404 — also returned for malformed ids
  'conflict', // 409 — duplicate handle/email/slug/vouch/award, event with credentials, …
  'payload_too_large', // 413
  'rate_limited', // 429
  'badge_invalid', // 400 — not a Loopin code, unknown/rotated code, or the signature does not match
  'badge_expired', // 400 — genuine code (or connect ticket), but outside its validity window
  'self_exchange', // 400 — scanned your own code
  'not_connected', // 403 — action requires a mutual connection (e.g. vouching)
  'unavailable', // 503 — transient (database busy/deadlock, shutting down); safe to retry
  'internal', // 500
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Client-side only codes (never sent by the server) used by the web app's ApiError. */
export type ClientErrorCode = 'network_error' | 'timeout';

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    /** Field path (dot-joined) → first message, for form validation errors. */
    fields?: Record<string, string>;
  };
}

export interface IssueLike {
  path: readonly PropertyKey[];
  message: string;
}

/** Collapse zod issues into `{ "a.b": "first message" }` for form display. */
export function issuesToFields(issues: readonly IssueLike[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_';
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.code === 'string' &&
    typeof (value as ApiErrorBody).error?.message === 'string'
  );
}
