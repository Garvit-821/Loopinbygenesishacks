import { useEffect, useId, useSyncExternalStore } from 'react';

/**
 * Document title management. The route's static title (`handle.title`, set once by the root layout via
 * useRouteTitle) is the fallback; a page may override it with a dynamic title via usePageTitle (e.g. a person's
 * name). The TopBar reads the effective title with useCurrentTitle().
 */

const APP_TITLE = 'Loopin';

let routeTitle: string | null = null;
/** Mounted page overrides, most recent last. */
const pageTitles: { id: string; title: string }[] = [];
const listeners = new Set<() => void>();
let currentTitle: string | null = null;

export function formatDocumentTitle(title: string | null | undefined): string {
  return title ? `${title} · ${APP_TITLE}` : APP_TITLE;
}

function update(): void {
  const next = pageTitles.at(-1)?.title ?? routeTitle;
  document.title = formatDocumentTitle(next);
  if (next !== currentTitle) {
    currentTitle = next;
    listeners.forEach((listener) => listener());
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Root layout: the matched route's static title. */
export function useRouteTitle(title: string | null | undefined): void {
  useEffect(() => {
    routeTitle = title || null;
    update();
  }, [title]);
}

/** Page-level title (overrides the route title while mounted). Pass null/'' while data is loading. */
export function usePageTitle(title: string | null | undefined): void {
  const id = useId();
  useEffect(() => {
    if (!title) return;
    pageTitles.push({ id, title });
    update();
    return () => {
      const index = pageTitles.findIndex((entry) => entry.id === id);
      if (index !== -1) pageTitles.splice(index, 1);
      update();
    };
  }, [id, title]);
}

/** The title currently shown (page override, else route title). */
export function useCurrentTitle(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => currentTitle,
    () => null,
  );
}
