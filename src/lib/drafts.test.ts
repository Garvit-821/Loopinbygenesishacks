import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';
import { clearAllDrafts, clearDraft, DRAFTS_STORAGE_KEY, flushDrafts, getDraft, listDrafts, saveDraft } from './drafts';

const networkError = () => new ApiError({ status: 0, code: 'network_error', message: 'offline' });

describe('drafts', () => {
  it('merges patches for a connection and bumps the revision', () => {
    const first = saveDraft('c1', { notes: 'Great demo' });
    const second = saveDraft('c1', { tags: ['Follow up'] });
    expect(second.rev).toBeGreaterThan(first.rev);
    expect(getDraft('c1')?.patch).toEqual({ notes: 'Great demo', tags: ['Follow up'] });

    saveDraft('c1', { notes: 'Great demo, follow up Tuesday', eventId: null });
    expect(getDraft('c1')?.patch).toEqual({ notes: 'Great demo, follow up Tuesday', tags: ['Follow up'], eventId: null });
  });

  it('persists in localStorage under loopin.drafts', () => {
    saveDraft('c1', { notes: 'x' });
    expect(JSON.parse(window.localStorage.getItem(DRAFTS_STORAGE_KEY) ?? '{}')).toHaveProperty('c1.patch.notes', 'x');
  });

  it('clears only the revision a request sent', () => {
    const sent = saveDraft('c1', { notes: 'v1' });
    saveDraft('c1', { notes: 'v2' });
    clearDraft('c1', sent.rev);
    expect(getDraft('c1')?.patch.notes).toBe('v2');
    clearDraft('c1');
    expect(getDraft('c1')).toBeNull();
  });

  it('clears everything at once', () => {
    saveDraft('c1', { notes: 'a' });
    saveDraft('c2', { tags: ['b'] });
    clearAllDrafts();
    expect(listDrafts()).toEqual({});
    expect(window.localStorage.getItem(DRAFTS_STORAGE_KEY)).toBeNull();
  });

  it('ignores corrupted storage', () => {
    window.localStorage.setItem(DRAFTS_STORAGE_KEY, '{not json');
    expect(listDrafts()).toEqual({});
    window.localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify({ c1: { patch: { notes: 42 }, rev: 1 }, c2: 'junk' }));
    expect(listDrafts()).toEqual({});
  });
});

describe('flushDrafts', () => {
  it('sends each draft and clears it on success', async () => {
    saveDraft('c1', { notes: 'a' });
    saveDraft('c2', { tags: ['b'] });
    const send = vi.fn().mockResolvedValue(undefined);

    await expect(flushDrafts(send)).resolves.toEqual({ sent: 2, failed: 0 });
    expect(send).toHaveBeenCalledWith('c1', { notes: 'a' });
    expect(send).toHaveBeenCalledWith('c2', { tags: ['b'] });
    expect(listDrafts()).toEqual({});
  });

  it('keeps drafts on network errors and stops early', async () => {
    saveDraft('c1', { notes: 'a' });
    saveDraft('c2', { notes: 'b' });
    const send = vi.fn().mockRejectedValue(networkError());

    await expect(flushDrafts(send)).resolves.toEqual({ sent: 0, failed: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(Object.keys(listDrafts())).toEqual(['c1', 'c2']);
  });

  it('drops drafts the server rejects for good', async () => {
    saveDraft('gone', { notes: 'a' });
    const send = vi.fn().mockRejectedValue(new ApiError({ status: 404, code: 'not_found', message: 'Not found' }));
    await flushDrafts(send);
    expect(getDraft('gone')).toBeNull();
  });

  it('keeps an edit made while its draft was being sent', async () => {
    saveDraft('c1', { notes: 'v1' });
    const send = vi.fn().mockImplementation(async () => {
      saveDraft('c1', { notes: 'v2' });
    });
    await flushDrafts(send);
    expect(getDraft('c1')?.patch.notes).toBe('v2');
  });

  it('shares one run between concurrent calls', async () => {
    saveDraft('c1', { notes: 'a' });
    let finish: () => void = () => undefined;
    const send = vi.fn().mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));

    const first = flushDrafts(send);
    const second = flushDrafts(send);
    expect(second).toBe(first);
    finish();
    await first;
    expect(send).toHaveBeenCalledTimes(1);
  });
});
