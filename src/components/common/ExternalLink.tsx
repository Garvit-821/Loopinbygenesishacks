import { ArrowUpRight } from 'lucide-react';
import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { safeHref } from '@/lib/utils';

export interface ExternalLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel'> {
  /** Any user-supplied URL. Only http(s) becomes a link; anything else renders as plain text. */
  href: string | null | undefined;
  /** Trailing ↗ icon. */
  showIcon?: boolean;
}

/** Opens in a new tab with `noopener noreferrer nofollow ugc`. Works with `<Button asChild>`. */
export const ExternalLink = forwardRef<HTMLAnchorElement, ExternalLinkProps>(function ExternalLink(
  { href, showIcon = false, className, children, ...props },
  ref,
) {
  const safe = safeHref(href);
  if (!safe) return <span className={className}>{children}</span>;
  return (
    <a ref={ref} href={safe} target="_blank" rel="noopener noreferrer nofollow ugc" className={className} {...props}>
      {children}
      {showIcon ? <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" /> : null}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
});
