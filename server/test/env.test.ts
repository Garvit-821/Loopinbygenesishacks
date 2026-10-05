import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { EnvError, PGLITE_MEMORY, RATE_LIMIT_DEFAULTS, loadDatabaseEnv, loadEnv, parseTrustProxy, resolveNodeEnv, seedAllowed } from '../src/env';
import { DEFAULT_PGLITE_DIR, SERVER_ROOT } from '../src/paths';
import { TEST_SECRETS } from './helpers';

const tempDirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'loopin-env-'));
  tempDirs.push(dir);
  return dir;
}
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

const PRODUCTION = {
  NODE_ENV: 'production',
  APP_URL: 'https://loopin.example.com',
  DATABASE_URL: 'postgres://loopin:secret@db.internal:5432/loopin',
  TRUST_PROXY: '1',
  ...TEST_SECRETS,
};

function problemsOf(run: () => unknown): string[] {
  try {
    run();
  } catch (error) {
    if (error instanceof EnvError) return [...error.problems];
    throw error;
  }
  throw new Error('expected an EnvError');
}

describe('resolveNodeEnv', () => {
  it('uses an explicit value', () => {
    expect(resolveNodeEnv('production', 'file:///srv/server/src/env.ts')).toBe('production');
    expect(resolveNodeEnv(' test ', 'file:///srv/server/dist/index.js')).toBe('test');
    expect(resolveNodeEnv('development', 'file:///srv/server/dist/index.js')).toBe('development');
  });

  it('defaults to development when running TypeScript sources and production for the bundle', () => {
    expect(resolveNodeEnv(undefined, 'file:///srv/server/src/env.ts')).toBe('development');
    expect(resolveNodeEnv('', 'file:///srv/server/src/env.mts?tsx=1')).toBe('development');
    expect(resolveNodeEnv(undefined, 'file:///srv/server/dist/chunk-ABC123.js')).toBe('production');
    expect(resolveNodeEnv(undefined, 'file:///srv/server/dist/index.js')).toBe('production');
  });

  it('rejects unknown values', () => {
    expect(() => resolveNodeEnv('staging', 'file:///x.ts')).toThrow(EnvError);
  });
});

describe('parseTrustProxy', () => {
  it('parses false, hop counts and true', () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy('')).toBe(false);
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('FALSE')).toBe(false);
    expect(parseTrustProxy('0')).toBe(false);
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('2')).toBe(2);
    expect(parseTrustProxy('true')).toBe(true);
  });

  it('parses comma lists of IPs, CIDR ranges and named ranges', () => {
    expect(parseTrustProxy('loopback')).toEqual(['loopback']);
    expect(parseTrustProxy('10.0.0.0/8, 192.168.1.10,Uniquelocal')).toEqual(['10.0.0.0/8', '192.168.1.10', 'uniquelocal']);
    expect(parseTrustProxy('::1/128,fd00::/8')).toEqual(['::1/128', 'fd00::/8']);
  });

  it('rejects anything else', () => {
    expect(() => parseTrustProxy('yes please')).toThrow(/TRUST_PROXY/);
    expect(() => parseTrustProxy('10.0.0.0/33')).toThrow(/10.0.0.0\/33/);
    expect(() => parseTrustProxy('10.0.0.1/abc')).toThrow();
    expect(() => parseTrustProxy('300.1.1.1')).toThrow();
  });
});

