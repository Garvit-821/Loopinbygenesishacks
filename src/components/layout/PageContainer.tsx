import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** `wide` (max-w-5xl) for organizer consoles and dense tables; default max-w-3xl. */
  width?: 'default' | 'wide';
}

/** Page column: 16 px gutters on phones, 24 px from md, centered with a max width. */
export function PageContainer({ width = 'default', className, ...props }: PageContainerProps) {
  return (
    <div
      className={cn('mx-auto w-full px-4 pt-3 md:px-6 md:pt-10', width === 'wide' ? 'max-w-5xl' : 'max-w-3xl', className)}
      {...props}
    />
  );
}
