import { eq } from 'drizzle-orm';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sessions, users } from '../src/db/schema';
import { authenticate, isFreshSession, requireAuth, requireRole } from '../src/middleware/auth';
import { createErrorHandler } from '../src/middleware/error';
import { DAY_MS, MINUTE_MS } from '../src/lib/time';
import { createTestContext, createTestSession, createUser, makeAdmin, makeOrganizer, type TestContext } from './helpers';

let t: TestContext;
let app: express.Express;

beforeAll(async () => {
  t = await createTestContext();
  app = express();
  app.use(authenticate(t));
  app.get('/whoami', (req, res) => {
    res.json({ userId: req.user?.id ?? null, sessionId: req.sessionId ?? null });
  });
  app.get('/private', requireAuth, (req, res) => {
    res.json({ fresh: isFreshSession(req) });
  });
  app.get('/organizer', requireRole('organizer'), (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/admin', requireRole('admin'), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(createErrorHandler());
});
afterAll(() => t.close());

async function sessionRow(id: string) {
  const [row] = await t.db.select().from(sessions).where(eq(sessions.id, id));
  return row!;
}

async function setSession(id: string, values: Partial<typeof sessions.$inferInsert>) {
  await t.db.update(sessions).set(values).where(eq(sessions.id, id));
}

describe('authenticate', () => {
  it('treats requests without a valid bearer token as anonymous', async () => {
    for (const header of [undefined, 'Bearer abc', 'Basic dXNlcjpwYXNz', `Bearer lp_${'x'.repeat(43)}`]) {
      const req = request(app).get('/whoami');
      if (header) req.set('Authorization', header);
      expect((await req.expect(200)).body).toEqual({ userId: null, sessionId: null });
    }
    const res = await request(app).get('/private').expect(401);
    expect(res.body).toEqual({ error: { code: 'unauthorized', message: 'Please sign in to continue.' } });
  });

  it('identifies the user and session for a valid token', async () => {
    const user = await createUser(t.db);
    const { session, headers } = await createTestSession(t, user);
    expect((await request(app).get('/whoami').set(headers).expect(200)).body).toEqual({ userId: user.id, sessionId: session.id });
    expect((await request(app).get('/private').set(headers).expect(200)).body).toEqual({ fresh: true });
  });

  it('ignores expired sessions and sessions of deleted users', async () => {
    const user = await createUser(t.db);
    const expired = await createTestSession(t, user);
    await setSession(expired.session.id, { expiresAt: new Date(Date.now() - 1000) });
    expect((await request(app).get('/whoami').set(expired.headers)).body.userId).toBeNull();
    await request(app).get('/private').set(expired.headers).expect(401);

    const doomed = await createUser(t.db);
    const live = await createTestSession(t, doomed);
    await t.db.delete(users).where(eq(users.id, doomed.id));
    expect((await request(app).get('/whoami').set(live.headers)).body.userId).toBeNull();
  });

  it('slides the expiry forward when fewer than 7 days remain', async () => {
    const user = await createUser(t.db);
    const { session, headers } = await createTestSession(t, user);
    await setSession(session.id, { createdAt: new Date(Date.now() - 28 * DAY_MS), expiresAt: new Date(Date.now() + 2 * DAY_MS) });
    await request(app).get('/whoami').set(headers).expect(200);
    const renewed = await sessionRow(session.id);
    expect(Math.abs(renewed.expiresAt.getTime() - (Date.now() + t.env.SESSION_TTL_DAYS * DAY_MS))).toBeLessThan(60_000);
  });

  it('leaves the expiry alone while more than 7 days remain', async () => {
    const user = await createUser(t.db);
    const { session, headers } = await createTestSession(t, user);
    const expiresAt = new Date(Date.now() + 20 * DAY_MS);
    await setSession(session.id, { expiresAt });
    await request(app).get('/whoami').set(headers).expect(200);
    expect((await sessionRow(session.id)).expiresAt.getTime()).toBe(expiresAt.getTime());
  });

  it('never extends a session beyond 90 days after it was created', async () => {
    const user = await createUser(t.db);
    const { session, headers } = await createTestSession(t, user);
    const createdAt = new Date(Date.now() - 85 * DAY_MS);
    await setSession(session.id, { createdAt, expiresAt: new Date(Date.now() + 2 * DAY_MS) });
    await request(app).get('/whoami').set(headers).expect(200);
    expect((await sessionRow(session.id)).expiresAt.getTime()).toBe(createdAt.getTime() + 90 * DAY_MS);

    await setSession(session.id, { createdAt: new Date(Date.now() - 90 * DAY_MS - MINUTE_MS), expiresAt: new Date(Date.now() - 1) });
    expect((await request(app).get('/whoami').set(headers)).body.userId).toBeNull();
  });

  it('writes last_used_at at most every 10 minutes', async () => {
    const user = await createUser(t.db);
    const { session, headers } = await createTestSession(t, user);
    const recent = new Date(Date.now() - 5 * MINUTE_MS);
    await setSession(session.id, { lastUsedAt: recent });
    await request(app).get('/whoami').set(headers).expect(200);
    expect((await sessionRow(session.id)).lastUsedAt.getTime()).toBe(recent.getTime());

    await setSession(session.id, { lastUsedAt: new Date(Date.now() - 11 * MINUTE_MS) });
    await request(app).get('/whoami').set(headers).expect(200);
    expect(Date.now() - (await sessionRow(session.id)).lastUsedAt.getTime()).toBeLessThan(60_000);
  });

  it('reports sessions older than 10 minutes as not fresh', async () => {
    const user = await createUser(t.db);
    const { session, headers } = await createTestSession(t, user);
    await setSession(session.id, { createdAt: new Date(Date.now() - 11 * MINUTE_MS) });
    expect((await request(app).get('/private').set(headers).expect(200)).body).toEqual({ fresh: false });
  });
});

describe('requireRole', () => {
  it('lets organizers and admins in, members get 403 and anonymous users 401', async () => {
    const member = await createUser(t.db);
    const organizer = await makeOrganizer(t.db, await createUser(t.db));
    const admin = await makeAdmin(t.db, await createUser(t.db));
    const memberHeaders = (await createTestSession(t, member)).headers;
    const organizerHeaders = (await createTestSession(t, organizer)).headers;
    const adminHeaders = (await createTestSession(t, admin)).headers;

    await request(app).get('/organizer').expect(401);
    expect((await request(app).get('/organizer').set(memberHeaders).expect(403)).body.error.code).toBe('forbidden');
    await request(app).get('/organizer').set(organizerHeaders).expect(200);
    await request(app).get('/organizer').set(adminHeaders).expect(200);

    await request(app).get('/admin').set(memberHeaders).expect(403);
    await request(app).get('/admin').set(organizerHeaders).expect(403);
    await request(app).get('/admin').set(adminHeaders).expect(200);
  });
});
