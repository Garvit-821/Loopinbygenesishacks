import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { HealthResponse } from '@loopin/shared';
import { SERVER_VERSION } from '../src/paths';
import { createTestContext, type TestContext } from './helpers';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext({ env: { CORS_ORIGINS: 'https://partner.example.com' } });
});
afterAll(() => t.close());

describe('GET /api/health', () => {
  it('reports ok with the server version', async () => {
    const res = await request(t.app).get('/api/health').expect(200);
    const body = res.body as HealthResponse;
    expect(body).toEqual({ status: 'ok', db: 'ok', version: SERVER_VERSION, time: expect.any(String) });
    expect(new Date(body.time).toISOString()).toBe(body.time);
    expect(res.headers['cache-control']).toBeUndefined();
  });

  it('reports degraded with 503 when the database is unavailable', async () => {
    const broken = await createTestContext();
    await broken.database.close();
    const res = await request(broken.app).get('/api/health').expect(503);
    expect(res.body).toMatchObject({ status: 'degraded', db: 'error' });
    await broken.close();
  });
});

describe('cross-cutting headers', () => {
  it('marks personal API responses no-store but leaves health, keys and credential verification cacheable', async () => {
    expect((await request(t.app).get('/api/anything')).headers['cache-control']).toBe('no-store');
    expect((await request(t.app).delete(`/api/credentials/${randomUUID()}`)).headers['cache-control']).toBe('no-store');
    expect((await request(t.app).get('/api/keys')).headers['cache-control']).toBeUndefined();
    expect((await request(t.app).get(`/api/credentials/${randomUUID()}`)).headers['cache-control']).toBeUndefined();
  });

  it('sends security headers', async () => {
    const res = await request(t.app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('echoes a well-formed X-Request-Id and replaces anything else', async () => {
    expect((await request(t.app).get('/api/health').set('X-Request-Id', 'req-123')).headers['x-request-id']).toBe('req-123');
    expect((await request(t.app).get('/api/health').set('X-Request-Id', 'bad id with spaces')).headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('CORS', () => {
  it('allows the web app, local/native origins and CORS_ORIGINS, without credentials', async () => {
    for (const origin of ['http://localhost:5173', 'capacitor://localhost', 'https://localhost', 'https://partner.example.com']) {
      const res = await request(t.app).get('/api/health').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    }
  });

  it('ignores other origins', async () => {
    const res = await request(t.app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers preflight requests with a 10 minute max age', async () => {
    const res = await request(t.app)
      .options('/api/connections/exchange')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-max-age']).toBe('600');
    expect(res.headers['access-control-allow-headers']).toMatch(/Authorization/);
    expect(res.headers['access-control-allow-methods']).toMatch(/PATCH/);
  });
});
