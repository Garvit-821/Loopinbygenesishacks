/**
 * Server configuration (SPEC §3.1), parsed and validated with zod. Every variable is documented in
 * server/.env.example. Production refuses to start without its secrets, public URL and database; development
 * generates secrets once and keeps them in DATA_DIR/dev-secrets.json so codes and signatures survive restarts.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isIP } from 'node:net';
import path from 'node:path';
import { z } from 'zod';
import { base64UrlDecode, base64UrlEncode, LIMITS } from '@loopin/shared';
import { DATA_DIR, DEFAULT_PGLITE_DIR, DEFAULT_WEB_DIST_DIR, SERVER_ROOT, resolveServerPath } from './paths';

export const NODE_ENVS = ['development', 'production', 'test'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** PGLITE_DIR value for a throwaway in-memory database. */
export const PGLITE_MEMORY = 'memory://';

/** Express `trust proxy` value: false, a hop count, true (outside production only) or IPs/CIDRs/names. */
export type TrustProxy = boolean | number | string[];

export type SeedDemoMode = 'true' | 'false' | 'force';
export type DatabaseSsl = 'true' | 'false' | 'no-verify';

/** Rate limits (SPEC §3.6). Each key is also the env var that overrides it. */
export const RATE_LIMIT_DEFAULTS = {
  /** Requests per minute per signed-in user (all of /api). */
  RATE_LIMIT_API_USER: 600,
  /** Requests per minute per anonymous IP (all of /api). */
  RATE_LIMIT_API_IP: 3000,
  /** Failed logins per 15 minutes per IP + email. */
  RATE_LIMIT_LOGIN: 10,
  /** Login attempts per 15 minutes per IP. */
  RATE_LIMIT_LOGIN_IP: 300,
  /** Signups per 15 minutes per IP. */
  RATE_LIMIT_SIGNUP_IP: 200,
  /** Password-reset emails requested per 15 minutes per IP + email. */
  RATE_LIMIT_FORGOT: 5,
  /** Password-reset submissions per 15 minutes per IP (the body has no email). */
  RATE_LIMIT_RESET: 5,
  /** GitHub sign-in code exchanges per 15 minutes per IP. */
  RATE_LIMIT_OAUTH_IP: 100,
  /** Profile exchanges per minute per user. */
  RATE_LIMIT_EXCHANGE_USER: 60,
  /** Check-ins per minute per organizer. */
  RATE_LIMIT_CHECKIN_USER: 240,
  /** Badge previews per minute per IP. */
  RATE_LIMIT_PREVIEW_IP: 300,
} as const;
export type RateLimitSetting = keyof typeof RATE_LIMIT_DEFAULTS;
const RATE_LIMIT_SETTINGS = Object.keys(RATE_LIMIT_DEFAULTS) as RateLimitSetting[];

/** The subset needed to open the database (migration and admin scripts load only this). */
export interface DatabaseEnv {
  NODE_ENV: NodeEnv;
  /** postgres:// URL → node-postgres; null → embedded PGlite. */
  DATABASE_URL: string | null;
  /** Explicit TLS mode for DATABASE_URL (wins over sslmode in the URL); null → whatever the URL says. */
  DATABASE_SSL: DatabaseSsl | null;
  /** Absolute PGlite data directory, or PGLITE_MEMORY. Ignored when DATABASE_URL is set. */
  PGLITE_DIR: string;
  LOG_LEVEL: LogLevel;
}

