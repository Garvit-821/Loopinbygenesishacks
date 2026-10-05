import { clsx, type ClassValue } from 'clsx';
import { useSyncExternalStore } from 'react';
import { extendTailwindMerge } from 'tailwind-merge';

/** Named type scale from tailwind.config.js. tailwind-merge must know these, or it treats `text-headline` as a color. */
export const FONT_SIZES = ['display', 'large-title', 'title', 'headline', 'body', 'callout', 'footnote', 'caption', 'tab'] as const;

/** Safe-area spacing values from the tailwind plugin: `safe`, `safe-offset-4`, `safe-or-4`. */
const isSafeAreaValue = (value: string) => /^safe(?:-(?:offset|or)-.+)?$/.test(value);

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      borderRadius: ['input', 'card', 'hero'],
      padding: [isSafeAreaValue],
      inset: [isSafeAreaValue, 'kb'],
    },
    classGroups: {
      'font-size': [{ text: [...FONT_SIZES] }],
      shadow: [{ shadow: ['card', 'raised', 'thumb'] }],
      z: [{ z: ['bar', 'dialog', 'toast'] }],
      'max-h': [{ 'max-h': ['sheet'] }],
      ease: [{ ease: ['ios'] }],
    },
  },
});

/** Join class names and resolve Tailwind conflicts (later wins), aware of Loopin's custom tokens. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Absolute link for sharing/copying. Use for every link that leaves the device (native shells need VITE_PUBLIC_APP_URL). */
export function publicUrl(path: string): string {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL ?? '').trim().replace(/\/+$/, '');
  const base = configured || window.location.origin;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export const DEFAULT_NEXT = '/passport';

/** Public-only routes redirect signed-in users onwards, so accepting one as `next` would loop. */
const PUBLIC_ONLY_PATHS = new Set(['/', '/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback']);

/**
 * Validate a post-login redirect target: a same-origin path with a single leading "/".
 * Anything else (absolute URLs, protocol-relative "//x", "/\x", control characters) falls back to /passport.
 */
export function safeNext(raw: string | null | undefined): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.startsWith('//')) return DEFAULT_NEXT;
  // Browsers treat "\" like "/" and strip tabs/newlines inside URLs, so "/\evil.com" or "/\t/evil.com" could escape.
  if (/[\\\u0000-\u001F\u007F]/.test(raw)) return DEFAULT_NEXT;
  try {
    const { origin } = window.location;
    const url = new URL(raw, origin);
    if (url.origin !== origin) return DEFAULT_NEXT;
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (PUBLIC_ONLY_PATHS.has(path)) return DEFAULT_NEXT;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_NEXT;
  }
}

/** Only http(s) URLs may become clickable links; everything else (javascript:, data:, relative junk) returns null. */
export function safeHref(url: string | null | undefined): string | null {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Copy text to the clipboard. Resolves false when the browser refuses (callers show a fallback message). */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or document not focused: fall through to the legacy path.
  }
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  document.body.appendChild(textarea);
  try {
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
    previousFocus?.focus({ preventScroll: true });
  }
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

/**
 * Open the native share sheet when available, otherwise copy the URL.
 * Throws when neither works so the caller can show an error.
 */
export async function share(data: { title?: string; text?: string; url: string }): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      if (isAbortError(error)) return 'cancelled';
      // NotAllowedError etc.: fall back to copying.
    }
  }
  if (await copyToClipboard(data.url)) return 'copied';
  throw new Error("Couldn't share or copy the link.");
}

export type SaveOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Save a generated text file. On touch devices (phones, native shells) the share sheet is the only reliable way
 * to hand a file to the user; elsewhere a normal download is the expected behaviour.
 */
export async function saveFile(name: string, text: string, mime: string): Promise<SaveOutcome> {
  const blob = new Blob([text], { type: mime });
  const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  if (coarsePointer && typeof navigator.share === 'function' && typeof File === 'function') {
    const file = new File([blob], name, { type: mime });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return 'shared';
      } catch (error) {
        if (isAbortError(error)) return 'cancelled';
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

/** `navigator.onLine`, kept in sync with online/offline events. */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}
