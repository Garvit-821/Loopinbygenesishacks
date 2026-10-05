import { afterEach, describe, expect, it, vi } from 'vitest';
import { cn, DEFAULT_NEXT, publicUrl, safeHref, safeNext } from './utils';

describe('cn', () => {
  it('keeps a named font size next to a text color', () => {
    expect(cn('text-headline text-ink')).toBe('text-headline text-ink');
    expect(cn('text-large-title', 'text-accent-ink')).toBe('text-large-title text-accent-ink');
  });

  it('lets a later named font size win', () => {
    expect(cn('text-body', 'text-headline')).toBe('text-headline');
    expect(cn('text-large-title text-caption')).toBe('text-caption');
  });

  it('resolves conflicts between color tokens', () => {
    expect(cn('text-ink', 'text-ink-2')).toBe('text-ink-2');
    expect(cn('bg-surface p-4', 'bg-surface-3')).toBe('p-4 bg-surface-3');
  });

  it('knows the custom radius, shadow and z-index tokens', () => {
    expect(cn('rounded-card', 'rounded-full')).toBe('rounded-full');
    expect(cn('shadow-card', 'shadow-none')).toBe('shadow-none');
    expect(cn('z-bar', 'z-dialog')).toBe('z-dialog');
  });

  it('treats safe-area utilities as padding', () => {
    expect(cn('pb-4', 'pb-safe')).toBe('pb-safe');
    expect(cn('pb-safe-offset-4', 'pb-2')).toBe('pb-2');
  });

  it('drops falsy values', () => {
    expect(cn('flex', false, null, undefined, 'gap-2')).toBe('flex gap-2');
  });
});

describe('safeNext', () => {
  it('accepts same-origin paths, keeping query and hash', () => {
    expect(safeNext('/u/ananya_ml')).toBe('/u/ananya_ml');
    expect(safeNext('/network/abc?tab=notes#top')).toBe('/network/abc?tab=notes#top');
  });

  it.each([
    null,
    undefined,
    '',
    'passport',
    'https://evil.example/passport',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    'javascript:alert(1)',
  ])('rejects %j', (raw) => {
    expect(safeNext(raw)).toBe(DEFAULT_NEXT);
  });

  it('rejects public-only pages, which would redirect in a loop', () => {
    for (const path of ['/', '/login', '/login/', '/signup?next=/live', '/forgot-password', '/reset-password', '/auth/callback']) {
      expect(safeNext(path)).toBe(DEFAULT_NEXT);
    }
  });
});

describe('safeHref', () => {
  it('allows http and https URLs', () => {
    expect(safeHref('https://github.com/Garvit-821')).toBe('https://github.com/Garvit-821');
    expect(safeHref('  http://example.com ')).toBe('http://example.com/');
  });

  it.each([null, undefined, '', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,hi', 'mailto:a@example.com', '/relative', 'example.com'])(
    'rejects %j',
    (url) => {
      expect(safeHref(url)).toBeNull();
    },
  );
});

describe('publicUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses VITE_PUBLIC_APP_URL when set, without doubling slashes', () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', 'https://loopin.example/');
    expect(publicUrl('/u/gpdev')).toBe('https://loopin.example/u/gpdev');
  });

  it('falls back to the current origin', () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', '');
    expect(publicUrl('/c/abc')).toBe(`${window.location.origin}/c/abc`);
  });

  it('adds a missing leading slash', () => {
    vi.stubEnv('VITE_PUBLIC_APP_URL', 'https://loopin.example');
    expect(publicUrl('u/gpdev')).toBe('https://loopin.example/u/gpdev');
  });
});
