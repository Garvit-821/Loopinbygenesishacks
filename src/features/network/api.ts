import type { ConnectionDetail, ConnectionList, ConnectionResponse, ConnectionSummary } from '@loopin/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { findCachedEvent } from '@/features/events/api';
import { apiFetch } from '@/lib/api';
import { isRetryableError } from '@/lib/api-error';
import { clearDraft, flushDrafts, getDraft, saveDraft, type ConnectionPatch } from '@/lib/drafts';
import { qk } from '@/lib/queryKeys';

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

/** `connection` with a (drafted or optimistic) patch applied. An unknown event id keeps the current event until the server answers. */
function applyPatch(queryClient: QueryClient, connection: ConnectionSummary, patch: ConnectionPatch | undefined): ConnectionSummary {
  if (!patch) return connection;
  const next = { ...connection };
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.tags !== undefined) next.tags = patch.tags;
  if (patch.eventId !== undefined) {
    if (patch.eventId === null) next.event = null;
    else if (patch.eventId !== connection.event?.id) next.event = findCachedEvent(queryClient, patch.eventId) ?? connection.event;
  }
  return next;
}

/** Server data with this device's unsent edits on top, so a refetch never shows older notes than the user typed. */
function withDraft(queryClient: QueryClient, connection: ConnectionSummary): ConnectionSummary {
  return applyPatch(queryClient, connection, getDraft(connection.id)?.patch);
}

function updateCachedConnection(queryClient: QueryClient, id: string, update: (connection: ConnectionSummary) => ConnectionSummary): void {
  queryClient.setQueryData<ConnectionList>(qk.connections, (list) =>
    list ? { connections: list.connections.map((connection) => (connection.id === id ? update(connection) : connection)) } : list,
  );
  queryClient.setQueryData<ConnectionDetail>(qk.connection(id), (detail) =>
    detail ? { ...detail, connection: update(detail.connection) } : detail,
  );
}

function findCachedConnection(queryClient: QueryClient, id: string): ConnectionSummary | null {
  return (
    queryClient.getQueryData<ConnectionDetail>(qk.connection(id))?.connection ??
    queryClient.getQueryData<ConnectionList>(qk.connections)?.connections.find((connection) => connection.id === id) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** All my connections, newest first (data: ConnectionList), with unsent edits applied. Persisted for offline use. */
export function useConnections() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.connections,
    queryFn: async ({ signal }) => {
      const list = await apiFetch<ConnectionList>('/connections', { signal });
      return { connections: list.connections.map((connection) => withDraft(queryClient, connection)) };
    },
    meta: { persist: true },
  });
}

/** One connection from the (persisted) list — available offline and while the detail loads. */
export function useConnectionSummary(id: string): ConnectionSummary | undefined {
  const { data } = useConnections();
  return data?.connections.find((connection) => connection.id === id);
}

/** Connection detail with the peer's passport (data: ConnectionDetail), with unsent edits applied. */
export function useConnection(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: qk.connection(id),
    queryFn: async ({ signal }) => {
      const detail = await apiFetch<ConnectionDetail>(`/connections/${encodeURIComponent(id)}`, { signal });
      return { ...detail, connection: withDraft(queryClient, detail.connection) };
    },
  });
}

// ---------------------------------------------------------------------------
// Draft-safe updates (single request in flight per connection)
// ---------------------------------------------------------------------------

const inFlight = new Map<string, Promise<ConnectionSummary | null>>();
const queued = new Map<string, Promise<ConnectionSummary | null>>();

/**
 * PATCH the connection's current draft. At most one request per connection is on the wire: calls made meanwhile
 * share a single follow-up that sends the merged draft afterwards. Resolves null when there was nothing to send.
 * Network failures keep the draft (flushed later); a 4xx drops it and resyncs the caches with the server.
 */
export function sendConnectionDraft(queryClient: QueryClient, id: string): Promise<ConnectionSummary | null> {
  const running = inFlight.get(id);
  if (running) {
    let next = queued.get(id);
    if (!next) {
      next = running
        .then(
          () => undefined,
          () => undefined,
        )
        .then(() => {
          queued.delete(id);
          return sendConnectionDraft(queryClient, id);
        });
      queued.set(id, next);
    }
    return next;
  }

  const draft = getDraft(id);
  if (!draft) return Promise.resolve(null);

  const request = (async () => {
    try {
      const { connection } = await apiFetch<ConnectionResponse>(`/connections/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: draft.patch,
      });
      clearDraft(id, draft.rev);
      // Edits made while this request was in flight stay visible until their own request lands.
      updateCachedConnection(queryClient, id, () => withDraft(queryClient, connection));
      return connection;
    } catch (error) {
      if (!isRetryableError(error)) {
        clearDraft(id, draft.rev);
        void queryClient.invalidateQueries({ queryKey: qk.connections });
      }
      throw error;
    } finally {
      inFlight.delete(id);
    }
  })();
  inFlight.set(id, request);
  return request;
}

/** Save a change to my notes/tags/"met at" for a connection: draft first, optimistic caches, then the PATCH. */
export async function updateConnection(queryClient: QueryClient, id: string, patch: ConnectionPatch): Promise<ConnectionSummary> {
  saveDraft(id, patch);
  updateCachedConnection(queryClient, id, (connection) => applyPatch(queryClient, connection, patch));
  const saved = await sendConnectionDraft(queryClient, id);
  const current = saved ?? findCachedConnection(queryClient, id);
  if (!current) throw new Error('That connection is no longer available.');
  return current;
}

export interface UpdateConnectionVariables {
  id: string;
  patch: ConnectionPatch;
}

/**
 * Mutation for notes/tags/"met at": `mutate({ id, patch })`. Writes a device draft before the PATCH, updates the
 * list and detail caches optimistically, keeps a single request in flight per connection, and clears the draft
 * on success. When it fails with a retryable error (`isRetryableError(error)`), the edit is safe on the device and
 * syncs later — show "Saved on this device — will sync".
 */
export function useUpdateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateConnectionVariables) => updateConnection(queryClient, id, patch),
  });
}

/** AppShell: send drafts left over from earlier (offline edits, closed tabs) on mount and whenever the device comes back online. */
export function useFlushConnectionDrafts(): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const flush = () => {
      void flushDrafts((id) => sendConnectionDraft(queryClient, id));
    };
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [queryClient]);
}
