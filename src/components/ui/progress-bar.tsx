import { cn } from '@/lib/utils';

const TONES = {
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  gold: 'bg-gold',
} as const;

export interface ProgressBarProps {
  /** 0 … 1 (clamped). */
  value: number;
  /** Accessible name, e.g. "Progress to Veteran". */
  label: string;
  /** Spoken value, e.g. "1,260 of 1,500 XP" (defaults to the percentage). */
  valueText?: string;
  tone?: keyof typeof TONES;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Determinate progress. The track uses line-strong (≥ 3:1 against the card) and the fill is separated from the
 * remaining track by a surface-colored notch, so the boundary stays visible without relying on hue alone.
 */
export function ProgressBar({ value, label, valueText, tone = 'accent', size = 'md', className }: ProgressBarProps) {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const percent = Math.round(clamped * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={valueText}
      className={cn('relative w-full overflow-hidden rounded-full bg-line-strong', size === 'sm' ? 'h-1' : 'h-1.5', className)}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-ios motion-reduce:transition-none',
          TONES[tone],
          percent > 0 && percent < 100 && 'shadow-[3px_0_0_rgb(var(--surface))]',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
