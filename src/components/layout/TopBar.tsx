import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui';
import { NotificationsBell } from '@/features/live/NotificationsBell';
import { useCurrentTitle } from '@/lib/usePageTitle';
import { cn } from '@/lib/utils';
import { TOP_BAR_ID, useShowBarTitle } from './largeTitle';
import { useBackNavigation, useRouteHandle } from './navigation';

/** Phones: sticky frosted bar with Back (detail pages), the page title once the large title scrolls away, and notifications. */
export function TopBar() {
  const handle = useRouteHandle();
  const title = useCurrentTitle() ?? handle?.title ?? '';
  const showTitle = useShowBarTitle();
  const { backTo, goBack } = useBackNavigation();

  return (
    <header
      id={TOP_BAR_ID}
      className={cn(
        'frosted sticky top-0 z-bar border-b pt-safe transition-colors duration-150 md:hidden',
        // Like iOS: the hairline appears once content scrolls under the bar.
        showTitle ? 'border-line-soft' : 'border-transparent',
      )}
    >
      <div className="relative flex h-11 items-center justify-between px-safe-offset-1">
        <div className="flex min-w-11 items-center">
          {backTo ? (
            <Button variant="ghost" size="icon" aria-label="Back" onClick={goBack} className="text-accent-ink [&_svg]:size-7">
              <ChevronLeft strokeWidth={2.25} />
            </Button>
          ) : null}
        </div>
        <p
          aria-hidden={showTitle ? undefined : true}
          className={cn(
            'pointer-events-none absolute inset-x-14 truncate text-center text-headline text-ink transition-opacity duration-150 motion-reduce:transition-none',
            showTitle ? 'opacity-100' : 'opacity-0',
          )}
        >
          {title}
        </p>
        <div className="flex min-w-11 items-center justify-end">
          <NotificationsBell />
        </div>
      </div>
    </header>
  );
}