export interface Env extends DatabaseEnv, Record<RateLimitSetting, number> {
  PORT: number;
  /** Public web origin (+ optional path), without a trailing slash. Links in emails/redirects start here. */
  APP_URL: string;
  /** Public API base URL without a trailing slash (GitHub OAuth callback). Defaults to APP_URL. */
  API_URL: string;
  /** Extra CORS origins exactly as configured (normalised to origins). */
  CORS_ORIGINS: string[];
  /** Complete CORS allowlist: APP_URL's origin + local/native dev origins + CORS_ORIGINS. */
  ALLOWED_ORIGINS: string[];
  /** Raw secret bytes (≥ 32) for badge-key and connect-ticket HMACs. */
  QR_SECRET: Uint8Array<ArrayBuffer>;
  /** 32-byte Ed25519 seed used to sign credentials. */
  SIGNING_KEY: Uint8Array<ArrayBuffer>;
  /** base64url raw public keys of retired signing keys (verification only). */
  SIGNING_PUBLIC_KEYS_PREVIOUS: string[];
  SESSION_TTL_DAYS: number;
  /** Lowercased emails that become admin once the address is verified. */
  ADMIN_EMAILS: string[];
  SEED_DEMO: SeedDemoMode;
  /** Password for seeded demo accounts; null when seeding is not possible. */
  DEMO_PASSWORD: string | null;
  SMTP_URL: string | null;
  MAIL_FROM: string;
  GITHUB_CLIENT_ID: string | null;
  GITHUB_CLIENT_SECRET: string | null;
  TRUST_PROXY: TrustProxy;
  SERVE_WEB: boolean;
  /** Absolute path of the web build served by the API (when it exists and SERVE_WEB is on). */
  WEB_DIST_DIR: string;
  /** Rate limiting is off under NODE_ENV=test unless this is set. */
  RATE_LIMIT_IN_TESTS: boolean;
  /** Global cap on concurrent live streams (GET /api/stream). */
  STREAM_MAX: number;
}

export interface LoadedEnv<T> {
  env: T;
  /** Problems that do not stop the server; log each once at warn level. */
  warnings: string[];
}

export interface LoadEnvOptions {
  /** Module URL used by resolveNodeEnv() when NODE_ENV is unset (defaults to this module). */
  moduleUrl?: string;
  /** Directory for development secrets (defaults to DATA_DIR). */
  dataDir?: string;
}

/** Thrown when the configuration is unusable; the message lists every problem found. */
export class EnvError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid server configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'EnvError';
  }
}

type EnvSource = Readonly<Record<string, string | undefined>>;
type RawEnv = Record<string, string | undefined>;

/**
 * NODE_ENV when it is not set explicitly: running the TypeScript sources (tsx) means development,
 * running the bundled JavaScript (dist/) means production. Vitest sets NODE_ENV=test itself.
 */
export function resolveNodeEnv(explicit: string | undefined, moduleUrl: string): NodeEnv {
  const value = explicit?.trim();
  if (value) {
    if ((NODE_ENVS as readonly string[]).includes(value)) return value as NodeEnv;
    throw new EnvError([`NODE_ENV must be one of ${NODE_ENVS.join(', ')} (got "${value}")`]);
  }
  let pathname = moduleUrl;
  try {
    pathname = new URL(moduleUrl).pathname;
  } catch {
    // Not a URL: treat it as a plain path.
  }
  return /\.[cm]?tsx?$/.test(pathname) ? 'development' : 'production';
}

/**
 * Express `trust proxy` from TRUST_PROXY: unset/false/0 → false, digits → hop count, true → true (the caller
 * rejects it in production), otherwise a comma list of IPs, CIDR ranges or loopback/linklocal/uniquelocal.
 */
export function parseTrustProxy(value: string | undefined): TrustProxy {
  const text = value?.trim() ?? '';
  const lower = text.toLowerCase();
  if (text === '' || lower === 'false' || lower === '0') return false;
  if (lower === 'true') return true;
  if (/^\d+$/.test(text)) return Number(text);
  const entries = text
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => (TRUST_PROXY_NAMES.has(entry.toLowerCase()) ? entry.toLowerCase() : entry));
  const invalid = entries.find((entry) => !isTrustProxyEntry(entry));
  if (invalid !== undefined) {
    throw new Error(`TRUST_PROXY entry "${invalid}" is not an IP address, a CIDR range, or one of loopback, linklocal, uniquelocal`);
  }
  return entries;
}

const TRUST_PROXY_NAMES = new Set(['loopback', 'linklocal', 'uniquelocal']);

function isTrustProxyEntry(entry: string): boolean {
  if (TRUST_PROXY_NAMES.has(entry)) return true;
  const [address, prefix, ...rest] = entry.split('/');
  if (rest.length > 0 || address === undefined) return false;
  const family = isIP(address);
  if (family === 0) return false;
  if (prefix === undefined) return true;
  if (!/^\d+$/.test(prefix)) return false;
  return Number(prefix) <= (family === 4 ? 32 : 128);
}

