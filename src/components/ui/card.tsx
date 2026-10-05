import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const cardVariants = cva('bg-surface text-ink shadow-card', {
  variants: {
    variant: { default: 'rounded-card', hero: 'rounded-hero' },
    padding: { default: '', none: '' },
  },
  compoundVariants: [
    { variant: 'default', padding: 'default', className: 'p-4' },
    { variant: 'hero', padding: 'default', className: 'p-5' },
  ],
  defaultVariants: { variant: 'default', padding: 'default' },
});

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `hero`: larger radius and padding for the main card of a screen. */
  variant?: 'default' | 'hero';
  /** `none` for edge-to-edge content such as lists (pair with overflow-hidden). */
  padding?: 'default' | 'none';
  asChild?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ className, variant, padding, asChild, ...props }, ref) {
  const Component = asChild ? Slot : 'div';
  return <Component ref={ref} className={cn(cardVariants({ variant, padding }), className)} {...props} />;
});

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mb-3 flex items-start justify-between gap-3', className)} {...props} />;
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h2' | 'h3' | 'h4';
}

export function CardTitle({ as: Heading = 'h3', className, ...props }: CardTitleProps) {
  return <Heading className={cn('text-headline text-ink', className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-0.5 text-callout text-ink-2', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-4 flex flex-wrap items-center gap-2', className)} {...props} />;
}
