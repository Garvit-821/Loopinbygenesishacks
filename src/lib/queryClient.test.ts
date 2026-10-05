import type { Query } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error';
import { queryClient, shouldPersistQuery, shouldRetry } from './queryClient';
import { qk } from './queryKeys';

function fakeQuery(meta: Query['meta'], status: Query['state']['status']): Pick<Query, 'meta' | 'state'> {
  return { meta, state: { status } as Query['state'] };
}

describe('shouldPersistQuery', () => {
  it('persists successful queries that opted in', () => {
    expect(shouldPersistQuery(fakeQuery({ persist: true }, 'success'))).toBe(true);
  });

  it('never persists errors, pending queries or queries that did not opt in', () => {
    expect(shouldPersistQuery(fakeQuery({ persist: true }, 'error'))).toBe(false);
    expect(shouldPersistQuery(fakeQuery({ persist: true }, 'pending'))).toBe(false);
    expect(shouldPersistQuery(fakeQuery(undefined, 'success'))).toBe(false);
    expect(shouldPersistQuery(fakeQuery({ persist: false }, 'success'))).toBe(false);
  });

  it('applies to the account even when it was written with setQueryData', () => {
    queryClient.setQueryData(qk.me, { id: 'u1' });
    const query = queryClient.getQueryCache().find({ queryKey: qk.me, exact: true });
    expect(query && shouldPersistQuery(query)).toBe(true);
    queryClient.clear();
  });
});

describe('shouldRetry', () => {
  it('never retries client errors', () => {
    expect(shouldRetry(0, new ApiError({ status: 404, code: 'not_found', message: 'x' }))).toBe(false);
    expect(shouldRetry(0, new ApiError({ status: 429, code: 'rate_limited', message: 'x' }))).toBe(false);
  });

  it('retries network trouble and server errors at most twice', () => {
    const offline = new ApiError({ status: 0, code: 'network_error', message: 'x' });
    expect(shouldRetry(0, offline)).toBe(true);
    expect(shouldRetry(1, offline)).toBe(true);
    expect(shouldRetry(2, offline)).toBe(false);
    expect(shouldRetry(1, new ApiError({ status: 503, code: 'unavailable', message: 'x' }))).toBe(true);
  });
});
