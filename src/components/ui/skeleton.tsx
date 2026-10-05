import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Placeholder block while content loads. Give it the size/shape of what it stands in for. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-lg bg-surface-3 motion-reduce:animate-none', className)} {...props} />;
}
