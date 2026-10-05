import { Check, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ChipProps {
  children: ReactNode;
  /** Makes the chip a toggle button (aria-pressed). */
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** Adds a remove (×) button. */
  onRemove?: () => void;
  /** Accessible name of the remove button (default "Remove <text>"). */
  removeLabel?: string;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
}

const SIZES = {
  sm: 'h-8 gap-1 px-3 text-footnote',
  md: 'h-9 gap-1.5 px-3.5 text-callout',
} as const;

/** Pill for filters (selectable), tags (removable) or static labels. */
export function Chip({
  children,
  selected,
  onSelectedChange,
  onRemove,
  removeLabel,
  icon,
  size = 'md',
  disabled,
  className,
}: ChipProps) {
  const selectable = selected !== undefined || onSelectedChange !== undefined;
  const isSelected = Boolean(selected);
  const label = removeLabel ?? (typeof children === 'string' ? `Remove ${children}` : 'Remove');

  const body = (
    <>
      {isSelected ? <Check aria-hidden="true" className="-ml-0.5 size-4 shrink-0" strokeWidth={2.5} /> : null}
      {!isSelected && icon ? <span aria-hidden="true" className="-ml-0.5 flex shrink-0 [&_svg]:size-4">{icon}</span> : null}
      <span className="truncate">{children}</span>
    </>
  );

  const surface = cn(
    'inline-flex max-w-full shrink-0 items-center rounded-full border font-medium transition-colors duration-150',
    SIZES[size],
    isSelected ? 'border-accent bg-accent text-accent-fg' : 'border-line bg-surface text-ink',
    disabled && 'pointer-events-none opacity-40',
  );

  const removeButton = onRemove ? (
    <button
      type="button"
      onClick={onRemove}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'focus-ring relative -mr-1.5 ml-0.5 grid size-6 shrink-0 place-items-center rounded-full',
        isSelected ? 'text-accent-fg hover:bg-accent-fg/20' : 'text-ink-3 hover:bg-ink/10 hover:text-ink',
        // 36px touch target around the 24px glyph.
        "before:absolute before:-inset-1.5 before:content-['']",
      )}
    >
      <X aria-hidden="true" className="size-3.5" strokeWidth={2.75} />
    </button>
  ) : null;

  if (selectable) {
    return (
      <span className={cn('relative inline-flex max-w-full', className)}>
        <button
          type="button"
          aria-pressed={isSelected}
          disabled={disabled}
          onClick={() => onSelectedChange?.(!isSelected)}
          className={cn(
            surface,
            'focus-ring hover:bg-surface-2 aria-pressed:hover:bg-accent-hover',
            // 44px touch target for 36px chips.
            "relative before:absolute before:-inset-y-1 before:inset-x-0 before:content-['']",
            onRemove && 'pr-9',
          )}
        >
          {body}
        </button>
        {removeButton ? <span className="absolute right-3 top-1/2 flex -translate-y-1/2">{removeButton}</span> : null}
      </span>
    );
  }

  return (
    <span className={cn(surface, onRemove && 'border-transparent bg-surface-3 pr-1.5', className)}>
      {body}
      {removeButton}
    </span>
  );
}
