import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes, type MouseEvent } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export const buttonVariants = cva(
  [
    'focus-ring relative isolate inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold',
    'transition-[background-color,color,opacity,box-shadow] duration-150 ease-out',
    'disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
    // Hover/press tint: an ink overlay (under the label) darkens in light mode and lightens in dark mode.
    'after:pointer-events-none after:absolute after:inset-0 after:-z-10 after:rounded-[inherit] after:bg-ink after:opacity-0 after:transition-opacity after:duration-150',
    'hover:after:opacity-[0.06] active:after:opacity-[0.12]',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-fg after:hidden hover:bg-accent-hover active:opacity-80',
        secondary: 'bg-surface-3 text-ink',
        outline: 'border border-line bg-transparent text-ink',
        ghost: 'bg-transparent text-ink',
        destructive: 'bg-danger-solid text-accent-fg',
        link: 'bg-transparent text-accent-ink underline-offset-4 after:hidden hover:underline active:opacity-70',
      },
      size: {
        sm: 'h-9 px-3.5 text-callout [&_svg]:size-4',
        md: 'h-11 px-5 text-callout [&_svg]:size-5',
        lg: 'h-12.5 px-6 text-body [&_svg]:size-5',
        icon: 'size-11 [&_svg]:size-5',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'px-1' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

type NativeButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'>;

interface ButtonOwnProps extends NativeButtonProps {
  variant?: ButtonVariant;
  /** Shows a spinner, keeps the button focusable and ignores clicks (also blocks form submission). */
  loading?: boolean;
  /** Render the single child element (e.g. a router Link or an <a>) with button styling. `loading` is ignored. */
  asChild?: boolean;
}

/** Icon-only buttons have no visible text, so they must carry an aria-label. */
export type ButtonProps = ButtonOwnProps &
  ({ size: 'icon'; 'aria-label': string } | { size?: Exclude<ButtonSize, 'icon'>; 'aria-label'?: string });

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading = false, asChild = false, disabled, type, onClick, children, ...props },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot ref={ref} className={classes} onClick={onClick} {...props}>
        {children}
      </Slot>
    );
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={classes}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      onClick={handleClick}
      {...props}
    >
      {loading ? (
        <>
          <span className="inline-flex items-center gap-[inherit] opacity-0">{children}</span>
          <span className="absolute inset-0 grid place-items-center">
            <Spinner size={size === 'sm' ? 'sm' : 'md'} />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
});
