/** Small pure helpers: slugs, tokens, time, logging serializers, DB error classification. */
import { DrizzleQueryError } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { isUuid, LIMITS } from '@loopin/shared';
import { isRetryableTransactionError, isUniqueViolation, pgError, retryOnTransactionConflict } from '../src/lib/db-errors';
import { sanitizeUrl, serializeError } from '../src/lib/logger';
import { toHttpError } from '../src/middleware/error';
import { slugify, uniqueSlug } from '../src/lib/slug';
import { iso, isoOrNull } from '../src/lib/time';
import { TOKEN_PREFIXES, randomToken, sha256Hex } from '../src/lib/tokens';

function pgFailure(code: string, extra: Record<string, unknown> = {}): DrizzleQueryError {
  const cause = Object.assign(new Error(`duplicate key value violates unique constraint (Key (email)=(ada@example.com))`), { code, ...extra });
  return new DrizzleQueryError('insert into "users" ("email") values ($1)', ['ada@example.com'], cause);
}

describe('slugify / uniqueSlug', () => {
  it('makes URL-safe slugs', () => {
    expect(slugify('Genesis Hacks 2026!')).toBe('genesis-hacks-2026');
    expect(slugify('  Café — Résumé  ')).toBe('cafe-resume');
    expect(slugify('x'.repeat(100))).toHaveLength(LIMITS.slugMax);
    expect(slugify('a-'.repeat(40))).not.toMatch(/-$/);
  });

  it('adds numeric suffixes until a slug is free, pads short names and avoids UUID-shaped slugs', async () => {
    const taken = new Set(['genesis-hacks', 'genesis-hacks-2']);
    expect(await uniqueSlug('Genesis Hacks', async (s) => taken.has(s))).toBe('genesis-hacks-3');
    expect(await uniqueSlug('AI', async () => false)).toBe('ai-event');
    expect(await uniqueSlug('!!!', async () => false)).toBe('event');
    const uuidName = '11111111-1111-1111-1111-111111111111';
    const slug = await uniqueSlug(uuidName, async () => false);
    expect(isUuid(slug)).toBe(false);
    expect(slug.length).toBeLessThanOrEqual(LIMITS.slugMax);
  });

  it('falls back to a random suffix when every numbered slug is taken', async () => {
    const slug = await uniqueSlug('Busy', async (s) => s === 'busy' || /^busy-\d+$/.test(s));
    expect(slug).toMatch(/^busy-[0-9a-f]{6}$/);
  });
});

describe('tokens and time', () => {
  it('creates prefixed random tokens and stores only their hash', () => {
    const token = randomToken(TOKEN_PREFIXES.session);
    expect(token).toMatch(/^lp_[A-Za-z0-9_-]{43}$/);
    expect(randomToken(TOKEN_PREFIXES.session)).not.toBe(token);
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('formats timestamps as UTC ISO strings', () => {
    expect(iso(new Date(Date.UTC(2026, 9, 5, 10)))).toBe('2026-10-05T10:00:00.000Z');
    expect(iso('2026-10-05 15:30:00+05:30')).toBe('2026-10-05T10:00:00.000Z');
    expect(isoOrNull(null)).toBeNull();
  });
});

describe('logging', () => {
  it('drops query strings and masks badge tokens in URLs', () => {
    expect(sanitizeUrl('/api/badge/preview?token=abc')).toBe('/api/badge/preview');
    expect(sanitizeUrl('/c/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd')).toBe('/c/:token');
    expect(sanitizeUrl('/reset-password#token=lpr_x')).toBe('/reset-password');
  });

  it('never logs SQL, parameters or Postgres messages for database errors', () => {
    const output = JSON.stringify(serializeError(pgFailure('23505', { constraint: 'users_email_unique', table: 'users' })));
    expect(output).toContain('"pgCode":"23505"');
    expect(output).toContain('users_email_unique');
    expect(output).not.toContain('ada@example.com');
    expect(output).not.toContain('insert into');
  });

  it('describes non-Postgres causes of failed queries without the query', () => {
    const cause = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' });
    const output = JSON.stringify(serializeError(new DrizzleQueryError('select * from users where email = $1', ['ada@example.com'], cause)));
    expect(output).toContain('ECONNREFUSED');
    expect(output).not.toContain('ada@example.com');
    expect(output).not.toContain('select *');
  });

  it('keeps message and stack for ordinary errors', () => {
    const output = serializeError(new TypeError('boom'));
    expect(output).toMatchObject({ type: 'TypeError', message: 'boom' });
    expect(String(output.stack)).toContain('TypeError: boom');
  });
});

describe('db-errors', () => {
  it('finds the Postgres error behind drizzle wrappers', () => {
    expect(pgError(pgFailure('23505', { constraint: 'users_email_unique' }))).toEqual({ code: '23505', constraint: 'users_email_unique' });
    expect(pgError(Object.assign(new Error('x'), { code: '22P02' }))).toEqual({ code: '22P02' });
    expect(pgError(Object.assign(new Error('x'), { code: 'ECONNREFUSED' }))).toBeNull();
    expect(pgError('nope')).toBeNull();
  });

  it('does not mistake five-letter Node or library error codes for Postgres errors', () => {
    for (const code of ['EPIPE', 'EPERM', 'EBUSY', 'EROFS', 'EAUTH']) {
      const error = Object.assign(new Error(`${code}: something failed`), { code });
      expect(pgError(error), code).toBeNull();
      expect(pgError(new DrizzleQueryError('select 1', [], error)), code).toBeNull();
      // Logged with their message (a Postgres error would be reduced to its code), and answered as a plain 500.
      expect(serializeError(error)).toMatchObject({ code, message: `${code}: something failed` });
      expect(toHttpError(error).code).toBe('internal');
    }
    for (const code of ['23505', '40P01', '22P02', '0A000', 'P0001', 'XX000', 'HV000', 'F0000']) {
      expect(pgError(Object.assign(new Error('x'), { code }))?.code, code).toBe(code);
    }
  });

  it('classifies unique violations and retryable failures', () => {
    expect(isUniqueViolation(pgFailure('23505', { constraint: 'vouches_pair_skill_uq' }), 'vouches_pair_skill_uq')).toBe(true);
    expect(isUniqueViolation(pgFailure('23505', { constraint: 'other' }), 'vouches_pair_skill_uq')).toBe(false);
    expect(isRetryableTransactionError(pgFailure('40P01'))).toBe(true);
    expect(isRetryableTransactionError(pgFailure('40001'))).toBe(true);
    expect(isRetryableTransactionError(pgFailure('23505'))).toBe(false);
  });

  it('retries a transaction once on deadlock, then gives up', async () => {
    let calls = 0;
    expect(
      await retryOnTransactionConflict(async () => {
        calls += 1;
        if (calls === 1) throw pgFailure('40P01');
        return 'done';
      }),
    ).toBe('done');
    calls = 0;
    await expect(
      retryOnTransactionConflict(async () => {
        calls += 1;
        throw pgFailure('40001');
      }),
    ).rejects.toBeInstanceOf(DrizzleQueryError);
    expect(calls).toBe(2);
    await expect(retryOnTransactionConflict(async () => Promise.reject(new Error('other')))).rejects.toThrow('other');
  });
});
