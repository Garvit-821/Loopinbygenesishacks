import type { UserLite } from '@loopin/shared';
import { formatHandle } from '@loopin/shared';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Avatar } from './Avatar';

export interface UserRowProps {
  user: Pick<UserLite, 'name' | 'handle' | 'avatarUrl'> & { headline?: string };
  /** Second line (default: headline, else @handle). */
  subtitle?: ReactNode;
  /** Small third line, e.g. "Met at Genesis Hacks 2026 · 2 days ago". */
  meta?: ReactNode;
  /** Right side, e.g. a Badge or time. Must not be interactive when the row has `to`/`onClick`. */
  trailing?: ReactNode;
  /** Makes the whole row a router link. */
  to?: string;
  /** Makes the whole row a button. */
  onClick?: () => void;
  /** Defaults to true for links/buttons. */
  chevron?: boolean;
  avatarSize?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** A person in a list: 40px avatar, name, one or two lines of context; ≥ 56px tall. */
export function UserRow({ user, subtitle, meta, trailing, to, onClick, chevron, avatarSize = 'md', className }: UserRowProps) {
  const interactive = Boolean(to || onClick);
  const showChevron = chevron ?? interactive;
  const secondLine = subtitle ?? (user.headline || formatHandle(user.handle));

  const content = (
    <>
      <Avatar src={user.avatarUrl} name={user.name} size={avatarSize} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold text-ink">{user.name}</span>
        {secondLine ? <span className="block truncate text-callout text-ink-2">{secondLine}</span> : null}
        {meta ? <span className="mt-0.5 block truncate text-footnote text-ink-3">{meta}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2 text-footnote text-ink-3">{trailing}</span> : null}
      {showChevron ? <ChevronRight aria-hidden="true" className="-mr-1 size-5 shrink-0 text-ink-3" /> : null}
    </>
  );

  const classes = cn(
    'flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left',
    interactive && 'focus-ring-inset transition-colors duration-150 hover:bg-ink/[0.04] active:bg-ink/[0.08]',
    className,
  );

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {content}
      </button>
    );
  }
  return <div className={classes}>{content}</div>;
}
