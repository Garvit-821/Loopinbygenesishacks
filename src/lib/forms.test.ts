import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';
import { applyServerErrors, dirtyValues } from './forms';

function fakeForm(values: Record<string, unknown>) {
  return { setError: vi.fn(), getValues: vi.fn(() => values) };
}

describe('applyServerErrors', () => {
  it('puts field errors on their inputs and focuses the first', () => {
    const form = fakeForm({ email: '', handle: '', password: '' });
    const error = new ApiError({
      status: 409,
      code: 'conflict',
      message: 'Taken',
      fields: { handle: 'That handle is taken', email: 'That email is already registered' },
    });

    expect(applyServerErrors(form, error)).toBe(true);
    expect(form.setError).toHaveBeenNthCalledWith(1, 'handle', { type: 'server', message: 'That handle is taken' }, { shouldFocus: true });
    expect(form.setError).toHaveBeenNthCalledWith(2, 'email', { type: 'server', message: 'That email is already registered' }, { shouldFocus: false });
    expect(form.setError).toHaveBeenCalledTimes(2);
  });

  it("sends '_' and unknown fields to root.server", () => {
    const form = fakeForm({ name: '' });
    const error = new ApiError({ status: 400, code: 'validation_error', message: 'Invalid', fields: { _: 'Check the form', 'skills.0.level': 'Too high' } });

    expect(applyServerErrors(form, error)).toBe(false);
    expect(form.setError).toHaveBeenCalledWith('root.server', { type: 'server', message: 'Check the form Too high' });
  });

  it('resolves nested field paths', () => {
    const form = fakeForm({ skills: [{ name: 'Rust', level: 9 }] });
    const error = new ApiError({ status: 400, code: 'validation_error', message: 'Invalid', fields: { 'skills.0.level': 'Too high' } });
    expect(applyServerErrors(form, error)).toBe(true);
    expect(form.setError).toHaveBeenCalledWith('skills.0.level', { type: 'server', message: 'Too high' }, { shouldFocus: true });
  });

  it('shows other errors as a friendly form-level message', () => {
    const form = fakeForm({ email: '' });
    applyServerErrors(form, new ApiError({ status: 0, code: 'network_error', message: 'x' }));
    expect(form.setError).toHaveBeenCalledWith('root.server', { type: 'server', message: "You're offline or the server can't be reached." });

    applyServerErrors(form, new Error('TypeError: undefined is not a function'));
    expect(form.setError).toHaveBeenLastCalledWith('root.server', { type: 'server', message: 'Something went wrong. Please try again.' });
  });
});

describe('dirtyValues', () => {
  it('keeps only the top-level fields that changed', () => {
    const values = { name: 'Ana', headline: 'Rust', skills: [{ name: 'Rust', level: 4 }], bio: '' };
    expect(dirtyValues(values, { headline: true, skills: [{ level: true }], bio: false })).toEqual({
      headline: 'Rust',
      skills: [{ name: 'Rust', level: 4 }],
    });
  });
});
