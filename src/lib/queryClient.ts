import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { QueryClient, type Query } from '@tanstack/react-query';
import { removeOldestQuery, type PersistQueryClientOptions } from '@tanstack/react-query-persist-client';
import { getToken } from './api';
import { isApiError } from './api-error';
import { qk } from './queryKeys';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /** Keep this query's data on the device (offline boot). Only for the keys listed in queryKeys.ts. */
      persist?: boolean;
    };
  }
}

/**
 * Bump by hand whenever the shape of a persisted response changes, so devices discard caches written by older
 * builds instead of rendering them.
 */
export const CACHE_SCHEMA_VERSION = '1';
export const CACHE_STORAGE_KEY = 'loopin.cache';
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Never retry a 4xx (the same request fails the same way); retry anything else at most twice. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

/** Only successful queries that opted in with `meta: { persist: true }` are written to the device. */
export function shouldPersistQuery(query: Pick<Query, 'meta' | 'state'>): boolean {
  return query.meta?.persist === true && query.state.status === 'success';
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: CACHE_MAX_AGE_MS, retry: shouldRetry },
    // Mutations run (and fail fast) offline instead of pausing; features keep drafts for what must survive.
    mutations: { networkMode: 'always', retry: false },
  },
});

// The account (and ['me', …] children) is often written with setQueryData right after a cache reset, before any
// useQuery has attached its meta; the default keeps it persisted for offline boot either way.
queryClient.setQueryDefaults(qk.me, { meta: { persist: true } });

function deviceStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const persister = createSyncStoragePersister({
  storage: deviceStorage(),
  key: CACHE_STORAGE_KEY,
  throttleTime: 1000,
  // When storage is full, drop the oldest queries until the rest fits.
  retry: removeOldestQuery,
});

export const persistOptions = {
  persister,
  maxAge: CACHE_MAX_AGE_MS,
  buster: CACHE_SCHEMA_VERSION,
  dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
} satisfies Omit<PersistQueryClientOptions, 'queryClient'>;

// Booting without a session: nothing an earlier session cached on this device may be shown to whoever uses it now.
if (!getToken()) void persister.removeClient();
