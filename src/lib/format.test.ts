import { describe, expect, it } from 'vitest';
import { formatDate, formatDateRange, formatTime, fromLocalInput, initials, timeAgo, toLocalInput } from './format';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Oct 5 2026, 3:00 PM in the test runner's local time zone. */
const NOW = new Date(2026, 9, 5, 15, 0).getTime();

describe('timeAgo', () => {
  it('describes the recent past', () => {
    expect(timeAgo(NOW - 20_000, NOW)).toBe('Just now');
    expect(timeAgo(NOW - 5 * MINUTE, NOW)).toBe('5 min ago');
    expect(timeAgo(NOW - 3 * HOUR, NOW)).toBe('3 hr ago');
  });

  it('uses hours within half a day and for earlier today', () => {
    const lateNight = new Date(2026, 9, 5, 2, 0).getTime();
    expect(timeAgo(new Date(2026, 9, 4, 22, 0), lateNight)).toBe('4 hr ago');
    const evening = new Date(2026, 9, 5, 23, 0).getTime();
    expect(timeAgo(new Date(2026, 9, 5, 8, 0), evening)).toBe('15 hr ago');
  });

  it('uses calendar days further back', () => {
    expect(timeAgo(new Date(2026, 9, 4, 9, 0), NOW)).toBe('Yesterday');
    expect(timeAgo(new Date(2026, 9, 1, 12, 0), NOW)).toBe('4 days ago');
  });

  it('describes the future', () => {
    expect(timeAgo(NOW + 30_000, NOW)).toBe('In a moment');
    expect(timeAgo(NOW + 5 * MINUTE, NOW)).toBe('In 5 min');
    expect(timeAgo(NOW + 2 * HOUR, NOW)).toBe('In 2 hr');
    expect(timeAgo(new Date(2026, 9, 6, 15, 0), NOW)).toBe('Tomorrow');
    expect(timeAgo(new Date(2026, 9, 8, 10, 0), NOW)).toBe('In 3 days');
  });

  it('falls back to a date after a week', () => {
    const old = new Date(2026, 8, 20, 10, 0);
    expect(timeAgo(old, NOW)).toBe(formatDate(old, { now: NOW }));
  });

  it('returns an empty string for invalid input', () => {
    expect(timeAgo('not a date', NOW)).toBe('');
  });
});

describe('formatDate / formatTime', () => {
  it('omits the year for the current year unless asked', () => {
    const date = new Date(2026, 2, 4, 9, 30);
    expect(formatDate(date, { now: NOW })).not.toContain('2026');
    expect(formatDate(date, { now: NOW, year: 'always' })).toContain('2026');
    expect(formatDate(new Date(2025, 2, 4), { now: NOW })).toContain('2025');
  });

  it('formats the time of day', () => {
    expect(formatTime(new Date(2026, 9, 5, 10, 42))).toMatch(/10:42/);
    expect(formatTime('nope')).toBe('');
  });
});

describe('formatDateRange', () => {
  it('shows both times for a same-day range', () => {
    const start = new Date(2026, 9, 9, 10, 0);
    const end = new Date(2026, 9, 9, 18, 0);
    // ICU may use narrow no-break spaces in ranges ("10:00\u202fAM"); compare words, not space characters.
    const words = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ');
    const text = words(formatDateRange(start, end, NOW));
    expect(text).toContain(words(formatTime(start)));
    expect(text).toContain(words(formatTime(end)));
    expect(text).not.toContain('2026');
  });

  it('collapses a multi-day range in the current year', () => {
    const text = formatDateRange(new Date(2026, 9, 4, 9, 0), new Date(2026, 9, 6, 18, 0), NOW);
    expect(text).not.toContain('2026');
    expect(text).not.toMatch(/AM|PM|:\d\d/);
  });

  it('includes years when the range leaves the current year', () => {
    const text = formatDateRange(new Date(2026, 11, 30), new Date(2027, 0, 2), NOW);
    expect(text).toContain('2026');
    expect(text).toContain('2027');
  });
});

describe('initials', () => {
  it.each([
    ['Garvit Prakash', 'GP'],
    ['ananya', 'A'],
    ['  Elena   Kovač ', 'EK'],
    ["Mary-Jane O'Neil", 'MO'],
    ['@gpdev', 'G'],
    ['Ünal Şahin', 'ÜŞ'],
    ['', '?'],
  ])('%j → %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });
});

describe('toLocalInput / fromLocalInput', () => {
  it('round-trips a datetime-local value', () => {
    expect(toLocalInput(fromLocalInput('2026-10-05T14:30'))).toBe('2026-10-05T14:30');
    expect(toLocalInput(fromLocalInput('2026-01-01T00:05'))).toBe('2026-01-01T00:05');
  });

  it('round-trips an ISO timestamp to the minute', () => {
    const iso = '2026-10-05T09:15:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
  });

  it('produces UTC ISO strings', () => {
    expect(fromLocalInput('2026-10-05T14:30')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
  });

  it('rejects empty and invalid values', () => {
    expect(fromLocalInput('')).toBe('');
    expect(fromLocalInput(null)).toBe('');
    expect(fromLocalInput('2026-02-31T10:00')).toBe('');
    expect(fromLocalInput('tomorrow at noon')).toBe('');
    expect(toLocalInput('not a date')).toBe('');
    expect(toLocalInput(undefined)).toBe('');
  });
});