describe('loadEnv in production', () => {
  it('refuses to start without secrets, APP_URL and a database', () => {
    const problems = problemsOf(() => loadEnv({ NODE_ENV: 'production' }));
    expect(problems.join('\n')).toMatch(/APP_URL is required in production/);
    expect(problems.join('\n')).toMatch(/QR_SECRET is required in production/);
    expect(problems.join('\n')).toMatch(/SIGNING_KEY is required in production/);
    expect(problems.join('\n')).toMatch(/DATABASE_URL is required in production/);
  });

  it('accepts an explicit PGLITE_DIR instead of DATABASE_URL', () => {
    const { env } = loadEnv({ ...PRODUCTION, DATABASE_URL: undefined, PGLITE_DIR: '/data/pglite' });
    expect(env.DATABASE_URL).toBeNull();
    expect(env.PGLITE_DIR).toBe('/data/pglite');
  });

  it('loads a complete configuration with production defaults', () => {
    const { env, warnings } = loadEnv(PRODUCTION);
    expect(env.NODE_ENV).toBe('production');
    expect(env.PORT).toBe(8080);
    expect(env.APP_URL).toBe('https://loopin.example.com');
    expect(env.API_URL).toBe('https://loopin.example.com');
    expect(env.QR_SECRET).toHaveLength(32);
    expect(env.SIGNING_KEY).toHaveLength(32);
    expect(env.SEED_DEMO).toBe('false');
    expect(env.DEMO_PASSWORD).toBeNull();
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.TRUST_PROXY).toBe(1);
    expect(env.MAIL_FROM).toBe('Loopin <no-reply@loopin.example.com>');
    expect(warnings).toEqual([]);
  });

  it('warns about plain-http APP_URL and a missing TRUST_PROXY', () => {
    const { warnings } = loadEnv({ ...PRODUCTION, APP_URL: 'http://loopin.example.com', TRUST_PROXY: undefined });
    expect(warnings.join('\n')).toMatch(/APP_URL is not https/);
    expect(warnings.join('\n')).toMatch(/TRUST_PROXY is not set/);
  });

  it('rejects TRUST_PROXY=true in production only', () => {
    expect(problemsOf(() => loadEnv({ ...PRODUCTION, TRUST_PROXY: 'true' })).join('\n')).toMatch(/TRUST_PROXY=true is not allowed/);
    const { env } = loadEnv({ ...TEST_SECRETS, NODE_ENV: 'test', TRUST_PROXY: 'true' });
    expect(env.TRUST_PROXY).toBe(true);
  });

  it('requires DEMO_PASSWORD for SEED_DEMO=force and warns that SEED_DEMO=true is ignored', () => {
    expect(problemsOf(() => loadEnv({ ...PRODUCTION, SEED_DEMO: 'force' })).join('\n')).toMatch(/DEMO_PASSWORD is required/);
    expect(loadEnv({ ...PRODUCTION, SEED_DEMO: 'force', DEMO_PASSWORD: 'correct-horse' }).env.DEMO_PASSWORD).toBe('correct-horse');
    expect(loadEnv({ ...PRODUCTION, SEED_DEMO: 'true' }).warnings.join('\n')).toMatch(/SEED_DEMO=true is ignored/);
  });
});