/**
 * Load server/.env into process.env when the file exists (variables already set in the environment win).
 * Returns whether a file was loaded.
 */
export function loadDotEnvFile(file: string = path.join(SERVER_ROOT, '.env')): boolean {
  if (!existsSync(file)) return false;
  process.loadEnvFile(file);
  return true;
}

/** Demo data is seeded in development (unless SEED_DEMO=false) or anywhere with SEED_DEMO=force. */
export function seedAllowed(env: Pick<Env, 'NODE_ENV' | 'SEED_DEMO'>): boolean {
  return env.SEED_DEMO === 'force' || (env.NODE_ENV === 'development' && env.SEED_DEMO !== 'false');
}

// ---------------------------------------------------------------------------
// Field schemas (input: the trimmed string, or undefined when unset/blank)
// ---------------------------------------------------------------------------

const wholeNumber = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, `must be a whole number between ${min} and ${max}`)
    .transform(Number)
    .refine((n) => n >= min && n <= max, `must be a whole number between ${min} and ${max}`);

const flag = z
  .string()
  .toLowerCase()
  .pipe(z.enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'], { error: 'must be true or false' }))
  .transform((v) => v === 'true' || v === '1' || v === 'yes' || v === 'on');

const oneOf = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .toLowerCase()
    .pipe(z.enum(values, { error: `must be one of ${values.join(', ')}` }));

const httpUrl = z
  .string()
  .refine((v) => {
    const protocol = URL.canParse(v) ? new URL(v).protocol : null;
    return protocol === 'http:' || protocol === 'https:';
  }, 'must be an http:// or https:// URL')
  .transform((v) => stripTrailingSlashes(new URL(v).href));

const databaseUrl = z.string().regex(/^postgres(ql)?:\/\//, 'must start with postgres:// or postgresql://');

const pgliteDir = z
  .string()
  .refine((v) => v !== ':memory:', 'must be memory:// for an in-memory database (":memory:" would create a folder)')
  .transform((v) => (v === PGLITE_MEMORY ? v : resolveServerPath(v)));

const smtpUrl = z.string().regex(/^smtps?:\/\//, 'must start with smtp:// or smtps://');

const originList = z.string().transform((value, ctx) => {
  const origins: string[] = [];
  for (const entry of splitList(value)) {
    const origin = toOrigin(entry);
    if (origin) origins.push(origin);
    else ctx.addIssue({ code: 'custom', message: `has an invalid origin "${entry}" (expected e.g. https://app.example.com)` });
  }
  return origins;
});

const emailList = z.string().transform((value, ctx) => {
  const emails = splitList(value).map((e) => e.toLowerCase());
  for (const email of emails) {
    if (!z.email().safeParse(email).success) ctx.addIssue({ code: 'custom', message: `has an invalid email "${email}"` });
  }
  return emails;
});

const demoPassword = z
  .string()
  .min(LIMITS.passwordMin, `must be at least ${LIMITS.passwordMin} characters`)
  .max(LIMITS.passwordMax, `must be at most ${LIMITS.passwordMax} characters`);

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function stripTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

/** `scheme://host[:port]` (URL.origin is "null" for custom schemes such as capacitor://). */
function toOrigin(value: string): string | null {
  if (!URL.canParse(value)) return null;
  const url = new URL(value);
  return url.host ? `${url.protocol}//${url.host}` : null;
}

/** base64 or base64url (padding optional) → bytes, or null when it is not valid. */
function decodeKeyMaterial(value: string): Uint8Array<ArrayBuffer> | null {
  try {
    return base64UrlDecode(value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
  } catch {
    return null;
  }
}

function normalizeSource(source: EnvSource): RawEnv {
  const raw: RawEnv = {};
  for (const [key, value] of Object.entries(source)) {
    const trimmed = value?.trim();
    raw[key] = trimmed ? trimmed : undefined;
  }
  return raw;
}

/** Validate one variable; records a problem and returns undefined when it is invalid. */
function read<T>(raw: RawEnv, name: string, schema: z.ZodType<T, string>, problems: string[]): T | undefined {
  const value = raw[name];
  if (value === undefined) return undefined;
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  problems.push(`${name} ${result.error.issues[0]?.message ?? 'is invalid'}`);
  return undefined;
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

const ALWAYS_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
];
const DEFAULT_APP_URL = 'http://localhost:5173';
const DEFAULT_DEMO_PASSWORD = 'loopin-demo';
const DEV_SECRETS_FILE = 'dev-secrets.json';

function parseDatabaseEnv(raw: RawEnv, nodeEnv: NodeEnv, problems: string[]): DatabaseEnv {
  const databaseUrlValue = read(raw, 'DATABASE_URL', databaseUrl, problems) ?? null;
  const pgliteDirValue = read(raw, 'PGLITE_DIR', pgliteDir, problems);
  if (nodeEnv === 'production' && raw.DATABASE_URL === undefined && raw.PGLITE_DIR === undefined) {
    problems.push(
      'DATABASE_URL is required in production (or set PGLITE_DIR to a persistent volume to use the embedded database)',
    );
  }
  return {
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrlValue,
    DATABASE_SSL: read(raw, 'DATABASE_SSL', oneOf(['true', 'false', 'no-verify']), problems) ?? null,
    PGLITE_DIR: pgliteDirValue ?? DEFAULT_PGLITE_DIR,
    LOG_LEVEL: read(raw, 'LOG_LEVEL', oneOf(LOG_LEVELS), problems) ?? (nodeEnv === 'test' ? 'warn' : 'info'),
  };
}

/** Only the database settings (for scripts such as migrate and grant-role, which need no secrets). */
export function loadDatabaseEnv(source: EnvSource = process.env, options: LoadEnvOptions = {}): LoadedEnv<DatabaseEnv> {
  const raw = normalizeSource(source);
  const nodeEnv = resolveNodeEnv(raw.NODE_ENV, options.moduleUrl ?? import.meta.url);
  const problems: string[] = [];
  const env = parseDatabaseEnv(raw, nodeEnv, problems);
  if (problems.length > 0) throw new EnvError(problems);
  return { env, warnings: [] };
}

/** The full server configuration. Throws EnvError listing every problem. */
export function loadEnv(source: EnvSource = process.env, options: LoadEnvOptions = {}): LoadedEnv<Env> {
  const raw = normalizeSource(source);
  const nodeEnv = resolveNodeEnv(raw.NODE_ENV, options.moduleUrl ?? import.meta.url);
  const isProduction = nodeEnv === 'production';
  const problems: string[] = [];
  const warnings: string[] = [];

  const database = parseDatabaseEnv(raw, nodeEnv, problems);
  if (isProduction && database.DATABASE_URL === null && database.PGLITE_DIR === PGLITE_MEMORY) {
    warnings.push(
      'PGLITE_DIR=memory:// keeps the database in memory: every account and record is lost when the server restarts. Use DATABASE_URL or a PGLITE_DIR on a persistent volume.',
    );
  }

  // Public URLs
  if (isProduction && raw.APP_URL === undefined) {
    problems.push('APP_URL is required in production (the public https:// address of the web app)');
  }
  const appUrl = read(raw, 'APP_URL', httpUrl, problems) ?? DEFAULT_APP_URL;
  if (isProduction && raw.APP_URL !== undefined && !appUrl.startsWith('https://')) {
    warnings.push('APP_URL is not https:// — cameras, rotating codes and secure sessions need HTTPS in production.');
  }
  const apiUrl = read(raw, 'API_URL', httpUrl, problems) ?? appUrl;
  const corsOrigins = read(raw, 'CORS_ORIGINS', originList, problems) ?? [];
  const appOrigin = toOrigin(appUrl) ?? appUrl;
  const allowedOrigins = [...new Set([appOrigin, ...ALWAYS_ALLOWED_ORIGINS, ...corsOrigins])];

  // Secrets
  const secrets = resolveSecrets(raw, nodeEnv, options.dataDir ?? DATA_DIR, problems, warnings);
  const previousKeys: string[] = [];
  for (const entry of splitList(raw.SIGNING_PUBLIC_KEYS_PREVIOUS ?? '')) {
    const bytes = decodeKeyMaterial(entry);
    if (bytes?.length === 32) previousKeys.push(base64UrlEncode(bytes));
    else problems.push(`SIGNING_PUBLIC_KEYS_PREVIOUS has an entry that is not a base64url 32-byte Ed25519 public key ("${entry}")`);
  }

  // Accounts & seeding
  const seedDemo = read(raw, 'SEED_DEMO', oneOf(['true', 'false', 'force']), problems) ?? (nodeEnv === 'development' ? 'true' : 'false');
  const demoPasswordValue = read(raw, 'DEMO_PASSWORD', demoPassword, problems);
  if (seedDemo === 'force' && nodeEnv !== 'development' && raw.DEMO_PASSWORD === undefined) {
    problems.push('DEMO_PASSWORD is required when SEED_DEMO=force outside development');
  }
  if (seedDemo === 'true' && nodeEnv === 'production') {
    warnings.push('SEED_DEMO=true is ignored in production; use SEED_DEMO=force (with DEMO_PASSWORD) to seed demo data deliberately.');
  }

  // Integrations
  const githubClientId = raw.GITHUB_CLIENT_ID ?? null;
  const githubClientSecret = raw.GITHUB_CLIENT_SECRET ?? null;
  if ((githubClientId === null) !== (githubClientSecret === null)) {
    problems.push('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET must be set together (or both left empty)');
  }

  // Networking
  let trustProxy: TrustProxy = false;
  try {
    trustProxy = parseTrustProxy(raw.TRUST_PROXY);
  } catch (error) {
    problems.push((error as Error).message);
  }
  if (isProduction && trustProxy === true) {
    problems.push('TRUST_PROXY=true is not allowed in production; set the number of proxy hops (e.g. TRUST_PROXY=1) or the proxy IP ranges');
  }
  if (isProduction && trustProxy === false) {
    warnings.push(
      "TRUST_PROXY is not set: behind a proxy every client shares the proxy's IP for rate limiting. On Railway, Render or Fly set TRUST_PROXY=1.",
    );
  }

  const rateLimits = {} as Record<RateLimitSetting, number>;
  for (const name of RATE_LIMIT_SETTINGS) {
    rateLimits[name] = read(raw, name, wholeNumber(1, 1_000_000), problems) ?? RATE_LIMIT_DEFAULTS[name];
  }

  const port = read(raw, 'PORT', wholeNumber(0, 65_535), problems) ?? 8080;
  const sessionTtlDays = read(raw, 'SESSION_TTL_DAYS', wholeNumber(1, 90), problems) ?? 30;
  const adminEmails = read(raw, 'ADMIN_EMAILS', emailList, problems) ?? [];
  const smtp = read(raw, 'SMTP_URL', smtpUrl, problems) ?? null;
  const serveWeb = read(raw, 'SERVE_WEB', flag, problems) ?? true;
  const rateLimitInTests = read(raw, 'RATE_LIMIT_IN_TESTS', flag, problems) ?? false;
  const streamMax = read(raw, 'STREAM_MAX', wholeNumber(1, 1_000_000), problems) ?? 5000;

  if (problems.length > 0 || !secrets) throw new EnvError(problems);

  const env: Env = {
    ...database,
    PORT: port,
    APP_URL: appUrl,
    API_URL: apiUrl,
    CORS_ORIGINS: corsOrigins,
    ALLOWED_ORIGINS: allowedOrigins,
    QR_SECRET: secrets.qrSecret,
    SIGNING_KEY: secrets.signingKey,
    SIGNING_PUBLIC_KEYS_PREVIOUS: [...new Set(previousKeys)],
    SESSION_TTL_DAYS: sessionTtlDays,
    ADMIN_EMAILS: adminEmails,
    SEED_DEMO: seedDemo,
    DEMO_PASSWORD: demoPasswordValue ?? (nodeEnv === 'development' ? DEFAULT_DEMO_PASSWORD : null),
    SMTP_URL: smtp,
    MAIL_FROM: raw.MAIL_FROM ?? `Loopin <no-reply@${new URL(appUrl).hostname}>`,
    GITHUB_CLIENT_ID: githubClientId,
    GITHUB_CLIENT_SECRET: githubClientSecret,
    TRUST_PROXY: trustProxy,
    SERVE_WEB: serveWeb,
    WEB_DIST_DIR: raw.WEB_DIST_DIR ? resolveServerPath(raw.WEB_DIST_DIR) : DEFAULT_WEB_DIST_DIR,
    RATE_LIMIT_IN_TESTS: rateLimitInTests,
    STREAM_MAX: streamMax,
    ...rateLimits,
  };
  return { env, warnings };
}

interface Secrets {
  qrSecret: Uint8Array<ArrayBuffer>;
  signingKey: Uint8Array<ArrayBuffer>;
}

function resolveSecrets(raw: RawEnv, nodeEnv: NodeEnv, dataDir: string, problems: string[], warnings: string[]): Secrets | null {
  let qrSecret: Uint8Array<ArrayBuffer> | null = null;
  let signingKey: Uint8Array<ArrayBuffer> | null = null;

  if (raw.QR_SECRET !== undefined) {
    qrSecret = decodeKeyMaterial(raw.QR_SECRET);
    if (!qrSecret || qrSecret.length < 32) {
      problems.push('QR_SECRET must be at least 32 random bytes encoded as base64 or base64url (generate one with `npm run keys:generate`)');
      qrSecret = null;
    }
  }
  if (raw.SIGNING_KEY !== undefined) {
    signingKey = decodeKeyMaterial(raw.SIGNING_KEY);
    if (!signingKey || signingKey.length !== 32) {
      problems.push('SIGNING_KEY must be a 32-byte Ed25519 seed encoded as base64 or base64url (generate one with `npm run keys:generate`)');
      signingKey = null;
    }
  }

  const missing = raw.QR_SECRET === undefined || raw.SIGNING_KEY === undefined;
  if (missing && nodeEnv === 'development') {
    const generated = developmentSecrets(dataDir, problems, warnings);
    if (generated) {
      if (raw.QR_SECRET === undefined) qrSecret = generated.qrSecret;
      if (raw.SIGNING_KEY === undefined) signingKey = generated.signingKey;
    }
  } else if (missing) {
    const where = nodeEnv === 'production' ? 'in production' : `when NODE_ENV=${nodeEnv}`;
    if (raw.QR_SECRET === undefined) problems.push(`QR_SECRET is required ${where} (generate one with \`npm run keys:generate\`)`);
    if (raw.SIGNING_KEY === undefined) problems.push(`SIGNING_KEY is required ${where} (generate one with \`npm run keys:generate\`)`);
  }
  return qrSecret && signingKey ? { qrSecret, signingKey } : null;
}

/** Development only: reuse (or create once) random secrets in DATA_DIR/dev-secrets.json. */
function developmentSecrets(dataDir: string, problems: string[], warnings: string[]): Secrets | null {
  const file = path.join(dataDir, DEV_SECRETS_FILE);
  if (existsSync(file)) {
    const stored = readDevelopmentSecrets(file);
    if (stored) return stored;
    warnings.push(`${file} was unreadable, so new development secrets were generated; credentials signed before will no longer verify.`);
  }
  const secrets: Secrets = { qrSecret: new Uint8Array(randomBytes(32)), signingKey: new Uint8Array(randomBytes(32)) };
  try {
    mkdirSync(dataDir, { recursive: true });
    const body = { QR_SECRET: base64UrlEncode(secrets.qrSecret), SIGNING_KEY: base64UrlEncode(secrets.signingKey) };
    writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, { mode: 0o600 });
  } catch (error) {
    problems.push(`Could not save development secrets to ${file}: ${(error as Error).message}`);
    return null;
  }
  return secrets;
}

function readDevelopmentSecrets(file: string): Secrets | null {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { QR_SECRET?: unknown; SIGNING_KEY?: unknown };
    const qrSecret = typeof parsed.QR_SECRET === 'string' ? decodeKeyMaterial(parsed.QR_SECRET) : null;
    const signingKey = typeof parsed.SIGNING_KEY === 'string' ? decodeKeyMaterial(parsed.SIGNING_KEY) : null;
    if (qrSecret && qrSecret.length >= 32 && signingKey?.length === 32) return { qrSecret, signingKey };
  } catch {
    // Unreadable or not JSON: regenerate.
  }
  return null;
}
