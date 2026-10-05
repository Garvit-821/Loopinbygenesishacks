import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Buttons/links shown under the text. */
  action?: ReactNode;
  /** `sm` for inside cards and tabs. */
  size?: 'sm' | 'md';
  /** Icon tint: accent (an invitation to act, default) or neutral (errors, offline). */
  tone?: 'accent' | 'neutral';
  headingLevel?: 'h2' | 'h3';
  className?: string;
}

/** Friendly "nothing here yet" block with an optional next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'md',
  tone = 'accent',
  headingLevel = 'h2',
  className,
}: EmptyStateProps) {
  const Heading = headingLevel;
  return (
    <div className={cn('flex flex-col items-center text-center', size === 'md' ? 'px-6 py-12' : 'px-4 py-8', className)}>
      {Icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'mb-4 grid place-items-center rounded-full',
            tone === 'accent' ? 'bg-accent/10 text-accent-ink' : 'bg-surface-3 text-ink-2',
            size === 'md' ? 'size-16 [&_svg]:size-8' : 'size-12 [&_svg]:size-6',
          )}
        >
          <Icon strokeWidth={1.75} />
        </span>
      ) : null}
      <Heading className={cn('text-ink', size === 'md' ? 'text-title' : 'text-headline')}>{title}</Heading>
      {description ? <p className="mt-1.5 max-w-sm text-balance text-callout text-ink-2">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}
