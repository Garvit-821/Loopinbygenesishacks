/**
 * Screenshot harness for the web app.
 *
 *   npx tsx scripts/ui-snap/index.ts --route /passport [--route /live …] [--auth] [--theme light|dark|both]
 *     [--viewport mobile|desktop|both] [--out <dir>] [--wait-for <selector>] [--live <baseUrl>] [--full-page]
 *
 * Starts Vite (root vite.config.ts, mode "snap") on a free port, opens Playwright Chromium, seeds localStorage
 * (theme; a session token with --auth), answers every /api/** request from scripts/ui-snap/fixtures/*.ts
 * (or proxies /api to --live), and prints the path of every PNG it writes.
 */
import { mkdir } from 'node:fs/promises';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium, type Browser, type BrowserContext, type Page, type Route } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';
import { loadFixtures, runHandler, type FixtureRouter } from './fixture-router';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURES_DIR = fileURLToPath(new URL('./fixtures/', import.meta.url));

/** Must match the keys the app reads (src/lib/theme.tsx and the auth module). */
const THEME_STORAGE_KEY = 'loopin.theme';
const AUTH_TOKEN_STORAGE_KEY = 'loopin.token';
const SNAP_TOKEN = 'lp_ui_snap_fixture_session_token';

const VIEWPORTS = {
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
} as const;

type ViewportName = keyof typeof VIEWPORTS;
type ThemeName = 'light' | 'dark';

const USAGE = `Usage: npx tsx scripts/ui-snap/index.ts --route <path> [--route <path> …] [options]

  --route <path>         App path to capture (repeatable), e.g. /passport or "/dev/ui?open=dialog"
  --auth                 Store a session token so the app boots signed in (fixture user: @gpdev, admin)
  --theme <t>            light | dark | both (default both)
  --viewport <v>         mobile (390×844 @2x) | desktop (1280×800) | both (default both)
  --out <dir>            Output directory (default ${join(tmpdir(), 'loopin-ui-snap')})
  --wait-for <selector>  Wait for this selector to be visible before capturing
  --live <baseUrl>       Proxy /api to a running server instead of using fixtures
  --full-page            Capture the whole scrollable page instead of the viewport
`;

function fail(message: string): never {
  console.error(`ui-snap: ${message}\n\n${USAGE}`);
  process.exit(2);
}

function parseOptions() {
  const { values } = parseArgs({
    options: {
      route: { type: 'string', multiple: true },
      auth: { type: 'boolean', default: false },
      theme: { type: 'string', default: 'both' },
      viewport: { type: 'string', default: 'both' },
      out: { type: 'string' },
      'wait-for': { type: 'string' },
      live: { type: 'string' },
      'full-page': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  });
  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }
  const routes = values.route ?? [];
  if (routes.length === 0) fail('at least one --route is required');
  for (const route of routes) if (!route.startsWith('/')) fail(`--route must start with "/" (got "${route}")`);

  const themes: ThemeName[] =
    values.theme === 'both' ? ['light', 'dark'] : values.theme === 'light' || values.theme === 'dark' ? [values.theme] : fail(`invalid --theme "${values.theme}"`);
  const viewports: ViewportName[] =
    values.viewport === 'both'
      ? ['mobile', 'desktop']
      : values.viewport === 'mobile' || values.viewport === 'desktop'
        ? [values.viewport]
        : fail(`invalid --viewport "${values.viewport}"`);

  let live: string | null = null;
  if (values.live) {
    try {
      live = new URL(values.live).origin;
    } catch {
      fail(`--live must be an absolute URL (got "${values.live}")`);
    }
  }

  return {
    routes,
    auth: values.auth,
    themes,
    viewports,
    outDir: resolve(values.out ?? join(tmpdir(), 'loopin-ui-snap')),
    waitFor: values['wait-for'] ?? null,
    live,
    fullPage: values['full-page'],
  };
}

async function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createNetServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      probe.close(() => resolvePort(port));
    });
  });
}

function slugify(route: string): string {
  const slug = route
    .replace(/^\/+/, '')
    .replace(/[?&=#]+/g, '_')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return slug || 'home';
}

/** Answers /api/** from fixtures (mode "fixtures"). Unknown endpoints get a 404 envelope and are reported. */
function fixtureRoute(router: FixtureRouter, misses: Set<string>) {
  return async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const match = router.resolve(method, url.pathname);
    if (!match) {
      misses.add(`${method} ${url.pathname}`);
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'not_found', message: `No fixture for ${method} ${url.pathname}` } }),
      });
      return;
    }
    let body: unknown;
    const raw = request.postData();
    if (raw) {
      try {
        body = JSON.parse(raw);
      } catch {
        body = undefined;
      }
    }
    try {
      const result = await runHandler(match.route.handler, {
        url,
        method,
        body,
        params: match.params,
        authed: Boolean(request.headers()['authorization']),
      });
      const hasBody = result.body !== undefined || result.json !== undefined;
      await route.fulfill({
        status: result.status ?? (hasBody ? 200 : 204),
        headers: {
          ...(result.json !== undefined && result.body === undefined ? { 'content-type': 'application/json; charset=utf-8' } : {}),
          ...result.headers,
        },
        body: result.body ?? (result.json !== undefined ? JSON.stringify(result.json) : undefined),
      });
    } catch (error) {
      console.error(`ui-snap: fixture ${match.route.key} (${match.route.source}) threw:`, error);
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'internal', message: 'Fixture handler threw' } }),
      });
    }
  };
}

