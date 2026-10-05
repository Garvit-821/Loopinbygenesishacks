import type { UpdateConnectionInput } from '@loopin/shared';
import { isApiError, isRetryableError } from './api-error';

/**
 * Device-side drafts of connection edits (notes, tags, "met at"). A change is written here before its PATCH and
 * removed once the server has it, so nothing typed is lost to a bad connection or a closed tab. AppShell flushes
 * leftovers on mount and when the device comes back online; resetClientState clears them.
 */
export const DRAFTS_STORAGE_KEY = 'loopin.drafts';

export type ConnectionPatch = UpdateConnectionInput;

export interface ConnectionDraft {
  patch: ConnectionPatch;
  /** Grows with every save; a request clears only the revision it sent, so newer edits survive. */
  rev: number;
  savedAt: string;
}

type DraftMap = Record<string, ConnectionDraft>;

let lastRev = Date.now();

function cleanPatch(raw: unknown): ConnectionPatch | null {
  if (raw === null || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const patch: ConnectionPatch = {};
  if (typeof source.notes === 'string') patch.notes = source.notes;
  if (Array.isArray(source.tags) && source.tags.every((tag) => typeof tag === 'string')) patch.tags = source.tags as string[];
  if (source.eventId === null || typeof source.eventId === 'string') patch.eventId = source.eventId;
  return Object.keys(patch).length > 0 ? patch : null;
}

function readDrafts(): DraftMap {
  let parsed: unknown;
  try {
    parsed = JSON.parse(window.localStorage.getItem(DRAFTS_STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
  if (parsed === null || typeof parsed !== 'object') return {};
  const drafts: DraftMap = {};
  for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value === null || typeof value !== 'object') continue;
    const entry = value as Record<string, unknown>;
    const patch = cleanPatch(entry.patch);
    if (patch && typeof entry.rev === 'number') {
      drafts[id] = { patch, rev: entry.rev, savedAt: typeof entry.savedAt === 'string' ? entry.savedAt : new Date(0).toISOString() };
    }
  }
  return drafts;
}

function writeDrafts(drafts: DraftMap): void {
  try {
    if (Object.keys(drafts).length === 0) window.localStorage.removeItem(DRAFTS_STORAGE_KEY);
    else window.localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  } catch {
    // Storage full or blocked: the edit still goes to the server, it just can't survive a reload.
  }
}

/** Merge `patch` into the connection's draft (fields left undefined keep their drafted value). */
export function saveDraft(connectionId: string, patch: ConnectionPatch): ConnectionDraft {
  const drafts = readDrafts();
  const merged: ConnectionPatch = { ...drafts[connectionId]?.patch };
  if (patch.notes !== undefined) merged.notes = patch.notes;
  if (patch.tags !== undefined) merged.tags = patch.tags;
  if (patch.eventId !== undefined) merged.eventId = patch.eventId;
  lastRev = Math.max(lastRev + 1, Date.now());
  const draft: ConnectionDraft = { patch: merged, rev: lastRev, savedAt: new Date().toISOString() };
  drafts[connectionId] = draft;
  writeDrafts(drafts);
  return draft;
}

export function getDraft(connectionId: string): ConnectionDraft | null {
  return readDrafts()[connectionId] ?? null;
}

/** All pending drafts, keyed by connection id. */
export function listDrafts(): Readonly<DraftMap> {
  return readDrafts();
}

/** Remove the draft; with `rev`, only if it is still that revision (a newer edit stays pending). */
export function clearDraft(connectionId: string, rev?: number): void {
  const drafts = readDrafts();
  const draft = drafts[connectionId];
  if (!draft || (rev !== undefined && draft.rev !== rev)) return;
  delete drafts[connectionId];
  writeDrafts(drafts);
}

export function clearAllDrafts(): void {
  writeDrafts({});
}

export interface FlushResult {
  sent: number;
  failed: number;
}

let flushing: Promise<FlushResult> | null = null;

/**
 * Send every pending draft, one at a time. A draft is cleared when `send` succeeds, and also when the server
 * rejects it for good (4xx: invalid, or the connection was removed). Network failures keep it for the next flush
 * and stop the run. Calls made while a flush is running share it.
 */
export function flushDrafts(send: (connectionId: string, patch: ConnectionPatch) => Promise<unknown>): Promise<FlushResult> {
  if (flushing) return flushing;
  const run = async (): Promise<FlushResult> => {
    const result: FlushResult = { sent: 0, failed: 0 };
    for (const [connectionId, draft] of Object.entries(readDrafts())) {
      try {
        await send(connectionId, draft.patch);
        clearDraft(connectionId, draft.rev);
        result.sent += 1;
      } catch (error) {
        result.failed += 1;
        if (!isRetryableError(error)) {
          clearDraft(connectionId, draft.rev);
        } else if (isApiError(error) && (error.code === 'network_error' || error.code === 'timeout')) {
          break;
        }
      }
    }
    return result;
  };
  flushing = run().finally(() => {
    flushing = null;
  });
  return flushing;
}
