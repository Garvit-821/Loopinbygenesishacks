import { Link, Outlet, useLocation } from 'react-router-dom';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/ui';

/** Public-only routes don't make sense as `next` (they redirect signed-in users onwards). */
const PUBLIC_ONLY_PATHS = new Set(['/', '/login', '/signup', '/forgot-password', '/reset-password', '/auth/callback']);

function withNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

/** Chrome for signed-out visitors: logo, Log in / Sign up, and a footer with Privacy and Terms. */
export function PublicLayout() {
  const location = useLocation();
  const next = PUBLIC_ONLY_PATHS.has(location.pathname) ? null : `${location.pathname}${location.search}`;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="frosted sticky top-0 z-bar border-b border-line-soft pt-safe">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-safe-offset-4 md:h-16 md:px-6">
          <Link to="/" className="focus-ring -m-1 flex items-center rounded-input p-1" aria-label="Loopin home">
            <Logo size="sm" />
          </Link>
          <nav aria-label="Account" className="flex items-center gap-1.5">
            {location.pathname !== '/login' ? (
              <Button asChild variant="ghost">
                <Link to={withNext('/login', next)}>Log in</Link>
              </Button>
            ) : null}
            {location.pathname !== '/signup' ? (
              <Button asChild>
                <Link to={withNext('/signup', next)}>Sign up</Link>
              </Button>
            ) : null}
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="flex flex-1 flex-col pb-10 outline-none">
        <Outlet />
      </main>

      <footer className="border-t border-line-soft pb-safe">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 px-4 py-5 text-footnote text-ink-3 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <p>Loopin by Genesis Hacks</p>
          <nav aria-label="Legal" className="-ml-2 flex">
            <Link to="/privacy" className="focus-ring inline-flex min-h-11 items-center rounded-input px-2 hover:text-ink">
              Privacy
            </Link>
            <Link to="/terms" className="focus-ring inline-flex min-h-11 items-center rounded-input px-2 hover:text-ink">
              Terms
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
