import { CircleAlert, Clock, Hourglass, Lock, LogOut, SearchX, WifiOff, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui';
import { describeError, type ErrorDescription } from '@/lib/api-error';
import { EmptyState } from './EmptyState';

const ICONS: Record<ErrorDescription['kind'], LucideIcon> = {
  offline: WifiOff,
  slow: Hourglass,
  throttled: Clock,
  forbidden: Lock,
  not_found: SearchX,
  signed_out: LogOut,
  generic: CircleAlert,
};

export interface ErrorStateProps {
  error: unknown;
  /** Shows "Try again" when the error is retryable. */
  onRetry?: () => void;
  retrying?: boolean;
  /** Override the derived title. */
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Turns any thrown value (ApiError codes incl. network_error / timeout / rate_limited) into friendly copy + retry. */
export function ErrorState({ error, onRetry, retrying = false, title, size = 'md', className }: ErrorStateProps) {
  const description = describeError(error);
  return (
    <div role="alert" className={className}>
      <EmptyState
        icon={ICONS[description.kind]}
        title={title ?? description.title}
        description={description.message}
        size={size}
        tone="neutral"
        action={
          onRetry && description.retryable ? (
            <Button variant="secondary" onClick={onRetry} loading={retrying}>
              Try again
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
