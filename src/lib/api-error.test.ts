import { describe, expect, it } from 'vitest';
import { ApiError, CLIENT_ERROR_MESSAGES, describeError, errorMessage, isApiError, isRetryableError } from './api-error';

const apiError = (code: ApiError['code'], message = 'Server says no.', status = 400) => new ApiError({ status, code, message });

describe('ApiError', () => {
  it('carries status, code, message and fields', () => {
    const error = new ApiError({ status: 409, code: 'conflict', message: 'That handle is taken', fields: { handle: 'That handle is taken' } });
    expect(error).toBeInstanceOf(Error);
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({ name: 'ApiError', status: 409, code: 'conflict', message: 'That handle is taken' });
    expect(error.fields).toEqual({ handle: 'That handle is taken' });
    expect(isApiError(new Error('nope'))).toBe(false);
  });
});

describe('errorMessage', () => {
  it('uses friendly copy for client-side and generic server codes', () => {
    expect(errorMessage(apiError('network_error', '', 0))).toBe(CLIENT_ERROR_MESSAGES.network_error);
    expect(errorMessage(apiError('timeout', '', 0))).toBe(CLIENT_ERROR_MESSAGES.timeout);
    expect(errorMessage(apiError('internal', 'Internal Server Error', 500))).toBe('Something went wrong on our side. Please try again.');
    expect(errorMessage(apiError('rate_limited', 'Too Many Requests', 429))).toMatch(/wait a moment/i);
  });

  it("keeps the server's own message for specific errors", () => {
    expect(errorMessage(apiError('badge_expired', 'This code expired — ask them to refresh'))).toBe('This code expired — ask them to refresh');
  });

  it('never leaks technical details from non-API errors', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toBe('Something went wrong. Please try again.');
    expect(errorMessage('boom', 'Could not save')).toBe('Could not save');
  });
});

describe('describeError', () => {
  it.each([
    ['network_error', 'offline', true],
    ['timeout', 'slow', true],
    ['rate_limited', 'throttled', true],
    ['forbidden', 'forbidden', false],
    ['not_connected', 'forbidden', false],
    ['not_found', 'not_found', false],
    ['unauthorized', 'signed_out', false],
    ['unavailable', 'generic', true],
    ['validation_error', 'generic', false],
  ] as const)('%s → %s (retryable: %s)', (code, kind, retryable) => {
    const description = describeError(apiError(code));
    expect(description.kind).toBe(kind);
    expect(description.retryable).toBe(retryable);
    expect(isRetryableError(apiError(code))).toBe(retryable);
    expect(description.title.length).toBeGreaterThan(0);
  });
});
