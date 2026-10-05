import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loginInput, markNotificationsReadInput } from '@loopin/shared';
import { credentials, events, users } from '../src/db/schema';
import { conflict, HttpError } from '../src/lib/errors';
import { createHttpLogger, createLogger } from '../src/lib/logger';
import { idParam, parseBody, parseQuery } from '../src/lib/validate';
import { createErrorHandler, toHttpError } from '../src/middleware/error';
import { createEvent, createTestContext, createUser, type TestContext } from './helpers';

let t: TestContext;
/** A throwaway app with probe routes, sharing the real error handler. */
let probe: express.Express;

beforeAll(async () => {
  t = await createTestContext();
  probe = express();
  probe.use(express.json({ limit: '100kb' }));
  probe.post('/body', (req, res) => {
    res.json(parseBody(loginInput, req));
  });
  probe.post('/optional-body', (req, res) => {
    res.json(parseBody(markNotificationsReadInput, req));
  });
  probe.get('/query', (req, res) => {
    res.json(parseQuery(z.object({ q: z.string().max(5).default('') }), req));
  });
  probe.get('/items/:id', (req, res) => {
    res.json({ id: idParam(req) });
  });
  probe.get('/http-error', () => {
    throw conflict('That award was already granted', { placement: 'Already granted' });
  });
  probe.get('/zod-error', () => {
    z.object({ name: z.string() }).parse({});
  });
  probe.get('/boom', () => {
    throw new Error('secret internals: password=hunter2');
  });
  probe.get('/async-boom', async () => {
    await Promise.resolve();
    throw new Error('async internals');
  });
  probe.post('/duplicate-email', async () => {
    await createUser(t.db, { email: 'taken@example.com' });
    await createUser(t.db, { email: 'taken@example.com' });
  });
  probe.post('/missing-event', async () => {
    const user = await createUser(t.db);
    await t.db.insert(credentials).values({
      type: 'stamp',
      userId: user.id,
      eventId: randomUUID(),
      role: 'hacker',
      payload: '{}',
      signature: 'x',
      keyId: 'k',
      issuedAt: new Date(),
    });
  });
  probe.get('/bad-uuid-in-sql', async () => {
    await t.db.select().from(users).where(eq(users.id, 'not-a-uuid'));
  });
  probe.post('/check-violation', async () => {
    await createUser(t.db, { email: 'Shouty@Example.com' });
  });
  probe.get('/fails-mid-response', (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('partial');
    throw new Error('failed after the headers were sent');
  });
  probe.post('/deadlock', () => {
    throw Object.assign(new Error('wrapped'), { cause: Object.assign(new Error('deadlock detected'), { code: '40P01' }) });
  });
  probe.use(createErrorHandler());
});
afterAll(() => t.close());

describe('real app error envelopes', () => {
  it('answers malformed JSON with 400 bad_request', async () => {
    const res = await request(t.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'bad_request', message: "That request body isn't valid JSON." } });
  });

  it('answers bodies over 100 kB with 413 payload_too_large', async () => {
    const res = await request(t.app)
      .post('/api/auth/signup')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ name: 'x'.repeat(101 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('payload_too_large');
  });

  it('answers unknown API routes with a JSON 404', async () => {
    for (const path of ['/api/definitely-not-here', '/api', '/api/events/x/y/z']) {
      const res = await request(t.app).get(path).set('Accept', 'text/html');
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.error.code).toBe('not_found');
    }
  });
});

describe('validation helpers', () => {
  it('parseBody reports field errors and treats a missing body as {}', async () => {
    const res = await request(probe).post('/body').send({ email: 'nope', password: '' }).expect(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['email', 'password']);
    expect((await request(probe).post('/body').expect(400)).body.error.fields).toHaveProperty('email');
    expect((await request(probe).post('/optional-body').expect(200)).body).toEqual({});
    expect((await request(probe).post('/body').send({ email: ' Ada@Example.COM ', password: 'x' }).expect(200)).body.email).toBe('ada@example.com');
  });

  it('parseQuery validates and returns the parsed query', async () => {
    expect((await request(probe).get('/query?q=abc').expect(200)).body).toEqual({ q: 'abc' });
    expect((await request(probe).get('/query').expect(200)).body).toEqual({ q: '' });
    expect((await request(probe).get('/query?q=toolong').expect(400)).body.error.fields).toHaveProperty('q');
    expect((await request(probe).get('/query?q=a&q=b').expect(400)).body.error.code).toBe('validation_error');
  });

  it('idParam turns malformed ids into 404 and lowercases valid ones', async () => {
    expect((await request(probe).get('/items/123').expect(404)).body.error.code).toBe('not_found');
    expect((await request(probe).get("/items/1'; drop table users;--").expect(404)).body.error.code).toBe('not_found');
    const id = randomUUID();
    expect((await request(probe).get(`/items/${id.toUpperCase()}`).expect(200)).body).toEqual({ id });
  });
});

