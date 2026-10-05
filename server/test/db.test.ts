/**
 * The database handle routes use (`ctx.db`): drizzle's whole builder API type-checks and works on it directly and
 * on the `tx` that `ctx.db.transaction()` hands out (this file is part of `npm run typecheck`).
 */
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Executor, Tx } from '../src/context';
import { events, users } from '../src/db/schema';
import { retryOnTransactionConflict } from '../src/lib/db-errors';
import { conflict } from '../src/lib/errors';
import { createEvent, createTestContext, createUser, type TestContext } from './helpers';

let t: TestContext;
beforeAll(async () => {
  t = await createTestContext();
});
afterAll(() => t.close());

describe('ctx.db', () => {
  it('supports returning(fields) and onConflictDoNothing() directly', async () => {
    const values = { email: 'db-direct@example.com', handle: 'db_direct', name: 'Direct' };
    const [row] = await t.db.insert(users).values(values).returning({ id: users.id, handle: users.handle });
    expect(row?.handle).toBe('db_direct');
    expect(await t.db.insert(users).values(values).onConflictDoNothing().returning({ id: users.id })).toEqual([]);
  });

  it('hands transactions a Tx that supports returning(fields), and commits what it returns', async () => {
    const event = await createEvent(t.db);
    const updated = await t.db.transaction(async (tx: Tx) => {
      const [row] = await tx
        .update(events)
        .set({ isActive: true })
        .where(eq(events.id, event.id))
        .returning({ id: events.id, isActive: events.isActive });
      return row;
    });
    expect(updated).toEqual({ id: event.id, isActive: true });
    const [stored] = await t.db.select({ isActive: events.isActive }).from(events).where(eq(events.id, event.id));
    expect(stored?.isActive).toBe(true);
  });

  it('rolls a transaction back when it throws, and retries only deadlocks/serialization failures', async () => {
    const user = await createUser(t.db);
    let attempts = 0;
    await expect(
      retryOnTransactionConflict(() =>
        t.db.transaction(async (tx) => {
          attempts += 1;
          await tx.update(users).set({ name: 'Renamed' }).where(eq(users.id, user.id));
          throw conflict('Not this time');
        }),
      ),
    ).rejects.toMatchObject({ code: 'conflict', status: 409 });
    expect(attempts).toBe(1);
    const [row] = await t.db.select({ name: users.name }).from(users).where(eq(users.id, user.id));
    expect(row?.name).toBe(user.name);
  });

  it('is an Executor, and so is the Tx of a transaction', async () => {
    const countUsers = async (ex: Executor) => (await ex.select({ n: sql<number>`count(*)::int` }).from(users))[0]?.n ?? -1;
    const outside = await countUsers(t.db);
    expect(outside).toBeGreaterThan(0);
    expect(await t.db.transaction((tx) => countUsers(tx))).toBe(outside);
  });
});
