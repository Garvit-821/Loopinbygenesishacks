import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './helpers';

const INDEX_HTML = '<!doctype html><html><head><title>Loopin</title></head><body><div id="root"></div></body></html>';
let dist: string;
let t: TestContext;

beforeAll(async () => {
  dist = mkdtempSync(path.join(tmpdir(), 'loopin-dist-'));
  mkdirSync(path.join(dist, 'assets'));
  writeFileSync(path.join(dist, 'index.html'), INDEX_HTML);
  writeFileSync(path.join(dist, 'assets', 'index-Abc123.js'), 'console.log("app")');
  writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *');
  t = await createTestContext({ env: { SERVE_WEB: 'true', WEB_DIST_DIR: dist, API_URL: 'https://api.loopin.example' } });
});
afterAll(async () => {
  await t.close();
  rmSync(dist, { recursive: true, force: true });
});

const html = (path: string) => request(t.app).get(path).set('Accept', 'text/html,application/xhtml+xml');

describe('static web app', () => {
  it('serves index.html for app navigations with no-cache and the web CSP', async () => {
    for (const route of ['/', '/passport', '/u/ada_lovelace?tab=awards', '/c/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd']) {
      const res = await html(route).expect(200);
      expect(res.text).toBe(INDEX_HTML);
      expect(res.headers['cache-control']).toBe('no-cache');
      const csp = res.headers['content-security-policy'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("connect-src 'self' https://api.loopin.example");
      expect(csp).toContain("worker-src 'self' blob:");
      expect(csp).not.toContain('upgrade-insecure-requests');
    }
    await request(t.app).head('/network').set('Accept', 'text/html').expect(200);
  });

  it('caches hashed assets forever and revalidates other files', async () => {
    const asset = await request(t.app).get('/assets/index-Abc123.js').expect(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    const robots = await request(t.app).get('/robots.txt').expect(200);
    expect(robots.headers['cache-control']).toBe('no-cache');
  });

  it('does not fall back for files, non-HTML requests, other methods or the API', async () => {
    await html('/missing.png').expect(404);
    await html('/assets/missing-123.js').expect(404);
    await request(t.app).get('/passport').set('Accept', 'application/json').expect(404);
    await request(t.app).get('/passport').expect(404);
    await request(t.app).post('/passport').set('Accept', 'text/html').expect(404);
    const api = await html('/api/nope').expect(404);
    expect(api.body.error.code).toBe('not_found');
  });

  it('serves nothing when SERVE_WEB is off or the build is missing', async () => {
    const off = await createTestContext({ env: { SERVE_WEB: 'false', WEB_DIST_DIR: dist } });
    await request(off.app).get('/').set('Accept', 'text/html').expect(404);
    await off.close();
    const missing = await createTestContext({ env: { SERVE_WEB: 'true', WEB_DIST_DIR: path.join(dist, 'nope') } });
    await request(missing.app).get('/').set('Accept', 'text/html').expect(404);
    await missing.close();
  });

  it('adds upgrade-insecure-requests and HSTS in production with an https APP_URL', async () => {
    const production = await createTestContext({
      env: { NODE_ENV: 'production', APP_URL: 'https://loopin.example', SERVE_WEB: 'true', WEB_DIST_DIR: dist, TRUST_PROXY: '1' },
    });
    const res = await html('/').expect(200);
    expect(res.headers['content-security-policy']).not.toContain('upgrade-insecure-requests');
    const prod = await request(production.app).get('/').set('Accept', 'text/html').expect(200);
    expect(prod.headers['content-security-policy']).toContain('upgrade-insecure-requests');
    expect(prod.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect((await request(production.app).get('/api/health')).headers['strict-transport-security']).toMatch(/max-age=\d+/);
    await production.close();
  });

  it('never sends HSTS outside production (it would pin https for localhost in the browser)', async () => {
    expect((await html('/')).headers['strict-transport-security']).toBeUndefined();
    expect((await request(t.app).get('/api/health')).headers['strict-transport-security']).toBeUndefined();
  });
});
