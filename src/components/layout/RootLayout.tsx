import { useEffect, useRef } from 'react';
import { Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { LiveEventsBridge } from '@/features/live/LiveEventsBridge';
import { useAuth } from '@/lib/auth';
import { useRouteTitle } from '@/lib/usePageTitle';
import { useRouteHandle } from './navigation';
import { NavigationProgress } from './NavigationProgress';
import { SkipLink } from './SkipLink';

/**
 * After an in-app navigation, move focus to the new page's h1 (or <main>) so screen readers announce it and
 * keyboard users continue from the top of the content. Query-string-only changes (tabs, filters) keep focus.
 */
function useRouteChangeFocus(): void {
  const { pathname } = useLocation();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    const frame = window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>('main h1') ?? document.getElementById('main');
      if (!target) return;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);
}

export function RootLayout() {
  const { status } = useAuth();
  const handle = useRouteHandle();
  useRouteTitle(handle?.title);
  useRouteChangeFocus();

  return (
    <>
      <SkipLink />
      <NavigationProgress />
      <ScrollRestoration />
      {status === 'authenticated' ? <LiveEventsBridge /> : null}
      <Outlet />
    </>
  );
}
