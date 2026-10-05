export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;

/** ISO-8601 UTC string ("…Z") for API responses. Accepts Date objects and driver timestamp strings. */
export function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

export function isoOrNull(value: Date | string | null | undefined): string | null {
  return value === null || value === undefined ? null : iso(value);
}
