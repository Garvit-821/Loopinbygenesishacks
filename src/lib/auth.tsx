import type {
  AuthResponse,
  DeleteAccountInput,
  LoginInput,
  Me,
  MeResponse,
  OAuthExchangeInput,
  ResetPasswordInput,
  SignupInput,
  UpdateProfileInput,
  UserRole,
} from '@loopin/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { apiFetch, getToken, readStoredToken, setToken, setUnauthorizedHandler, subscribeToken, TOKEN_STORAGE_KEY } from './api';
import { clearAllDrafts } from './drafts';
import { persister, queryClient } from './queryClient';
import { qk } from './queryKeys';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
export type SignedOutReason = 'signed_out' | 'session_expired' | 'account_deleted';

/** sessionStorage: a connect started while signed out, completed by PendingConnectGate after sign-in. */
export const PENDING_CONNECT_STORAGE_KEY = 'loopin.pendingConnect';
/** sessionStorage: where to go after the GitHub round trip. */
export const NEXT_STORAGE_KEY = 'loopin.next';
/** sessionStorage: set right before leaving for GitHub; OAuthCallbackPage requires it. */
export const OAUTH_PENDING_STORAGE_KEY = 'loopin.oauth.pending';

const SIGN_IN_INTENT_KEYS = [PENDING_CONNECT_STORAGE_KEY, NEXT_STORAGE_KEY, OAUTH_PENDING_STORAGE_KEY] as const;
const SIGN_OUT_TIMEOUT_MS = 8_000;

const ROLE_RANK: Record<UserRole, number> = { member: 0, organizer: 1, admin: 2 };

/** True when the user's role is at least `role` (admin ⊇ organizer ⊇ member). */
export function hasRole(user: Pick<Me, 'role'> | null | undefined, role: UserRole): boolean {
  return user ? ROLE_RANK[user.role] >= ROLE_RANK[role] : false;
}

export interface ResetClientStateOptions {
  /**
   * For sign-ins from a signed-out state: keep what the visitor started before signing in (a pending connect,
   * where to continue). Everything tied to a previous identity is still removed.
   */
  keepSignInIntent?: boolean;
}

/**
 * Forget everything this device holds for the current identity: session token, query cache (memory and the
 * persisted copy), connection drafts, and — unless kept — sign-in intent. Runs on every identity change and when
 * the server reports the session gone.
 */
export function resetClientState(options: ResetClientStateOptions = {}): void {
  // Token first, so nothing refetches with it while the cache is being emptied.
  setToken(null);
  queryClient.clear();
  void persister.removeClient();
  clearAllDrafts();
  if (!options.keepSignInIntent) {
    for (const key of SIGN_IN_INTENT_KEYS) {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // Storage blocked: nothing could have been stored either.
      }
    }
  }
}

export interface AuthContextValue {
  /** 'unauthenticated' without a token · 'loading' while the account loads · 'authenticated' once it is known (also offline, from the device cache). */
  status: AuthStatus;
  /** The signed-in account (null unless authenticated). */
  user: Me | null;
  /** While 'loading': why loading the account failed (server down, …). Signed-out sessions never land here. */
  bootError: unknown;
  /** Why the last session on this page ended; null while signed in. */
  signedOutReason: SignedOutReason | null;
  signIn(input: LoginInput): Promise<AuthResponse>;
  signUp(input: SignupInput): Promise<AuthResponse>;
  /** Exchange the one-time code from /auth/callback#code=… */
  completeOAuth(code: string): Promise<AuthResponse>;
  /** Set a new password from a reset link; signs in (all other sessions end). */
  resetPassword(input: ResetPasswordInput): Promise<AuthResponse>;
  /** Ends the session on the server when reachable; always signs out on this device. */
  signOut(): Promise<void>;
  /** Ends every session; rejects (and stays signed in) if the server can't be reached. */
  signOutEverywhere(): Promise<void>;
  /** DELETE /me; rejects with the API error (fields.confirmHandle / fields.password) for the dialog. */
  deleteAccount(input: DeleteAccountInput): Promise<void>;
  setUser(user: Me): void;
  /** Reload the account (e.g. after a role change). */
  refresh(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function fetchMe({ signal }: { signal: AbortSignal }): Promise<Me> {
  return apiFetch<MeResponse>('/auth/me', { signal }).then((response) => response.user);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const token = useSyncExternalStore(subscribeToken, getToken, () => null);
  const [signedOutReason, setSignedOutReason] = useState<SignedOutReason | null>(null);
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe, enabled: token !== null, meta: { persist: true } });

