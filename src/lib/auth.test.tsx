import type { AuthResponse, Me } from '@loopin/shared';
import { act, render, screen, waitFor } from '@testing-library/react';
import { dehydrate, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, getToken, setToken } from './api';
import { AuthProvider, PENDING_CONNECT_STORAGE_KEY, useAuth, type AuthContextValue } from './auth';
import { getDraft, saveDraft } from './drafts';
import { CACHE_SCHEMA_VERSION, CACHE_STORAGE_KEY, persistOptions, queryClient } from './queryClient';
import { qk } from './queryKeys';

function makeMe(overrides: Partial<Me> = {}): Me {
  return {
    id: 'u-ana',
    handle: 'ana',
    name: 'Ana Kovač',
    headline: 'Rust and WASM',
    avatarUrl: null,
    bio: '',
    location: 'Bengaluru',
    githubUsername: null,
    linkedinUrl: null,
    websiteUrl: null,
    skills: [],
    openTo: [],
    role: 'member',
    createdAt: '2026-01-01T00:00:00.000Z',
    contactEmail: null,
    phone: null,
    email: 'ana@example.com',
    emailVerified: false,
    visibility: 'public',
    hasPassword: true,
    githubLinked: false,
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

let auth: AuthContextValue | null = null;

function Probe() {
  auth = useAuth();
  return (
    <p>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="name">{auth.user?.name ?? ''}</span>
    </p>
  );
}

function renderAuth() {
  return render(
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </PersistQueryClientProvider>,
  );
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  await queryClient.cancelQueries();
  queryClient.clear();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  setToken(null);
  auth = null;
});

describe('AuthProvider', () => {
  it('is unauthenticated without a token and never asks the server', () => {
    renderAuth();
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('boots offline from the persisted account and stays signed in when the refresh fails', async () => {
    const me = makeMe();
    const snapshot = new QueryClient();
    snapshot.setQueryData(qk.me, me, { updatedAt: Date.now() - 60 * 60 * 1000 });
    window.localStorage.setItem(
      CACHE_STORAGE_KEY,
      JSON.stringify({ buster: CACHE_SCHEMA_VERSION, timestamp: Date.now(), clientState: dehydrate(snapshot) }),
    );
    setToken('lp_token');
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    renderAuth();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('name')).toHaveTextContent('Ana Kovač');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/auth\/me$/);
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(getToken()).toBe('lp_token');
  });

  it('keeps loading (never signs out) when the account cannot be fetched and nothing is cached', async () => {
    setToken('lp_token');
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderAuth();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    expect(getToken()).toBe('lp_token');
  });

  it('resets all client state for the new identity on sign-in, keeping sign-in intent', async () => {
    setToken('lp_old');
    queryClient.setQueryData(qk.me, makeMe());
    queryClient.setQueryData(qk.connections, { connections: [{ id: 'c1' }] });
    saveDraft('c1', { notes: 'private note about someone' });
    window.sessionStorage.setItem(PENDING_CONNECT_STORAGE_KEY, '{"ticket":"lpt_x"}');
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    const next: AuthResponse = { token: 'lp_new', user: makeMe({ id: 'u-rohan', handle: 'rohan', name: 'Rohan Mehta' }), isNewUser: false };
    fetchMock.mockResolvedValue(jsonResponse(200, next));
    await act(async () => {
      await auth?.signIn({ email: 'rohan@example.com', password: 'correct horse' });
    });

    expect(getToken()).toBe('lp_new');
    expect(queryClient.getQueryData(qk.connections)).toBeUndefined();
    expect(queryClient.getQueryData<Me>(qk.me)?.handle).toBe('rohan');
    expect(getDraft('c1')).toBeNull();
    expect(window.sessionStorage.getItem(PENDING_CONNECT_STORAGE_KEY)).not.toBeNull();
    expect(screen.getByTestId('name')).toHaveTextContent('Rohan Mehta');
  });

  it('signs out locally even when the server is unreachable, clearing everything', async () => {
    setToken('lp_token');
    queryClient.setQueryData(qk.me, makeMe());
    saveDraft('c1', { notes: 'x' });
    window.sessionStorage.setItem(PENDING_CONNECT_STORAGE_KEY, '{"ticket":"lpt_x"}');
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await act(async () => {
      await auth?.signOut();
    });

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(auth?.signedOutReason).toBe('signed_out');
    expect(getToken()).toBeNull();
    expect(getDraft('c1')).toBeNull();
    expect(window.sessionStorage.getItem(PENDING_CONNECT_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(CACHE_STORAGE_KEY)).toBeNull();
  });

  it("signs out when any request comes back 401 'unauthorized'", async () => {
    setToken('lp_token');
    queryClient.setQueryData(qk.me, makeMe());
    renderAuth();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    fetchMock.mockResolvedValue(jsonResponse(401, { error: { code: 'unauthorized', message: 'Sign in to continue.' } }));
    await act(async () => {
      await apiFetch('/connections').catch(() => undefined);
    });

    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(auth?.signedOutReason).toBe('session_expired');
    expect(getToken()).toBeNull();
  });
});
