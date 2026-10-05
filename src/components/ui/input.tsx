import { Search, X } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared look of every text-like control (Input, Textarea, Select, TagInput box). 17px text keeps iOS from zooming on
 * focus; the line-strong border keeps the control boundary at ≥ 3:1. Fields live on cards and sheets, so the focus
 * ring's offset uses the surface color (the global .focus-ring offsets from the canvas).
 */
export const fieldControlClasses = cn(
  'block w-full rounded-input border border-line-strong bg-surface text-body text-ink placeholder:text-ink-3',
  'transition-[border-color,box-shadow] duration-150',
  'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
  'aria-[invalid=true]:border-danger',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3',
);

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, type = 'text', ...props }, ref) {
  return <input ref={ref} type={type} className={cn(fieldControlClasses, 'h-11 px-3.5', className)} {...props} />;
});

export interface SearchInputProps extends Omit<InputProps, 'type'> {
  /** Shows a clear button while the field has a value. */
  onClear?: () => void;
  /** className of the wrapper (layout); the input itself keeps the standard look. */
  className?: string;
}

/** Search field with a leading magnifier and an optional clear button. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { className, onClear, value, ...props },
  ref,
) {
  const hasValue = typeof value === 'string' ? value.length > 0 : Boolean(value);
  return (
    <div className={cn('relative', className)}>
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
      <input
        ref={ref}
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        className={cn(fieldControlClasses, 'h-11 pl-10', onClear ? 'pr-11' : 'pr-3.5')}
        {...props}
      />
      {onClear && hasValue ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="focus-ring absolute right-0 top-0 grid size-11 place-items-center rounded-full text-ink-3 hover:text-ink-2"
        >
          <span className="grid size-5 place-items-center rounded-full bg-ink-3/25">
            <X aria-hidden="true" className="size-3.5" strokeWidth={3} />
          </span>
        </button>
      ) : null}
    </div>
  );
});
