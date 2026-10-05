import { useCallback } from 'react';
import { generatePath, useLocation, useMatches, useNavigate } from 'react-router-dom';
import { DEFAULT_NEXT } from '@/lib/utils';

/** Static metadata on every route in router.tsx. */
export interface RouteHandle {
  /** Short page title for the TopBar and the document title ("<title> · Loopin"). Pages override it with usePageTitle(). */
  title: string;
  /**
   * Where Back goes when there is no in-app history (the page was opened from a link). Its presence shows the back
   * button. May use the route's params, e.g. '/organizer/events/:eventId'.
   */
  back?: string;
}

export function isRouteHandle(value: unknown): value is RouteHandle {
  return typeof value === 'object' && value !== null && typeof (value as { title?: unknown }).title === 'string';
}

/** The deepest matched route's handle (with `back` resolved against the current params). */
export function useRouteHandle(): RouteHandle | null {
  const matches = useMatches();
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const { handle, params } = matches[index];
    if (!isRouteHandle(handle)) continue;
    if (!handle.back?.includes(':')) return handle;
    try {
      return { ...handle, back: generatePath(handle.back, params) };
    } catch {
      return { title: handle.title };
    }
  }
  return null;
}

/**
 * Back per SPEC §6.2: with in-app history go back one step; opened directly (location.key 'default') go to the
 * route's `back` (or /passport) instead of leaving the app.
 */
export function useBackNavigation(): { backTo: string | null; goBack: () => void } {
  const handle = useRouteHandle();
  const location = useLocation();
  const navigate = useNavigate();
  const backTo = handle?.back ?? null;
  const goBack = useCallback(() => {
    if (location.key === 'default') navigate(backTo ?? DEFAULT_NEXT, { replace: true });
    else navigate(-1);
  }, [backTo, location.key, navigate]);
  return { backTo, goBack };
}
