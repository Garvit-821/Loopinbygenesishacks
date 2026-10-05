import type { StreamEvent } from '@loopin/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setToken, setUnauthorizedHandler } from './api';
import { createSseParser, getStreamStatus, onStreamEvent, parseStreamEvent, startStream } from './stream';

function collect() {
  const received: string[] = [];
  const parser = createSseParser((data) => received.push(data));
  return { parser, received };
}

describe('createSseParser', () => {
  it('dispatches an event on the blank line after its data', () => {
    const { parser, received } = collect();
    parser.push('data: {"type":"ready"}\n');
    expect(received).toEqual([]);
    parser.push('\n');
    expect(received).toEqual(['{"type":"ready"}']);
  });

  it('reassembles events split across chunks, even inside a line', () => {
    const { parser, received } = collect();
    for (const chunk of ['da', 'ta: {"type":"announce', 'ment_deleted","id":"a1"}', '\n', '\ndata: {"type":"badge_rotated"}\n\n']) {
      parser.push(chunk);
    }
    expect(received).toEqual(['{"type":"announcement_deleted","id":"a1"}', '{"type":"badge_rotated"}']);
  });

  it('accepts CRLF line endings, including a CR and LF split between chunks', () => {
    const { parser, received } = collect();
    parser.push('data: {"type":"ready"}\r');
    parser.push('\n\r\n');
    parser.push('data: second\r\n\r\n');
    expect(received).toEqual(['{"type":"ready"}', 'second']);
  });

  it('ignores comments and the retry, id and event fields', () => {
    const { parser, received } = collect();
    parser.push(': ping\n\nretry: 5000\n\nid: 7\nevent: message\ndata: payload\n\n: ping\n\n');
    expect(received).toEqual(['payload']);
  });

  it('joins multiple data lines with a newline and strips only one leading space', () => {
    const { parser, received } = collect();
    parser.push('data: first\ndata:second\ndata:  third\n\n');
    expect(received).toEqual(['first\nsecond\n third']);
  });
});

describe('parseStreamEvent', () => {
  it('parses known event types', () => {
    expect(parseStreamEvent('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(parseStreamEvent('{"type":"announcement_deleted","id":"a1"}')).toEqual({ type: 'announcement_deleted', id: 'a1' });
  });

  it('ignores malformed JSON and unknown or missing types', () => {
    expect(parseStreamEvent('{"type":')).toBeNull();
    expect(parseStreamEvent('"ready"')).toBeNull();
    expect(parseStreamEvent('{"type":"future_event"}')).toBeNull();
    expect(parseStreamEvent('{"kind":"ready"}')).toBeNull();
    expect(parseStreamEvent('null')).toBeNull();
  });
});

describe('startStream', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setUnauthorizedHandler(null);
    setToken(null);
  });

  function streamResponse(chunks: string[]): Response {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
        // Stays open, like a live stream.
      },
    });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
  }

  it('goes live on ready and delivers events to listeners', async () => {
    setToken('lp_token');
    const fetchMock = vi.fn().mockResolvedValue(streamResponse(['retry: 5000\n\ndata: {"type":"ready"}\n\n: ping\n\ndata: {"type":"badge_rotated"}\n\n']));
    vi.stubGlobal('fetch', fetchMock);
    const events: StreamEvent[] = [];
    const unsubscribe = onStreamEvent((event) => events.push(event));

    const stop = startStream();
    await vi.waitFor(() => expect(events).toEqual([{ type: 'ready' }, { type: 'badge_rotated' }]));
    expect(getStreamStatus()).toBe('live');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/stream$/);
    expect(init.headers).toMatchObject({ Accept: 'text/event-stream', Authorization: 'Bearer lp_token' });

    stop();
    unsubscribe();
    expect(getStreamStatus()).toBe('offline');
  });

  it("stops and reports the session gone on 401 'unauthorized'", async () => {
    setToken('lp_dead');
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'Sign in to continue.' } }), { status: 401 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const stop = startStream();
    await vi.waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
    expect(getStreamStatus()).toBe('offline');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stop();
  });

  it('stays offline without a session', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const stop = startStream();
    expect(getStreamStatus()).toBe('offline');
    expect(fetchMock).not.toHaveBeenCalled();
    stop();
  });
});
