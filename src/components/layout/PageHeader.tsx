import { ChevronLeft } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { usePageTitle } from '@/lib/usePageTitle';
import { cn } from '@/lib/utils';
import { useLargeTitle } from './largeTitle';
import { useBackNavigation } from './navigation';

export interface PageHeaderProps {
  /** The page's h1; also the document and TopBar title. */
  title: string;
  description?: ReactNode;
  /** Buttons aligned with the title (stacked under it on phones). */
  actions?: ReactNode;
  className?: string;
}

/**
 * Large page title (h1, focus target after navigation). On desktop it also carries the Back link for detail pages
 * (signed in only; on phones the TopBar has it).
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { backTo, goBack } = useBackNavigation();
  const signedIn = useAuth().status === 'authenticated';
  usePageTitle(title);
  useLargeTitle(headingRef);

  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {backTo && signedIn ? (
          <Button variant="ghost" size="sm" onClick={goBack} className="-ml-2.5 mb-2 hidden pl-1.5 text-accent-ink md:inline-flex">
            <ChevronLeft aria-hidden="true" />
            Back
          </Button>
        ) : null}
        <h1 ref={headingRef} tabIndex={-1} className="break-words text-large-title text-ink outline-none">
          {title}
        </h1>
        {description ? <p className="mt-1 text-callout text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
