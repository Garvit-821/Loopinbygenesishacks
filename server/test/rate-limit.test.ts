import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authenticate, requireAuth } from '../src/middleware/auth';
import { createErrorHandler } from '../src/middleware/error';
import { getRateLimiters } from '../src/middleware/rateLimit';
import { authHeader, createTestContext, createUser, type TestContext } from './helpers';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext({
    env: {
      RATE_LIMIT_IN_TESTS: '1',
      RATE_LIMIT_API_USER: '3',
      RATE_LIMIT_API_IP: '5',
      RATE_LIMIT_LOGIN: '2',
      RATE_LIMIT_EXCHANGE_USER: '2',
    },
  });
});
afterAll(() => t.close());

describe('global API limiter', () => {
  it('limits each signed-in user separately, even from the same IP', async () => {
    const alice = await authHeader(t, await createUser(t.db));
    const bob = await authHeader(t, await createUser(t.db));
    for (let i = 0; i < 3; i++) await request(t.app).get('/api/anything').set(alice).expect(404);
    const limited = await request(t.app).get('/api/anything').set(alice).expect(429);
    expect(limited.body).toEqual({ error: { code: 'rate_limited', message: 'Too many requests — please wait a moment and try again.' } });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.headers['ratelimit-policy']).toBe('3;w=60');
    await request(t.app).get('/api/anything').set(bob).expect(404);
  });

  it('limits anonymous requests per IP, independently of signed-in users', async () => {
    for (let i = 0; i < 5; i++) await request(t.app).get('/api/anything').expect(404);
    await request(t.app).get('/api/anything').expect(429);
    const carol = await authHeader(t, await createUser(t.db));
    await request(t.app).get('/api/anything').set(carol).expect(404);
  });

  it('never limits the health check', async () => {
    for (let i = 0; i < 10; i++) await request(t.app).get('/api/health').expect(200);
  });
});

describe('route limiters', () => {
  const limits = () => getRateLimiters(t);

  it('login counts only failed attempts, per IP and email', async () => {
    const app = express();
    app.use(express.json());
    app.post('/login', ...limits().login, (req, res) => {
      res.status((req.body as { password?: string }).password === 'right' ? 200 : 401).json({});
    });
    app.use(createErrorHandler());

    const attempt = (email: string, password: string) => request(app).post('/login').send({ email, password });
    await attempt('ada@example.com', 'right').expect(200);
    await attempt('ada@example.com', 'wrong').expect(401);
    await attempt('ADA@example.com ', 'wrong').expect(401);
    expect((await attempt('ada@example.com', 'right').expect(429)).body.error.code).toBe('rate_limited');
    await attempt('grace@example.com', 'wrong').expect(401);
  });

  it('exchange is limited per user', async () => {
    const app = express();
    app.use(authenticate(t));
    app.post('/exchange', requireAuth, limits().exchange, (_req, res) => {
      res.status(201).json({});
    });
    app.use(createErrorHandler());

    const dave = await authHeader(t, await createUser(t.db));
    const erin = await authHeader(t, await createUser(t.db));
    await request(app).post('/exchange').set(dave).expect(201);
    await request(app).post('/exchange').set(dave).expect(201);
    await request(app).post('/exchange').set(dave).expect(429);
    await request(app).post('/exchange').set(erin).expect(201);
  });

  it('builds one limiter set per context', () => {
    expect(getRateLimiters(t)).toBe(getRateLimiters(t));
  });
});

describe('limits are off in tests by default', () => {
  it('never answers 429 without RATE_LIMIT_IN_TESTS', async () => {
    const relaxed = await createTestContext({ env: { RATE_LIMIT_API_IP: '1' } });
    for (let i = 0; i < 5; i++) await request(relaxed.app).get('/api/anything').expect(404);
    await relaxed.close();
  });
});
