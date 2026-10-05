import { ChevronRight } from 'lucide-react';
import { cloneElement, isValidElement, type HTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card } from './card';

/**
 * Inset grouped lists (iOS Settings style): `ListSection` = optional header + card + footer note,
 * `List` = the rows container, `ListItem` = an <li> with an inset hairline above it (for custom rows such as
 * UserRow), `ListRow` = a ready-made settings row (static, button, or any link via asChild).
 */

export interface ListSectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  /** Small print under the card. */
  footer?: ReactNode;
}

export function ListSection({ title, footer, className, children, ...props }: ListSectionProps) {
  return (
    <section className={cn('flex flex-col gap-2', className)} {...props}>
      {title ? <h2 className="px-4 text-footnote font-semibold uppercase tracking-[0.04em] text-ink-3">{title}</h2> : null}
      <Card padding="none" className="overflow-hidden">
        <List>{children}</List>
      </Card>
      {footer ? <p className="px-4 text-footnote text-ink-3">{footer}</p> : null}
    </section>
  );
}

export function List({ className, ...props }: HTMLAttributes<HTMLUListElement>) {
  // role="list" keeps list semantics in Safari, which drops them when list-style is none.
  return <ul role="list" className={cn('flex flex-col', className)} {...props} />;
}

const INSETS = {
  none: '[&:not(:first-child)]:before:left-0',
  /** Rows whose text starts at the 16px gutter. */
  text: '[&:not(:first-child)]:before:left-4',
  /** Rows with a 24px leading icon (ListRow). */
  icon: '[&:not(:first-child)]:before:left-[3.25rem]',
  /** Rows with a 40px avatar (UserRow). */
  avatar: '[&:not(:first-child)]:before:left-[4.25rem]',
} as const;

export interface ListItemProps extends HTMLAttributes<HTMLLIElement> {
  /** Where the hairline above this row starts, so it lines up with the row's text (iOS style). */
  inset?: keyof typeof INSETS;
}

export function ListItem({ inset = 'text', className, ...props }: ListItemProps) {
  return (
    <li
      className={cn(
        'relative',
        '[&:not(:first-child)]:before:absolute [&:not(:first-child)]:before:right-0 [&:not(:first-child)]:before:top-0',
        '[&:not(:first-child)]:before:h-px [&:not(:first-child)]:before:bg-line-soft',
        INSETS[inset],
        className,
      )}
      {...props}
    />
  );
}

export interface ListRowProps {
  /** Leading icon (rendered 20px, ink-2). Rows with an icon inset their divider past it. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned secondary text, e.g. the current setting. */
  value?: ReactNode;
  /** Right-aligned element, e.g. a Switch or Badge. Must not be interactive when the row itself is. */
  trailing?: ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  /** Renders the row as a <button>. */
  onClick?: () => void;
  disabled?: boolean;
  /** Use the single child element (router Link, <a>, …) as the row; its children are replaced by the row content. */
  asChild?: boolean;
  children?: ReactElement;
  className?: string;
}

const interactiveClasses =
  'focus-ring-inset w-full text-left transition-colors duration-150 hover:bg-ink/[0.04] active:bg-ink/[0.08] disabled:pointer-events-none disabled:opacity-40';

export function ListRow({
  icon,
  title,
  description,
  value,
  trailing,
  chevron = false,
  destructive = false,
  onClick,
  disabled,
  asChild = false,
  children,
  className,
}: ListRowProps) {
  const content = (
    <>
      {icon ? (
        <span aria-hidden="true" className={cn('flex size-6 shrink-0 items-center justify-center [&_svg]:size-5', destructive ? 'text-danger' : 'text-ink-2')}>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 py-0.5">
        <span className={cn('block text-body', destructive ? 'text-danger' : 'text-ink')}>{title}</span>
        {description ? <span className="mt-0.5 block text-footnote text-ink-3">{description}</span> : null}
      </span>
      {value ? <span className="max-w-[50%] shrink-0 truncate text-body text-ink-3">{value}</span> : null}
      {trailing}
      {chevron ? <ChevronRight aria-hidden="true" className="-mr-1 size-5 shrink-0 text-ink-3" /> : null}
    </>
  );
  const rowClasses = cn('flex min-h-12 items-center gap-3 px-4 py-2', className);

  let row: ReactNode;
  if (asChild && isValidElement<{ className?: string }>(children)) {
    row = cloneElement(children, { className: cn(rowClasses, interactiveClasses, children.props.className) }, content);
  } else if (onClick) {
    row = (
      <button type="button" onClick={onClick} disabled={disabled} className={cn(rowClasses, interactiveClasses)}>
        {content}
      </button>
    );
  } else {
    row = <div className={rowClasses}>{content}</div>;
  }

  return <ListItem inset={icon ? 'icon' : 'text'}>{row}</ListItem>;
}
