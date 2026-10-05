import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE, apiFetch, apiUrl, getToken, setToken, setUnauthorizedHandler } from './api';
import { ApiError } from './api-error';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function envelope(code: string, message: string, fields?: Record<string, string>) {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  setToken(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  setUnauthorizedHandler(null);
  setToken(null);
});

describe('apiFetch', () => {
  it('sends JSON with the session token and returns the parsed body', async () => {
    setToken('lp_token');
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    await expect(apiFetch('/connections/abc', { method: 'PATCH', body: { notes: 'Hi' } })).resolves.toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}/connections/abc`);
    expect(init?.method).toBe('PATCH');
    expect(init?.body).toBe('{"notes":"Hi"}');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer lp_token', 'Content-Type': 'application/json' });
  });

  it('omits the token when auth is false', async () => {
    setToken('lp_token');
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await apiFetch('/auth/login', { method: 'POST', body: {}, auth: false });
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty('Authorization');
  });

  it('resolves undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('maps the error envelope onto ApiError', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, envelope('conflict', 'That handle is taken', { handle: 'That handle is taken' })));

    const error = await rejection(apiFetch('/me', { method: 'PATCH', body: { handle: 'gpdev' } }));
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'conflict', message: 'That handle is taken', fields: { handle: 'That handle is taken' } });
  });

  it('derives a code from the status when a failed response has no envelope', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await rejection(apiFetch('/feed'));
    expect(error).toMatchObject({ status: 502, code: 'unavailable' });
  });

  it('turns a failed request into network_error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await rejection(apiFetch('/feed'));
    expect(error).toMatchObject({ status: 0, code: 'network_error', message: "You're offline or the server can't be reached." });
  });

  it('turns a slow request into timeout', async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const error = await rejection(apiFetch('/feed', { timeoutMs: 20 }));
    expect(error).toMatchObject({ status: 0, code: 'timeout', message: 'The connection is too slow — try again.' });
  });

  it('rejects with the abort reason when the caller aborts', async () => {
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const controller = new AbortController();
    const pending = apiFetch('/feed', { signal: controller.signal });
    controller.abort();
    const error = await rejection(pending);
    expect(error).not.toBeInstanceOf(ApiError);
    expect((error as DOMException).name).toBe('AbortError');
  });

  it('treats a 2xx body that is not JSON as an internal error', async () => {
    fetchMock.mockResolvedValue(new Response('<!doctype html>', { status: 200 }));
    await expect(apiFetch('/feed')).rejects.toMatchObject({ code: 'internal' });
  });
});

describe('the 401 rule', () => {
  it("signs out on 401 'unauthorized' when a token was sent", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    setToken('lp_token');
    fetchMock.mockResolvedValue(jsonResponse(401, envelope('unauthorized', 'Sign in to continue.')));

    await expect(apiFetch('/auth/me')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("does not sign out on 401 'invalid_credentials' (a wrong password)", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    setToken('lp_token');
    fetchMock.mockResolvedValue(
      jsonResponse(401, envelope('invalid_credentials', 'Incorrect password', { currentPassword: 'Incorrect password' })),
    );

    await expect(apiFetch('/auth/password', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(getToken()).toBe('lp_token');
  });

  it('does not sign out when no token was sent', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValue(jsonResponse(401, envelope('unauthorized', 'Sign in to continue.')));
    await expect(apiFetch('/auth/me')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('ignores a late 401 for a session that has since been replaced', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    setToken('lp_old');
    let respond: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValue(new Promise<Response>((resolve) => (respond = resolve)));

    const pending = apiFetch('/feed');
    setToken('lp_new');
    respond(jsonResponse(401, envelope('unauthorized', 'Sign in to continue.')));

    await expect(pending).rejects.toMatchObject({ code: 'unauthorized' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not sign out on a bare 401 without the envelope (e.g. from a proxy)', async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    setToken('lp_token');
    fetchMock.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    await expect(apiFetch('/feed')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('apiUrl', () => {
  it('appends query parameters, skipping null and undefined', () => {
    expect(apiUrl('/admin/users', { q: 'ana k', page: 2, empty: null, missing: undefined })).toBe(`${API_BASE}/admin/users?q=ana+k&page=2`);
  });
});