describe('error mapping', () => {
  it('passes HttpErrors through with their fields', async () => {
    const res = await request(probe).get('/http-error').expect(409);
    expect(res.body).toEqual({ error: { code: 'conflict', message: 'That award was already granted', fields: { placement: 'Already granted' } } });
  });

  it('maps zod errors to validation_error', async () => {
    expect((await request(probe).get('/zod-error').expect(400)).body.error).toMatchObject({ code: 'validation_error', fields: { name: expect.any(String) } });
  });

  it('hides internal errors behind a generic 500', async () => {
    for (const path of ['/boom', '/async-boom']) {
      const res = await request(probe).get(path).expect(500);
      expect(res.body).toEqual({ error: { code: 'internal', message: 'Something went wrong on our side. Please try again.' } });
      expect(JSON.stringify(res.body)).not.toContain('internals');
    }
  });

  it('maps Postgres errors', async () => {
    const duplicate = await request(probe).post('/duplicate-email').expect(409);
    expect(duplicate.body.error).toMatchObject({ code: 'conflict', fields: { email: expect.any(String) } });
    expect(JSON.stringify(duplicate.body)).not.toContain('taken@example.com');
    expect((await request(probe).post('/missing-event').expect(400)).body.error.code).toBe('bad_request');
    expect((await request(probe).get('/bad-uuid-in-sql').expect(400)).body.error.code).toBe('bad_request');
    expect((await request(probe).post('/check-violation').expect(400)).body.error.code).toBe('validation_error');
    expect((await request(probe).post('/deadlock').expect(503)).body.error).toEqual({ code: 'unavailable', message: 'Please try again' });
  });

  it('drops the connection when a handler fails after the response started', async () => {
    await expect(request(probe).get('/fails-mid-response')).rejects.toThrow();
  });

  it('maps http-errors style statuses', () => {
    expect(toHttpError(Object.assign(new Error('x'), { status: 400, expose: true })).code).toBe('bad_request');
    expect(toHttpError(Object.assign(new Error('x'), { statusCode: 404 })).code).toBe('not_found');
    expect(toHttpError(Object.assign(new Error('x'), { type: 'entity.too.large', status: 413 })).code).toBe('payload_too_large');
    expect(toHttpError(Object.assign(new Error('x'), { status: 502 })).code).toBe('internal');
    expect(toHttpError('a string')).toBeInstanceOf(HttpError);
  });

  it('keeps credentials.event_id RESTRICT: events with credentials cannot be deleted', async () => {
    const user = await createUser(t.db);
    const event = await createEvent(t.db);
    await t.db.insert(credentials).values({ type: 'stamp', userId: user.id, eventId: event.id, role: 'hacker', payload: '{}', signature: 's', keyId: 'k', issuedAt: new Date() });
    const failure = await t.db
      .delete(events)
      .where(eq(events.id, event.id))
      .then(() => null, (error: unknown) => error);
    // PostgreSQL 18 (PGlite) reports restrict_violation 23001; older servers report 23503.
    expect(['23001', '23503']).toContain((failure as { cause?: { code?: string } }).cause?.code);
    expect(['conflict', 'bad_request']).toContain(toHttpError(failure).code);
  });
});

describe('request logs', () => {
  it('describe a failed query by its Postgres code only; tokens, cookies, query strings and SQL parameters never appear', async () => {
    const lines: string[] = [];
    const logger = createLogger({ NODE_ENV: 'test', LOG_LEVEL: 'info' }, { write: (line: string) => void lines.push(line) });
    const app = express();
    app.use(createHttpLogger(logger));
    app.get('/broken-query', async () => {
      await t.db.execute(sql`select * from table_that_does_not_exist where secret = ${'param-value-hunter2'}`);
    });
    app.use(createErrorHandler());

    const res = await request(app)
      .get('/broken-query?token=query-secret-123')
      .set('Authorization', 'Bearer lp_header-secret-token')
      .set('Cookie', 'session=cookie-secret')
      .expect(500);
    expect(res.body).toEqual({ error: { code: 'internal', message: 'Something went wrong on our side. Please try again.' } });

    const entries = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries.find((entry) => (entry.req as { url?: string } | undefined)?.url === '/broken-query')).toMatchObject({
      level: 50,
      res: { statusCode: 500 },
      err: { type: 'DrizzleQueryError', pgCode: '42P01' },
    });
    const output = lines.join('');
    for (const secret of ['param-value-hunter2', 'table_that_does_not_exist', 'query-secret-123', 'header-secret-token', 'cookie-secret']) {
      expect(output).not.toContain(secret);
    }
  });
});
