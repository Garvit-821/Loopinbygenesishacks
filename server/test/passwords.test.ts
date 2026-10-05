import { randomBytes, scryptSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, needsRehash, verifyPassword } from '../src/lib/passwords';
import { TEST_PASSWORD, TEST_PASSWORD_HASH } from './helpers';

const FORMAT = /^scrypt\$16384\$8\$5\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/;

/** A hash in the same format but with weaker (older) parameters. */
function legacyHash(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 32, { N: 1024, r: 8, p: 1 });
  return `scrypt$1024$8$1$${salt.toString('base64')}$${key.toString('base64')}`;
}

describe('passwords', () => {
  it('hashes with scrypt N=16384 r=8 p=5, a 16-byte salt and a 64-byte key', async () => {
    const hash = await hashPassword('correct horse battery staple');
    const match = FORMAT.exec(hash);
    expect(match).not.toBeNull();
    expect(Buffer.from(match![1]!, 'base64')).toHaveLength(16);
    expect(Buffer.from(match![2]!, 'base64')).toHaveLength(64);
  });

  it('verifies the right password only, with a fresh salt every time', async () => {
    const [a, b] = await Promise.all([hashPassword('s3cret-pass'), hashPassword('s3cret-pass')]);
    expect(a).not.toBe(b);
    expect(await verifyPassword('s3cret-pass', a)).toBe(true);
    expect(await verifyPassword('s3cret-pass', b)).toBe(true);
    expect(await verifyPassword('s3cret-pasS', a)).toBe(false);
    expect(await verifyPassword('', a)).toBe(false);
  });

  it('returns false (without throwing) for missing or malformed hashes', async () => {
    for (const stored of [null, undefined, '', 'plaintext', 'scrypt$16384$8$5$$', 'scrypt$1000$8$5$c2FsdHNhbHQ=$aGFzaGhhc2hoYXNoaGFzaA==', 'bcrypt$x$y$z$a$b']) {
      expect(await verifyPassword('anything', stored)).toBe(false);
    }
  });

  it('reads parameters from the stored hash and flags weaker ones for rehashing', async () => {
    const legacy = legacyHash('old-password');
    expect(await verifyPassword('old-password', legacy)).toBe(true);
    expect(needsRehash(legacy)).toBe(true);
    expect(needsRehash(await hashPassword('new-password'))).toBe(false);
    expect(needsRehash('garbage')).toBe(true);
  });

  it('normalises Unicode (NFKC) so equivalent input matches', async () => {
    const hash = await hashPassword('password1');
    expect(await verifyPassword('ｐａｓｓｗｏｒｄ1', hash)).toBe(true);
  });

  it('handles many concurrent verifications', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => verifyPassword(i % 2 ? TEST_PASSWORD : 'wrong', TEST_PASSWORD_HASH)));
    expect(results).toEqual(Array.from({ length: 10 }, (_, i) => i % 2 === 1));
  });

  it('ships a test hash that uses the current parameters', async () => {
    expect(await verifyPassword(TEST_PASSWORD, TEST_PASSWORD_HASH)).toBe(true);
    expect(needsRehash(TEST_PASSWORD_HASH)).toBe(false);
  });
});
