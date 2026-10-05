import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui';
import { cn, useOnlineStatus } from '@/lib/utils';
import { LogoMark } from './Logo';

const OFFLINE_HINT_DELAY_MS = 3000;

export interface LoadingScreenProps {
  /** Screen reader text (default "Loading Loopin"). */
  label?: string;
  /** Fill the viewport (default). false renders inline, e.g. inside a page. */
  fullScreen?: boolean;
  className?: string;
}

/** Boot/route-level loading. If it takes more than 3 s while offline, explains that Loopin is waiting for a connection. */
export function LoadingScreen({ label = 'Loading Loopin', fullScreen = true, className }: LoadingScreenProps) {
  const online = useOnlineStatus();
  const [waitedLong, setWaitedLong] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setWaitedLong(true), OFFLINE_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const showOffline = waitedLong && !online;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-5 px-6 text-center',
        fullScreen ? 'min-h-dvh bg-canvas pb-safe pt-safe' : 'py-16',
        className,
      )}
    >
      <LogoMark className="size-14 animate-in fade-in-0 zoom-in-95 duration-500 motion-reduce:animate-none" />
      <div role="status" aria-live="polite" className="flex min-h-11 flex-col items-center gap-3">
        {showOffline ? (
          <p className="flex max-w-xs items-start gap-2 text-callout text-ink-2">
            <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>You're offline — Loopin will continue when you're back online</span>
          </p>
        ) : (
          <Spinner className="text-ink-3" label={label} />
        )}
      </div>
    </div>
  );
}
