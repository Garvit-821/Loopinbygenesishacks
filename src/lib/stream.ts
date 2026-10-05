import { isApiErrorBody, type StreamEvent } from '@loopin/shared';
import { useSyncExternalStore } from 'react';
import { API_BASE, getToken, reportUnauthorized, subscribeToken } from './api';

/**
 * The live event stream (GET /api/stream, server-sent events over fetch so the bearer token stays in a header).
 * One shared connection for the whole app, started by LiveEventsBridge via startStream(). Consumers listen with
 * onStreamEvent() and show the connection state with useStreamStatus().
 *
 * There is no replay: every `ready` (first connect and each reconnect) is the cue to refetch what may have been
 * missed while disconnected.
 */

export type StreamStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
/** The backoff resets only after a connection has stayed up this long past `ready`, so a server that keeps closing right away can't cause a reconnect storm. */
const STABLE_CONNECTION_MS = 10_000;
/** Close the connection after the page has been hidden this long; it reconnects (and catches up) when visible. */
const HIDDEN_DISCONNECT_MS = 5 * 60_000;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface SseParser {
  /** Feed decoded text in whatever chunks the network delivers. */
  push(chunk: string): void;
}

/**
 * Minimal SSE parser: lines end at `\n` (a trailing `\r` is stripped), `data:` lines accumulate and a blank line
 * dispatches them joined with `\n`. Comments (heartbeats) and the `retry:`, `id:` and `event:` fields are ignored.
 */
export function createSseParser(onData: (data: string) => void): SseParser {
  let buffer = '';
  let dataLines: string[] = [];

  const processLine = (rawLine: string) => {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '') {
      if (dataLines.length > 0) {
        const data = dataLines.join('\n');
        dataLines = [];
        onData(data);
      }
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    if (field !== 'data') return;
    const value = colon === -1 ? '' : line.slice(colon + 1);
    dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
  };

  return {
    push(chunk) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(processLine);
    },
  };
}

const EVENT_TYPES: ReadonlySet<string> = new Set<StreamEvent['type']>(['ready', 'notification', 'announcement', 'announcement_deleted', 'badge_rotated']);

/** One `data:` payload → a StreamEvent, or null for malformed JSON and unknown event types (ignored). */
export function parseStreamEvent(data: string): StreamEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (value === null || typeof value !== 'object') return null;
  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && EVENT_TYPES.has(type) ? (value as StreamEvent) : null;
}

// ---------------------------------------------------------------------------
// Listeners and status
// ---------------------------------------------------------------------------

type StreamListener = (event: StreamEvent) => void;

const eventListeners = new Set<StreamListener>();
const statusListeners = new Set<() => void>();
let status: StreamStatus = 'offline';

/** Subscribe to every stream event (including `ready`). Returns the unsubscribe function. */
export function onStreamEvent(listener: StreamListener): () => void {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

export function getStreamStatus(): StreamStatus {
  return status;
}

function subscribeStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/** 'connecting' (first attempt) · 'live' (ready received) · 'reconnecting' (lost; retrying) · 'offline' (no network, signed out or not started). */
export function useStreamStatus(): StreamStatus {
  return useSyncExternalStore(subscribeStatus, getStreamStatus, () => 'offline');
}

function setStatus(next: StreamStatus): void {
  if (next === status) return;
  status = next;
  statusListeners.forEach((listener) => listener());
}

function dispatch(event: StreamEvent): void {
  for (const listener of [...eventListeners]) {
    try {
      listener(event);
    } catch (error) {
      // A broken listener must not starve the others; still surface it like any uncaught error.
      if (typeof reportError === 'function') reportError(error);
      else console.error(error);
    }
  }
}

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

let consumers = 0;
let connection: AbortController | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
let pausedWhileHidden = false;
let attempt = 0;
let everLive = false;
/** The server rejected this token as signed out; never retry with it. */
let rejectedToken: string | null = null;
let unsubscribeToken: (() => void) | null = null;

function clearRetry(): void {
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
}

function closeConnection(): void {
  connection?.abort();
  connection = null;
  clearRetry();
}

function scheduleRetry(): void {
  clearRetry();
  if (consumers === 0) return;
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }
  const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempt);
  attempt += 1;
  setStatus('reconnecting');
  // Full jitter: spread reconnects out so a server restart isn't hit by every client at once.
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void connect();
  }, Math.random() * ceiling);
}

async function connect(): Promise<void> {
  clearRetry();
  if (consumers === 0) return;
  const token = getToken();
  if (!token || token === rejectedToken || !navigator.onLine) {
    setStatus('offline');
    return;
  }
  if (pausedWhileHidden) {
    setStatus('reconnecting');
    return;
  }

  connection?.abort();
  const controller = new AbortController();
  connection = controller;
  setStatus(everLive ? 'reconnecting' : 'connecting');
  let readyAt = 0;

  try {
    const response = await fetch(`${API_BASE}/stream`, {
      headers: { Accept: 'text/event-stream', Authorization: `Bearer ${token}` },
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
    });
    if (response.status === 401) {
      const body: unknown = await response.json().catch(() => null);
      if (isApiErrorBody(body) && body.error.code === 'unauthorized') {
        rejectedToken = token;
        setStatus('offline');
        reportUnauthorized(token);
        return;
      }
    }
    if (!response.ok || !response.body) throw new Error(`Stream request failed with status ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser((data) => {
      const event = parseStreamEvent(data);
      if (!event) return;
      if (event.type === 'ready') {
        readyAt = Date.now();
        everLive = true;
        setStatus('live');
      }
      dispatch(event);
    });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.push(decoder.decode(value, { stream: true }));
    }
    parser.push(decoder.decode());
  } catch {
    // Network failure, server restart or our own abort: decided below.
  } finally {
    if (connection === controller) connection = null;
  }

  // Aborted on purpose (stopped, restarted for a new token, offline or paused while hidden).
  if (controller.signal.aborted) return;
  if (readyAt > 0 && Date.now() - readyAt >= STABLE_CONNECTION_MS) attempt = 0;
  scheduleRetry();
}

function reconnectNow(): void {
  attempt = 0;
  void connect();
}

function handleOnline(): void {
  reconnectNow();
}

function handleOffline(): void {
  closeConnection();
  setStatus('offline');
}

function handleVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    if (hiddenTimer === null) {
      hiddenTimer = setTimeout(() => {
        hiddenTimer = null;
        pausedWhileHidden = true;
        closeConnection();
        setStatus('reconnecting');
      }, HIDDEN_DISCONNECT_MS);
    }
    return;
  }
  if (hiddenTimer !== null) clearTimeout(hiddenTimer);
  hiddenTimer = null;
  const wasPaused = pausedWhileHidden;
  pausedWhileHidden = false;
  // Back in view: don't wait for a pending backoff timer.
  if (wasPaused || connection === null) reconnectNow();
}

function handleTokenChange(): void {
  closeConnection();
  everLive = false;
  reconnectNow();
}

/**
 * Start the shared connection (reference-counted, StrictMode-safe). Returns a function that releases it; the
 * connection closes when the last user releases it. It follows the session token: signing in/out restarts it.
 */
export function startStream(): () => void {
  consumers += 1;
  if (consumers === 1) {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    unsubscribeToken = subscribeToken(handleTokenChange);
    everLive = false;
    pausedWhileHidden = false;
    reconnectNow();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    consumers -= 1;
    if (consumers > 0) return;
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    unsubscribeToken?.();
    unsubscribeToken = null;
    if (hiddenTimer !== null) clearTimeout(hiddenTimer);
    hiddenTimer = null;
    closeConnection();
    setStatus('offline');
  };
}
