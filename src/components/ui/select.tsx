import { ChevronsUpDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { fieldControlClasses } from './input';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Styles the wrapper (use it for width/margins). All other props go to the native <select>. */
  className?: string;
}

/** Native select (best on mobile: the OS picker) with the shared field look. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, children, ...props }, ref) {
  return (
    <div className={cn('relative', className)}>
      <select ref={ref} className={cn(fieldControlClasses, 'h-11 appearance-none truncate pl-3.5 pr-10')} {...props}>
        {children}
      </select>
      <ChevronsUpDown
        aria-hidden="true"
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
      />
    </div>
  );
});