describe('loadEnv validation', () => {
  const base = { ...TEST_SECRETS, NODE_ENV: 'test' };

  it('requires explicit secrets under NODE_ENV=test', () => {
    const problems = problemsOf(() => loadEnv({ NODE_ENV: 'test' })).join('\n');
    expect(problems).toMatch(/QR_SECRET is required when NODE_ENV=test/);
    expect(problems).toMatch(/SIGNING_KEY is required when NODE_ENV=test/);
  });

  it('accepts base64 and base64url secrets and rejects weak ones', () => {
    const standard = Buffer.alloc(32, 0xfb).toString('base64'); // contains "+", "/" and "=" padding
    expect(loadEnv({ ...base, QR_SECRET: standard, SIGNING_KEY: standard }).env.SIGNING_KEY).toEqual(new Uint8Array(32).fill(0xfb));
    const problems = problemsOf(() => loadEnv({ ...base, QR_SECRET: 'c2hvcnQ', SIGNING_KEY: Buffer.alloc(31).toString('base64url') })).join('\n');
    expect(problems).toMatch(/QR_SECRET must be at least 32 random bytes/);
    expect(problems).toMatch(/SIGNING_KEY must be a 32-byte Ed25519 seed/);
  });

  it('never echoes secret values in problems', () => {
    const secret = 'not*base64*at*all*but*very*secret';
    const problems = problemsOf(() => loadEnv({ ...base, QR_SECRET: secret })).join('\n');
    expect(problems).not.toContain(secret);
  });

  it('validates previous signing public keys', () => {
    const key = Buffer.alloc(32, 1).toString('base64url');
    expect(loadEnv({ ...base, SIGNING_PUBLIC_KEYS_PREVIOUS: `${key}, ${key}` }).env.SIGNING_PUBLIC_KEYS_PREVIOUS).toEqual([key]);
    expect(problemsOf(() => loadEnv({ ...base, SIGNING_PUBLIC_KEYS_PREVIOUS: 'abc' })).join('\n')).toMatch(/SIGNING_PUBLIC_KEYS_PREVIOUS/);
  });

  it('applies defaults', () => {
    const { env } = loadEnv(base);
    expect(env.APP_URL).toBe('http://localhost:5173');
    expect(env.LOG_LEVEL).toBe('warn');
    expect(env.SEED_DEMO).toBe('false');
    expect(env.SESSION_TTL_DAYS).toBe(30);
    expect(env.STREAM_MAX).toBe(5000);
    expect(env.SERVE_WEB).toBe(true);
    expect(env.RATE_LIMIT_IN_TESTS).toBe(false);
    expect(env.PGLITE_DIR).toBe(DEFAULT_PGLITE_DIR);
    for (const [name, value] of Object.entries(RATE_LIMIT_DEFAULTS)) expect(env[name as keyof typeof RATE_LIMIT_DEFAULTS]).toBe(value);
  });

  it('builds the CORS allowlist from APP_URL, the always-allowed origins and CORS_ORIGINS', () => {
    const { env } = loadEnv({ ...base, APP_URL: 'https://app.example.com/', CORS_ORIGINS: 'https://admin.example.com/path, ionic://localhost' });
    expect(env.APP_URL).toBe('https://app.example.com');
    expect(env.CORS_ORIGINS).toEqual(['https://admin.example.com', 'ionic://localhost']);
    expect(env.ALLOWED_ORIGINS).toEqual([
      'https://app.example.com',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'capacitor://localhost',
      'https://localhost',
      'http://localhost',
      'https://admin.example.com',
      'ionic://localhost',
    ]);
    expect(problemsOf(() => loadEnv({ ...base, CORS_ORIGINS: 'not a url' })).join('\n')).toMatch(/CORS_ORIGINS/);
  });

  it('validates numbers, flags, enums, URLs and lists', () => {
    const problems = problemsOf(() =>
      loadEnv({
        ...base,
        PORT: '99999',
        SESSION_TTL_DAYS: '120',
        RATE_LIMIT_API_USER: '0',
        SERVE_WEB: 'maybe',
        LOG_LEVEL: 'loud',
        APP_URL: 'ftp://example.com',
        ADMIN_EMAILS: 'ok@example.com, nope',
        SMTP_URL: 'http://mail',
        DATABASE_URL: 'mysql://db',
        DATABASE_SSL: 'sometimes',
      }),
    ).join('\n');
    for (const name of ['PORT', 'SESSION_TTL_DAYS', 'RATE_LIMIT_API_USER', 'SERVE_WEB', 'LOG_LEVEL', 'APP_URL', 'ADMIN_EMAILS', 'SMTP_URL', 'DATABASE_URL', 'DATABASE_SSL']) {
      expect(problems).toContain(name);
    }
  });

  it('parses overrides', () => {
    const { env } = loadEnv({
      ...base,
      PORT: '0',
      RATE_LIMIT_API_USER: '42',
      RATE_LIMIT_IN_TESTS: '1',
      ADMIN_EMAILS: ' Admin@Example.com ,second@example.com',
      SERVE_WEB: 'false',
      DATABASE_SSL: 'no-verify',
      STREAM_MAX: '12',
      SEED_DEMO: 'FORCE',
      DEMO_PASSWORD: 'demo-pass-123',
    });
    expect(env.PORT).toBe(0);
    expect(env.RATE_LIMIT_API_USER).toBe(42);
    expect(env.RATE_LIMIT_IN_TESTS).toBe(true);
    expect(env.ADMIN_EMAILS).toEqual(['admin@example.com', 'second@example.com']);
    expect(env.SERVE_WEB).toBe(false);
    expect(env.DATABASE_SSL).toBe('no-verify');
    expect(env.STREAM_MAX).toBe(12);
    expect(env.SEED_DEMO).toBe('force');
  });

  it('requires both GitHub OAuth values or neither', () => {
    expect(problemsOf(() => loadEnv({ ...base, GITHUB_CLIENT_ID: 'abc' })).join('\n')).toMatch(/GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET/);
    expect(loadEnv({ ...base, GITHUB_CLIENT_ID: 'abc', GITHUB_CLIENT_SECRET: 'def' }).env.GITHUB_CLIENT_ID).toBe('abc');
  });

  it('resolves PGLITE_DIR against the server root and rejects ":memory:"', () => {
    expect(loadEnv({ ...base, PGLITE_DIR: 'tmp/db' }).env.PGLITE_DIR).toBe(path.join(SERVER_ROOT, 'tmp/db'));
    expect(loadEnv({ ...base, PGLITE_DIR: PGLITE_MEMORY }).env.PGLITE_DIR).toBe(PGLITE_MEMORY);
    expect(problemsOf(() => loadEnv({ ...base, PGLITE_DIR: ':memory:' })).join('\n')).toMatch(/memory:\/\//);
  });

  it('drops trailing separators from configured paths, so the PGlite lock file sits next to the directory', () => {
    expect(loadEnv({ ...base, PGLITE_DIR: '/data/pglite/' }).env.PGLITE_DIR).toBe(path.resolve('/data/pglite'));
    expect(loadEnv({ ...base, PGLITE_DIR: 'tmp/db/' }).env.PGLITE_DIR).toBe(path.join(SERVER_ROOT, 'tmp/db'));
    expect(loadEnv({ ...base, WEB_DIST_DIR: '/srv/web//' }).env.WEB_DIST_DIR).toBe(path.resolve('/srv/web'));
  });
});

describe('in-memory database in production', () => {
  it('is allowed when explicit, with a warning that data does not survive a restart', () => {
    const { env, warnings } = loadEnv({ ...PRODUCTION, DATABASE_URL: undefined, PGLITE_DIR: PGLITE_MEMORY });
    expect(env.PGLITE_DIR).toBe(PGLITE_MEMORY);
    expect(warnings.join('\n')).toMatch(/memory:\/\/ keeps the database in memory/);
    expect(loadEnv({ ...PRODUCTION, PGLITE_DIR: PGLITE_MEMORY }).warnings).toEqual([]);
    expect(loadEnv({ ...TEST_SECRETS, NODE_ENV: 'test', PGLITE_DIR: PGLITE_MEMORY }).warnings).toEqual([]);
  });
});

describe('development secrets', () => {
  it('generates secrets once, persists them with 0600 permissions and reuses them', () => {
    const dataDir = tempDir();
    const first = loadEnv({ NODE_ENV: 'development' }, { dataDir }).env;
    const file = path.join(dataDir, 'dev-secrets.json');
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const second = loadEnv({ NODE_ENV: 'development' }, { dataDir }).env;
    expect(second.QR_SECRET).toEqual(first.QR_SECRET);
    expect(second.SIGNING_KEY).toEqual(first.SIGNING_KEY);
    expect(first.SEED_DEMO).toBe('true');
    expect(first.DEMO_PASSWORD).toBe('loopin-demo');
    expect(JSON.parse(readFileSync(file, 'utf8'))).toHaveProperty('SIGNING_KEY');
  });

  it('prefers explicit values and regenerates an unreadable file with a warning', () => {
    const dataDir = tempDir();
    writeFileSync(path.join(dataDir, 'dev-secrets.json'), 'not json');
    const { env, warnings } = loadEnv({ NODE_ENV: 'development', QR_SECRET: TEST_SECRETS.QR_SECRET }, { dataDir });
    expect(Buffer.from(env.QR_SECRET).toString('base64url')).toBe(TEST_SECRETS.QR_SECRET);
    expect(env.SIGNING_KEY).toHaveLength(32);
    expect(warnings.join('\n')).toMatch(/new development secrets/);
  });

  it('never generates secrets outside development', () => {
    const dataDir = tempDir();
    problemsOf(() => loadEnv({ NODE_ENV: 'production', APP_URL: 'https://x.example', PGLITE_DIR: '/data' }, { dataDir }));
    expect(() => statSync(path.join(dataDir, 'dev-secrets.json'))).toThrow();
  });
});

describe('seedAllowed', () => {
  it('seeds in development unless disabled, and anywhere when forced', () => {
    expect(seedAllowed({ NODE_ENV: 'development', SEED_DEMO: 'true' })).toBe(true);
    expect(seedAllowed({ NODE_ENV: 'development', SEED_DEMO: 'false' })).toBe(false);
    expect(seedAllowed({ NODE_ENV: 'production', SEED_DEMO: 'true' })).toBe(false);
    expect(seedAllowed({ NODE_ENV: 'production', SEED_DEMO: 'force' })).toBe(true);
    expect(seedAllowed({ NODE_ENV: 'test', SEED_DEMO: 'false' })).toBe(false);
  });
});

describe('loadDatabaseEnv', () => {
  it('needs only database settings', () => {
    expect(loadDatabaseEnv({ NODE_ENV: 'production', DATABASE_URL: PRODUCTION.DATABASE_URL }).env.DATABASE_URL).toBe(PRODUCTION.DATABASE_URL);
    expect(problemsOf(() => loadDatabaseEnv({ NODE_ENV: 'production' })).join('\n')).toMatch(/DATABASE_URL is required/);
  });
});
