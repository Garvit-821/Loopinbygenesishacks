import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import type { StreamEvent } from '@loopin/shared';
import { MAX_STREAMS_PER_USER, createBus } from '../src/lib/bus';
import { HttpError } from '../src/lib/errors';
import { createCapturingMailer, createMailer } from '../src/lib/mailer';

const ready: StreamEvent = { type: 'ready' };
const rotated: StreamEvent = { type: 'badge_rotated' };

function stream() {
  return { send: vi.fn<(event: StreamEvent) => void>(), close: vi.fn<() => void>() };
}

describe('bus', () => {
  it('delivers to one user or to everyone', () => {
    const bus = createBus({ maxStreams: 10 });
    const a = stream();
    const b = stream();
    bus.subscribe('user-a', 's1', a.send, a.close);
    bus.subscribe('user-b', 's2', b.send, b.close);
    bus.publishToUser('user-a', rotated);
    expect(a.send).toHaveBeenCalledWith(rotated);
    expect(b.send).not.toHaveBeenCalled();
    bus.broadcast(ready);
    expect(a.send).toHaveBeenLastCalledWith(ready);
    expect(b.send).toHaveBeenLastCalledWith(ready);
    expect(bus.counts()).toEqual({ streams: 2, users: 2 });
  });

  it('closes the oldest stream when a user opens too many', () => {
    const bus = createBus({ maxStreams: 100 });
    const streams = Array.from({ length: MAX_STREAMS_PER_USER + 1 }, () => stream());
    streams.forEach((s, i) => bus.subscribe('user', `session-${i}`, s.send, s.close));
    expect(streams[0]!.close).toHaveBeenCalledTimes(1);
    bus.publishToUser('user', rotated);
    expect(streams[0]!.send).not.toHaveBeenCalled();
    expect(streams.slice(1).every((s) => s.send.mock.calls.length === 1)).toBe(true);
    expect(bus.counts().streams).toBe(MAX_STREAMS_PER_USER);
  });

  it('answers 503 when the server-wide cap is reached', () => {
    const bus = createBus({ maxStreams: 2 });
    bus.subscribe('a', 's', vi.fn(), vi.fn());
    bus.subscribe('b', 's', vi.fn(), vi.fn());
    try {
      bus.subscribe('c', 's', vi.fn(), vi.fn());
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      expect((error as HttpError).status).toBe(503);
      expect((error as HttpError).code).toBe('unavailable');
    }
  });

  it('disconnects one session, all but one session, or everything', () => {
    const bus = createBus({ maxStreams: 100 });
    const phone = stream();
    const laptop = stream();
    const tablet = stream();
    bus.subscribe('user', 'phone', phone.send, phone.close);
    bus.subscribe('user', 'laptop', laptop.send, laptop.close);
    bus.subscribe('user', 'tablet', tablet.send, tablet.close);

    expect(bus.disconnect({ userId: 'user', sessionId: 'phone' })).toBe(1);
    expect(phone.close).toHaveBeenCalledTimes(1);
    expect(bus.disconnect({ userId: 'user', exceptSessionId: 'laptop' })).toBe(1);
    expect(tablet.close).toHaveBeenCalledTimes(1);
    expect(laptop.close).not.toHaveBeenCalled();
    expect(bus.disconnect({ userId: 'nobody' })).toBe(0);

    bus.closeAll();
    expect(laptop.close).toHaveBeenCalledTimes(1);
    expect(bus.counts()).toEqual({ streams: 0, users: 0 });
  });

  it('unsubscribes idempotently without calling close, and drops streams whose send throws', () => {
    const onError = vi.fn();
    const bus = createBus({ maxStreams: 10, onError });
    const quiet = stream();
    const unsubscribe = bus.subscribe('user', 's1', quiet.send, quiet.close);
    unsubscribe();
    unsubscribe();
    expect(quiet.close).not.toHaveBeenCalled();
    expect(bus.counts().streams).toBe(0);

    const broken = stream();
    broken.send.mockImplementation(() => {
      throw new Error('socket gone');
    });
    bus.subscribe('user', 's2', broken.send, broken.close);
    bus.publishToUser('user', rotated);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(broken.close).toHaveBeenCalledTimes(1);
    expect(bus.counts().streams).toBe(0);
  });
});

describe('mailer', () => {
  function capturingLogger() {
    const lines: Record<string, unknown>[] = [];
    const destination = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
        callback();
      },
    });
    return { logger: pino({ level: 'debug' }, destination), lines };
  }

  it('logs messages instead of sending them in development without SMTP', async () => {
    const { logger, lines } = capturingLogger();
    const mailer = createMailer({ NODE_ENV: 'development', SMTP_URL: null, MAIL_FROM: 'Loopin <x@y>' }, logger);
    expect(mailer).toMatchObject({ kind: 'console', enabled: true });
    mailer.send({ to: 'ada@example.com', subject: 'Reset your password', text: 'http://localhost:5173/reset-password#token=lpr_x' });
    expect(lines).toHaveLength(0);
    await new Promise((resolve) => setImmediate(resolve));
    expect(JSON.stringify(lines)).toContain('reset-password#token=lpr_x');
  });

  it('is disabled outside development without SMTP', () => {
    const { logger } = capturingLogger();
    for (const NODE_ENV of ['production', 'test'] as const) {
      const mailer = createMailer({ NODE_ENV, SMTP_URL: null, MAIL_FROM: 'Loopin <x@y>' }, logger);
      expect(mailer).toMatchObject({ kind: 'disabled', enabled: false });
      expect(() => mailer.send({ to: 'a@b.c', subject: 's', text: 't' })).not.toThrow();
    }
  });

  it('uses SMTP when configured and never throws from send()', () => {
    const { logger } = capturingLogger();
    const mailer = createMailer({ NODE_ENV: 'production', SMTP_URL: 'smtp://127.0.0.1:1', MAIL_FROM: 'Loopin <x@y>' }, logger);
    expect(mailer).toMatchObject({ kind: 'smtp', enabled: true });
    expect(() => mailer.send({ to: 'a@b.c', subject: 's', text: 't' })).not.toThrow();
    mailer.close();
  });

  it('captures messages synchronously in tests', () => {
    const mailer = createCapturingMailer();
    mailer.send({ to: 'a@b.c', subject: 'Hello', text: 'Body' });
    expect(mailer.outbox).toEqual([{ to: 'a@b.c', subject: 'Hello', text: 'Body' }]);
    mailer.clear();
    expect(mailer.outbox).toHaveLength(0);
  });
});
