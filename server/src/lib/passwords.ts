/**
 * Password hashing with scrypt (N=16384, r=8, p=5, 64-byte key, 16-byte salt), stored as
 * `scrypt$16384$8$5$<saltB64>$<hashB64>`. Verification reads the parameters from the stored string, so the
 * cost can be raised later (see needsRehash). Hashing is CPU and memory heavy, so at most four run at once.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const PARAMS = { N: 16384, r: 8, p: 5, keyLength: 64, saltLength: 16 } as const;
const MAX_MEMORY_BYTES = 64 * 1024 * 1024;
const MAX_CONCURRENT_HASHES = 4;

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

/**
 * Hash of a random, discarded password with the current parameters. Verifying against it when the account
 * doesn't exist (or has no password) costs the same time as a real check, so timing reveals nothing.
 */
const DUMMY_HASH =
  'scrypt$16384$8$5$5Q6SClS+080R+z82EaiG1Q==$yFlgI8R+29KAX/MNZP4a2SCgFPiV+Cu3WrvO0Zxggw5HyjsQnWg7KOG8mGQ2kL9EAf/nj2lbIdfpFnQsgMlagw==';

class Semaphore {
  #available: number;
  readonly #waiting: (() => void)[] = [];

  constructor(size: number) {
    this.#available = size;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.#available > 0) this.#available--;
    else await new Promise<void>((resolve) => this.#waiting.push(resolve));
    try {
      return await task();
    } finally {
      const next = this.#waiting.shift();
      if (next) next();
      else this.#available++;
    }
  }
}

const hashing = new Semaphore(MAX_CONCURRENT_HASHES);

function derive(password: string, salt: Buffer, N: number, r: number, p: number, keyLength: number): Promise<Buffer> {
  // NFKC so the same password typed on different keyboards/OSes produces the same bytes.
  const normalized = password.normalize('NFKC');
  return hashing.run(
    () =>
      new Promise<Buffer>((resolve, reject) => {
        scrypt(normalized, salt, keyLength, { N, r, p, maxmem: MAX_MEMORY_BYTES }, (error, key) => (error ? reject(error) : resolve(key)));
      }),
  );
}

function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 1 && (n & (n - 1)) === 0;
}

function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const N = Number(n);
  const R = Number(r);
  const P = Number(p);
  if (!isPowerOfTwo(N) || N > 2 ** 20 || !Number.isInteger(R) || R < 1 || R > 32 || !Number.isInteger(P) || P < 1 || P > 16) {
    return null;
  }
  const salt = Buffer.from(saltB64, 'base64');
  const hash = Buffer.from(hashB64, 'base64');
  if (salt.length < 8 || hash.length < 16 || hash.length > 128) return null;
  return { N, r: R, p: P, salt, hash };
}

const DUMMY = parseHash(DUMMY_HASH) as ParsedHash;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PARAMS.saltLength);
  const key = await derive(password, salt, PARAMS.N, PARAMS.r, PARAMS.p, PARAMS.keyLength);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

/**
 * Check `password` against a stored hash. A missing/empty/malformed hash still performs a full scrypt run
 * (against the dummy hash) and returns false, so "no such user" and "wrong password" take the same time.
 */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parsed = stored ? parseHash(stored) : null;
  const target = parsed ?? DUMMY;
  try {
    const key = await derive(password, target.salt, target.N, target.r, target.p, target.hash.length);
    return parsed !== null && timingSafeEqual(key, target.hash);
  } catch {
    return false;
  }
}

/** True when the stored hash uses different (e.g. weaker) parameters than the current ones. */
export function needsRehash(stored: string): boolean {
  const parsed = parseHash(stored);
  return (
    parsed === null ||
    parsed.N !== PARAMS.N ||
    parsed.r !== PARAMS.r ||
    parsed.p !== PARAMS.p ||
    parsed.hash.length !== PARAMS.keyLength ||
    parsed.salt.length !== PARAMS.saltLength
  );
}
