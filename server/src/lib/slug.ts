import { randomBytes } from 'node:crypto';
import { isUuid, LIMITS } from '@loopin/shared';

/** "Genesis Hacks 2026!" → "genesis-hacks-2026" (ASCII letters/digits and single dashes, ≤ slugMax chars). */
export function slugify(input: string, maxLength: number = LIMITS.slugMax): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}

function withSuffix(base: string, suffix: string): string {
  return `${slugify(base, LIMITS.slugMax - suffix.length - 1)}-${suffix}`;
}

/**
 * A slug for `name` that `isTaken` reports free: the plain slug, then "-2", "-3", … and finally a random
 * suffix. Short results are padded with "-event", and a slug is never allowed to look like a UUID (event
 * routes accept either).
 */
export async function uniqueSlug(name: string, isTaken: (slug: string) => Promise<boolean>): Promise<string> {
  let base = slugify(name);
  if (base.length < LIMITS.slugMin || isUuid(base)) base = base ? withSuffix(base, 'event') : 'event';
  if (!(await isTaken(base))) return base;
  for (let n = 2; n <= 20; n++) {
    const candidate = withSuffix(base, String(n));
    if (!(await isTaken(candidate))) return candidate;
  }
  for (;;) {
    const candidate = withSuffix(base, randomBytes(3).toString('hex'));
    if (!(await isTaken(candidate))) return candidate;
  }
}
