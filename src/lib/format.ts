/**
 * Display formatting. Dates use the viewer's locale and time zone; relative times are English, matching the UI copy.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole calendar days from `now` to `date` in local time (negative = past). */
function calendarDayDiff(date: Date, now: Date): number {
  return Math.round((startOfDay(date) - startOfDay(now)) / DAY);
}

/**
 * "Just now", "5 min ago", "3 hr ago", "Yesterday", "4 days ago", then a date ("Mar 4" / "Mar 4, 2025").
 * Future times read "In 5 min", "In 3 hr", "Tomorrow", "In 4 days". Meant to stand alone (capitalised).
 */
export function timeAgo(value: string | number | Date, now: number | Date = Date.now()): string {
  const date = toDate(value);
  if (!isValidDate(date)) return '';
  const nowDate = toDate(now);
  const diff = date.getTime() - nowDate.getTime();
  const abs = Math.abs(diff);
  const future = diff > 0;

  if (abs < MINUTE) return future ? 'In a moment' : 'Just now';
  if (abs < HOUR) {
    const minutes = Math.floor(abs / MINUTE);
    return future ? `In ${minutes} min` : `${minutes} min ago`;
  }
  const days = calendarDayDiff(date, nowDate);
  // Within half a day, or earlier today, hours read better than "Yesterday".
  if (abs < 12 * HOUR || days === 0) {
    const hours = Math.floor(abs / HOUR);
    return future ? `In ${hours} hr` : `${hours} hr ago`;
  }
  if (days === -1) return 'Yesterday';
  if (days === 1) return 'Tomorrow';
  if (Math.abs(days) < 7) return future ? `In ${days} days` : `${-days} days ago`;
  return formatDate(date, { now: nowDate });
}

export interface FormatDateOptions {
  /** 'auto' (default) omits the year when it is the current year. */
  year?: 'auto' | 'always';
  /** Prefix the weekday ("Mon, Mar 4"). */
  weekday?: boolean;
  now?: number | Date;
}

/** "Mar 4" (this year) or "Mar 4, 2025"; locale-aware. */
export function formatDate(value: string | number | Date, options: FormatDateOptions = {}): string {
  const date = toDate(value);
  if (!isValidDate(date)) return '';
  const now = toDate(options.now ?? Date.now());
  const showYear = options.year === 'always' || date.getFullYear() !== now.getFullYear();
  return new Intl.DateTimeFormat(undefined, {
    weekday: options.weekday ? 'short' : undefined,
    month: 'short',
    day: 'numeric',
    year: showYear ? 'numeric' : undefined,
  }).format(date);
}

/** "10:42 AM" (or "10:42" in 24-hour locales). */
export function formatTime(value: string | number | Date): string {
  const date = toDate(value);
  if (!isValidDate(date)) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

/**
 * Event dates: a same-day range shows the times ("Oct 5, 10:00 AM – 6:00 PM"); multi-day ranges collapse shared parts
 * ("Oct 4 – 6", "Oct 30 – Nov 2, 2027"). The year is shown only when it isn't the current year.
 */
export function formatDateRange(start: string | number | Date, end: string | number | Date, now: number | Date = Date.now()): string {
  const from = toDate(start);
  const to = toDate(end);
  if (!isValidDate(from) || !isValidDate(to)) return '';
  const currentYear = toDate(now).getFullYear();
  const showYear = from.getFullYear() !== currentYear || to.getFullYear() !== currentYear;
  const sameDay = startOfDay(from) === startOfDay(to);
  const format = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: showYear ? 'numeric' : undefined,
    ...(sameDay ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
  return format.formatRange(from, to);
}

/** Up to two initials from a display name ("Garvit Prakash" → "GP", "ananya" → "A"). */
export function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+/u, ''))
    .filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0])[0] ?? '';
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? '') : '';
  return (first + last).toLocaleUpperCase();
}

const pad = (value: number) => String(value).padStart(2, '0');

/** ISO timestamp → value for <input type="datetime-local"> in the viewer's time zone ("2026-10-05T14:30"). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (!isValidDate(date)) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local"> value (local time) → ISO timestamp in UTC. Returns '' when empty or invalid. */
export function fromLocalInput(value: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value?.trim() ?? '');
  if (!match) return '';
  const [, year, month, day, hours, minutes, seconds] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds ?? 0));
  // Reject values the Date constructor silently rolled over (e.g. "2026-02-31").
  if (!isValidDate(date) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return '';
  return date.toISOString();
}
