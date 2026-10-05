/**
 * In-memory pub/sub for live streams (GET /api/stream). Single instance by design: there is no replay, so
 * clients refetch on every `ready`. Each user may hold MAX_STREAMS_PER_USER streams (the oldest is closed
 * when a new one opens); the whole server holds at most `maxStreams` (env STREAM_MAX).
 */
import type { StreamEvent } from '@loopin/shared';
import { unavailable } from './errors';

export const MAX_STREAMS_PER_USER = 5;

export type StreamSend = (event: StreamEvent) => void;

export interface DisconnectTarget {
  userId: string;
  /** Only this session's streams (e.g. logout). */
  sessionId?: string;
  /** Every stream of the user except this session's (e.g. password change keeps the current device). */
  exceptSessionId?: string;
}

export interface Bus {
  /**
   * Register a stream. `send` writes one event; `close` ends the HTTP response and is called only when the bus
   * drops the stream (disconnect, closeAll, per-user limit). Returns an idempotent unsubscribe for the route's
   * own cleanup. Throws HttpError 503 `unavailable` when the server-wide cap is reached — call it before
   * flushing the response headers.
   */
  subscribe(userId: string, sessionId: string, send: StreamSend, close: () => void): () => void;
  publishToUser(userId: string, event: StreamEvent): void;
  broadcast(event: StreamEvent): void;
  /** Close matching streams; returns how many were closed. */
  disconnect(target: DisconnectTarget): number;
  /** Close every stream (graceful shutdown). */
  closeAll(): void;
  counts(): { streams: number; users: number };
}

interface Subscriber {
  userId: string;
  sessionId: string;
  send: StreamSend;
  close: () => void;
}

export interface BusOptions {
  /** Server-wide cap on concurrent streams (env STREAM_MAX). */
  maxStreams: number;
  /** Called when a send or close callback throws (the stream is dropped either way). */
  onError?: (error: unknown) => void;
}

export function createBus({ maxStreams, onError }: BusOptions): Bus {
  // Per user, in subscription order (a Set iterates in insertion order, so the first entry is the oldest).
  const byUser = new Map<string, Set<Subscriber>>();
  let total = 0;

  function remove(subscriber: Subscriber): boolean {
    const set = byUser.get(subscriber.userId);
    if (!set?.delete(subscriber)) return false;
    total--;
    if (set.size === 0) byUser.delete(subscriber.userId);
    return true;
  }

  function drop(subscriber: Subscriber): void {
    if (!remove(subscriber)) return;
    try {
      subscriber.close();
    } catch (error) {
      onError?.(error);
    }
  }

  function deliver(subscriber: Subscriber, event: StreamEvent): void {
    try {
      subscriber.send(event);
    } catch (error) {
      onError?.(error);
      drop(subscriber);
    }
  }

  return {
    subscribe(userId, sessionId, send, close) {
      if (total >= maxStreams) throw unavailable('Live updates are busy right now. Please try again in a moment.');
      let set = byUser.get(userId);
      if (!set) {
        set = new Set();
        byUser.set(userId, set);
      }
      while (set.size >= MAX_STREAMS_PER_USER) {
        const oldest = set.values().next().value;
        if (!oldest) break;
        drop(oldest);
      }
      const subscriber: Subscriber = { userId, sessionId, send, close };
      // drop() may have deleted the user's (now empty) set.
      if (!byUser.has(userId)) byUser.set(userId, set);
      set.add(subscriber);
      total++;
      return () => {
        remove(subscriber);
      };
    },

    publishToUser(userId, event) {
      const set = byUser.get(userId);
      if (!set) return;
      for (const subscriber of [...set]) deliver(subscriber, event);
    },

    broadcast(event) {
      for (const set of [...byUser.values()]) {
        for (const subscriber of [...set]) deliver(subscriber, event);
      }
    },

    disconnect({ userId, sessionId, exceptSessionId }) {
      const set = byUser.get(userId);
      if (!set) return 0;
      const matches = [...set].filter(
        (s) => (sessionId === undefined || s.sessionId === sessionId) && (exceptSessionId === undefined || s.sessionId !== exceptSessionId),
      );
      for (const subscriber of matches) drop(subscriber);
      return matches.length;
    },

    closeAll() {
      for (const set of [...byUser.values()]) {
        for (const subscriber of [...set]) drop(subscriber);
      }
    },

    counts: () => ({ streams: total, users: byUser.size }),
  };
}
