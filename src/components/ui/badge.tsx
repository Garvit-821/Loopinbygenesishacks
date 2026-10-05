import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'gold' | 'silver' | 'bronze';

/** Soft badges only: 10% tint + full-strength text (never white text on success/warning/gold). */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-3 text-ink-2',
  accent: 'bg-accent/10 text-accent-ink',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
  gold: 'bg-gold/10 text-gold',
  silver: 'bg-silver/10 text-silver',
  bronze: 'bg-bronze/10 text-bronze',
};

const SIZES = {
  sm: 'h-5 px-2 text-tab [&_svg]:size-3',
  md: 'h-6 px-2.5 text-caption font-semibold [&_svg]:size-3.5',
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: keyof typeof SIZES;
}

export function Badge({ tone = 'neutral', size = 'md', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-semibold [&_svg]:shrink-0',
        SIZES[size],
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
