import { useEffect, useSyncExternalStore, type RefObject } from 'react';

/**
 * iOS-style large titles: the page's h1 (PageHeader) is the title while it is on screen; the TopBar shows the small
 * centered title only once the h1 has scrolled under it, or on pages without a PageHeader.
 */

export const TOP_BAR_ID = 'top-bar';

let mountedTitles = 0;
let titleVisible = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** PageHeader: track whether its large title is visible below the top bar. */
export function useLargeTitle(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    mountedTitles += 1;
    titleVisible = true;
    emit();
    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver === 'function') {
      const barHeight = document.getElementById(TOP_BAR_ID)?.offsetHeight ?? 0;
      observer = new IntersectionObserver(
        ([entry]) => {
          titleVisible = entry.isIntersecting;
          emit();
        },
        { rootMargin: `-${barHeight}px 0px 0px 0px` },
      );
      observer.observe(element);
    }
    return () => {
      observer?.disconnect();
      mountedTitles -= 1;
      titleVisible = false;
      emit();
    };
  }, [ref]);
}

/** TopBar: show the small title unless the page's large title is on screen. */
export function useShowBarTitle(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => mountedTitles === 0 || !titleVisible,
    () => true,
  );
}
