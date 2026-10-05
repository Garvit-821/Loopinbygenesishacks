import { cn } from '@/lib/utils';

/** The app mark (loop + spark) on an accent tile, drawn with tokens so it follows the theme. Mirrors public/icon.svg. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cn('size-8 shrink-0', className)}>
      <rect width="64" height="64" rx="14.25" className="fill-accent" />
      <path
        d="M45.39 35.05A14.75 14.75 0 1 1 28.95 18.61"
        fill="none"
        strokeWidth="7.5"
        strokeLinecap="round"
        className="stroke-accent-fg"
      />
      <path
        d="M42.42 14.83Q42.42 21.58 49.17 21.58Q42.42 21.58 42.42 28.33Q42.42 21.58 35.67 21.58Q42.42 21.58 42.42 14.83Z"
        className="fill-accent-fg"
      />
    </svg>
  );
}

const SIZES = {
  sm: { mark: 'size-7', word: 'text-headline' },
  md: { mark: 'size-8', word: 'text-title' },
  lg: { mark: 'size-12', word: 'text-large-title' },
} as const;

export interface LogoProps {
  size?: keyof typeof SIZES;
  /** Show the "Loopin" wordmark next to the mark (default true). */
  wordmark?: boolean;
  className?: string;
}

export function Logo({ size = 'md', wordmark = true, className }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={SIZES[size].mark} />
      {wordmark ? (
        <span className={cn('font-bold tracking-[-0.03em] text-ink', SIZES[size].word)}>Loopin</span>
      ) : (
        <span className="sr-only">Loopin</span>
      )}
    </span>
  );
}
