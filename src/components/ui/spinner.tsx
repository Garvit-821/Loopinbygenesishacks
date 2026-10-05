import { cn } from '@/lib/utils';

const SIZES = { sm: 'size-4', md: 'size-5', lg: 'size-8' } as const;

export interface SpinnerProps {
  size?: keyof typeof SIZES;
  /** Announced to screen readers (role=status). Omit when the surrounding control already says it is busy. */
  label?: string;
  className?: string;
}

/** Indeterminate activity indicator in the current text color. */
export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  return (
    <span role={label ? 'status' : undefined} className={cn('inline-flex shrink-0', className)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cn(SIZES[size], 'animate-spin motion-reduce:[animation-duration:1.6s]')}
      >
        <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.5" />
        <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
