import type { ConnectionList, ConnectionSummary } from '@loopin/shared';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setToken } from '@/lib/api';
import { getDraft } from '@/lib/drafts';
import { qk } from '@/lib/queryKeys';
import { updateConnection } from './api';

function makeConnection(overrides: Partial<ConnectionSummary> = {}): ConnectionSummary {
  return {
    id: 'c1',
    peer: {
      id: 'u-rohan',
      handle: 'rohan_sys',
      name: 'Rohan Mehta',
      headline: 'Systems engineer',
      avatarUrl: null,
      openTo: [],
      location: '',
      githubUsername: null,
      linkedinUrl: null,
      websiteUrl: null,
      contact: null,
    },
    notes: '',
    tags: [],
    event: null,
    source: 'scan',
    mutual: true,
    createdAt: '2026-10-04T10:00:00.000Z',
    updatedAt: '2026-10-04T10:00:00.000Z',
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const fetchMock = vi.fn<typeof fetch>();
let queryClient: QueryClient;

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  setToken('lp_token');
  queryClient = new QueryClient();
  queryClient.setQueryData<ConnectionList>(qk.connections, { connections: [makeConnection()] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  setToken(null);
});

const cachedNotes = () => queryClient.getQueryData<ConnectionList>(qk.connections)?.connections[0].notes;

describe('updateConnection', () => {
  it('updates the cache optimistically, sends one PATCH and clears the draft on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { connection: makeConnection({ notes: 'Great demo' }) }));

    const pending = updateConnection(queryClient, 'c1', { notes: 'Great demo' });
    expect(cachedNotes()).toBe('Great demo');
    expect(getDraft('c1')?.patch).toEqual({ notes: 'Great demo' });

    await expect(pending).resolves.toMatchObject({ notes: 'Great demo' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PATCH');
    expect(getDraft('c1')).toBeNull();
  });

  it('keeps a single request in flight and sends later edits merged in one follow-up', async () => {
    const responses: ((response: Response) => void)[] = [];
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => responses.push(resolve)));

    const first = updateConnection(queryClient, 'c1', { notes: 'v1' });
    const second = updateConnection(queryClient, 'c1', { notes: 'v2' });
    const third = updateConnection(queryClient, 'c1', { tags: ['Follow up'] });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ notes: 'v1' });

    responses[0](jsonResponse(200, { connection: makeConnection({ notes: 'v1' }) }));
    await first;
    // The server's v1 answer must not hide the newer local edit.
    expect(cachedNotes()).toBe('v2');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({ notes: 'v2', tags: ['Follow up'] });
    responses[1](jsonResponse(200, { connection: makeConnection({ notes: 'v2', tags: ['Follow up'] }) }));

    await expect(second).resolves.toMatchObject({ notes: 'v2' });
    await expect(third).resolves.toMatchObject({ tags: ['Follow up'] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getDraft('c1')).toBeNull();
  });

  it('keeps the draft and the optimistic value when offline', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(updateConnection(queryClient, 'c1', { notes: 'Offline note' })).rejects.toMatchObject({ code: 'network_error' });
    expect(getDraft('c1')?.patch.notes).toBe('Offline note');
    expect(cachedNotes()).toBe('Offline note');
  });

  it('drops the draft and resyncs when the server rejects the change', async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { error: { code: 'not_found', message: 'Not found' } }));
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    await expect(updateConnection(queryClient, 'c1', { notes: 'x' })).rejects.toMatchObject({ code: 'not_found' });
    expect(getDraft('c1')).toBeNull();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.connections });
  });
});