  useEffect(() => {
    setUnauthorizedHandler(() => {
      resetClientState();
      setSignedOutReason('session_expired');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Another tab signed in or out: start over from a fresh page so nothing from the other identity lingers here.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if ((event.key === TOKEN_STORAGE_KEY || event.key === null) && readStoredToken() !== getToken()) window.location.reload();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const actions = useMemo(() => {
    const adopt = (result: AuthResponse): AuthResponse => {
      resetClientState({ keepSignInIntent: true });
      setToken(result.token);
      queryClient.setQueryData(qk.me, result.user);
      setSignedOutReason(null);
      return result;
    };
    const end = (reason: SignedOutReason) => {
      resetClientState();
      setSignedOutReason(reason);
    };
    const post = (path: string, body: unknown) => apiFetch<AuthResponse>(path, { method: 'POST', body, auth: false });

    return {
      signIn: async (input: LoginInput) => adopt(await post('/auth/login', input)),
      signUp: async (input: SignupInput) => adopt(await post('/auth/signup', input)),
      completeOAuth: async (code: string) => adopt(await post('/auth/github/exchange', { code } satisfies OAuthExchangeInput)),
      resetPassword: async (input: ResetPasswordInput) => adopt(await post('/auth/reset', input)),
      signOut: async () => {
        if (getToken()) {
          try {
            await apiFetch<void>('/auth/logout', { method: 'POST', timeoutMs: SIGN_OUT_TIMEOUT_MS });
          } catch {
            // Signing out on this device must work even when the server can't be reached.
          }
        }
        end('signed_out');
      },
      signOutEverywhere: async () => {
        await apiFetch<void>('/auth/logout-all', { method: 'POST' });
        end('signed_out');
      },
      deleteAccount: async (input: DeleteAccountInput) => {
        await apiFetch<void>('/me', { method: 'DELETE', body: input });
        end('account_deleted');
      },
      setUser: (user: Me) => {
        queryClient.setQueryData(qk.me, user);
      },
      refresh: async () => {
        await queryClient.refetchQueries({ queryKey: qk.me, exact: true });
      },
    };
  }, []);

  const user = token !== null ? (me.data ?? null) : null;
  const status: AuthStatus = token === null ? 'unauthenticated' : user ? 'authenticated' : 'loading';
  const bootError = status === 'loading' && me.isError ? me.error : null;

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, bootError, signedOutReason, ...actions }),
    [status, user, bootError, signedOutReason, actions],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

/** The signed-in account, for screens behind RequireAuth (throws anywhere else). */
export function useMe(): Me {
  const { user } = useAuth();
  if (!user) throw new Error('useMe() needs a signed-in user; use it under RequireAuth.');
  return user;
}

/** PATCH /me (send dirty fields only). Updates the account and refreshes the passport views of the old and new handle. */
export function useUpdateMe() {
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiFetch<MeResponse>('/me', { method: 'PATCH', body: input }).then((response) => response.user),
    onSuccess: (user) => {
      const previous = queryClient.getQueryData<Me>(qk.me);
      queryClient.setQueryData(qk.me, user);
      void queryClient.invalidateQueries({ queryKey: qk.myProfile });
      void queryClient.invalidateQueries({ queryKey: qk.profile(user.handle) });
      if (previous && previous.handle !== user.handle) void queryClient.invalidateQueries({ queryKey: qk.profile(previous.handle) });
    },
  });
}
