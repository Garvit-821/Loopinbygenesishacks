import { WifiOff } from 'lucide-react';
import { cn, useOnlineStatus } from '@/lib/utils';

export interface OfflineBannerProps {
  className?: string;
  /** Force visibility (previews/tests). By default it follows navigator.onLine. */
  show?: boolean;
}

/** Slim status strip while offline. The live region stays mounted so the change is announced. */
export function OfflineBanner({ className, show }: OfflineBannerProps) {
  const online = useOnlineStatus();
  const visible = show ?? !online;
  return (
    <div role="status" aria-live="polite">
      {visible ? (
        <div className={cn('flex justify-center bg-surface-3 px-4 py-2 text-footnote font-medium text-ink', className)}>
          <p className="flex items-start gap-2">
            <WifiOff aria-hidden="true" className="mt-px size-4 shrink-0" />
            <span>You're offline. Showing what's saved on this device.</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