/** Wait until the page has stopped loading things (and survived any Vite dependency-optimisation reload). */
async function settle(page: Page, loads: { count: number }): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = loads.count;
    await page.waitForLoadState('load');
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.waitForTimeout(350);
    if (loads.count === before) return;
  }
}

/** Load the app once so Vite finishes discovering and pre-bundling dependencies before any capture. */
async function warmUp(browser: Browser, baseUrl: string, route: string): Promise<void> {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const origin = new URL(baseUrl).origin;
    await context.route((url) => url.origin === origin && url.pathname.startsWith('/api/'), (request) =>
      request.fulfill({ status: 404, contentType: 'application/json', body: '{"error":{"code":"not_found","message":"warm-up"}}' }),
    );
    await context.route((url) => url.origin !== origin, (blocked) => blocked.abort());
    const page = await context.newPage();
    const loads = { count: 0 };
    page.on('load', () => {
      loads.count += 1;
    });
    await page.goto(new URL(route, baseUrl).href, { waitUntil: 'load', timeout: 120_000 });
    await settle(page, loads);
  } finally {
    await context.close();
  }
}

async function capture(
  browser: Browser,
  options: ReturnType<typeof parseOptions>,
  baseUrl: string,
  router: FixtureRouter | null,
  route: string,
  viewport: ViewportName,
  theme: ThemeName,
): Promise<{ file: string; problems: string[] }> {
  const problems: string[] = [];
  const misses = new Set<string>();
  const context: BrowserContext = await browser.newContext({
    ...VIEWPORTS[viewport],
    colorScheme: theme,
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    serviceWorkers: 'block',
  });
  try {
    await context.addInitScript(
      ({ themeKey, theme: initialTheme, tokenKey, token }) => {
        try {
          window.localStorage.setItem(themeKey, initialTheme);
          if (token) window.localStorage.setItem(tokenKey, token);
        } catch {
          // Storage unavailable: the app falls back to defaults.
        }
      },
      { themeKey: THEME_STORAGE_KEY, theme, tokenKey: AUTH_TOKEN_STORAGE_KEY, token: options.auth ? SNAP_TOKEN : null },
    );

    const origin = new URL(baseUrl).origin;
    if (router) {
      await context.route((url) => url.origin === origin && url.pathname.startsWith('/api/'), fixtureRoute(router, misses));
      // Keep captures deterministic and offline: external images (e.g. GitHub avatars) fail → initials.
      await context.route((url) => url.origin !== origin, (blocked) => blocked.abort());
    }

    const page = await context.newPage();
    const loads = { count: 0 };
    page.on('load', () => {
      loads.count += 1;
    });
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      // External requests are blocked on purpose in fixture mode (avatars fall back to initials); not a problem.
      const source = message.location().url;
      if (router && message.text().startsWith('Failed to load resource') && source && !source.startsWith(origin)) return;
      problems.push(`console error: ${message.text()}`);
    });

    await page.goto(new URL(route, baseUrl).href, { waitUntil: 'load', timeout: 60_000 });
    await settle(page, loads);
    if (options.waitFor) await page.waitForSelector(options.waitFor, { state: 'visible', timeout: 15_000 });

    const file = join(options.outDir, `${slugify(route)}__${viewport}-${theme}.png`);
    await page.screenshot({ path: file, fullPage: options.fullPage, animations: 'disabled', caret: 'hide' });
    for (const miss of misses) problems.push(`no fixture: ${miss}`);
    return { file, problems };
  } finally {
    await context.close();
  }
}

async function main(): Promise<void> {
  const options = parseOptions();
  await mkdir(options.outDir, { recursive: true });

  const router = options.live ? null : await loadFixtures(FIXTURES_DIR);
  if (router) console.log(`ui-snap: ${router.size} fixture handlers from ${router.files.join(', ')}`);

  const port = await freePort();
  let server: ViteDevServer | null = null;
  let browser: Browser | null = null;
  let failures = 0;

  const shutdown = async () => {
    await browser?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
  };
  const onSignal = () => {
    void shutdown().finally(() => process.exit(130));
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    server = await createServer({
      root: ROOT,
      configFile: join(ROOT, 'vite.config.ts'),
      mode: 'snap',
      // Own dependency cache, so a concurrently running dev server can't swap optimized deps underneath us.
      cacheDir: join(ROOT, 'node_modules/.vite/ui-snap'),
      logLevel: 'warn',
      clearScreen: false,
      server: {
        host: '127.0.0.1',
        port,
        strictPort: true,
        // HMR stays on: if Vite re-optimizes dependencies it must be able to tell the page to reload.
        watch: null,
        ...(options.live ? { proxy: { '/api': { target: options.live, changeOrigin: true, ws: false } } } : {}),
      },
    });
    await server.listen();
    const baseUrl = `http://127.0.0.1:${port}`;
    browser = await chromium.launch();
    await warmUp(browser, baseUrl, options.routes[0]);

    for (const route of options.routes) {
      for (const viewport of options.viewports) {
        for (const theme of options.themes) {
          try {
            const { file, problems } = await capture(browser, options, baseUrl, router, route, viewport, theme);
            console.log(file);
            for (const problem of problems) console.warn(`  ⚠ ${problem}`);
          } catch (error) {
            failures += 1;
            console.error(`ui-snap: failed ${route} (${viewport}, ${theme}):`, error instanceof Error ? error.message : error);
          }
        }
      }
    }
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    await shutdown();
  }
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error('ui-snap:', error);
  process.exit(1);
});
