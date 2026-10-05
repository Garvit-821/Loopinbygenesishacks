import { IdCard, QrCode, Radio, Users, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { useLiveIndicator } from '@/features/live/api';
import { useMe } from '@/lib/auth';
import { cn } from '@/lib/utils';

const TAB_CLASSES = 'focus-ring-inset flex h-full flex-col items-center justify-center gap-1 rounded-input text-tab';

interface TabLinkProps {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Unseen updates (Live). */
  dot?: boolean;
}

function TabLink({ to, label, icon: Icon, dot = false }: TabLinkProps) {
  return (
    <NavLink to={to} className={({ isActive }) => cn(TAB_CLASSES, isActive ? 'text-accent-ink' : 'text-ink-2')}>
      {({ isActive }) => (
        <>
          <span className="relative">
            <Icon aria-hidden="true" className="size-6" strokeWidth={isActive ? 2.25 : 1.75} />
            {dot ? <span aria-hidden="true" className="absolute -right-1 -top-0.5 size-2.5 rounded-full bg-accent ring-2 ring-canvas" /> : null}
          </span>
          <span>
            {label}
            {dot ? <span className="sr-only">, new updates</span> : null}
          </span>
        </>
      )}
    </NavLink>
  );
}

/** Phones: fixed frosted tab bar with the raised Exchange button in the middle. */
export function TabBar() {
  const user = useMe();
  const liveDot = useLiveIndicator();

  return (
    <nav aria-label="Primary" className="frosted fixed inset-x-0 bottom-0 z-bar border-t border-line-soft pb-safe px-safe md:hidden">
      <ul className="mx-auto grid h-14 max-w-lg grid-cols-5">
        <li>
          <TabLink to="/passport" label="Passport" icon={IdCard} />
        </li>
        <li>
          <TabLink to="/network" label="Network" icon={Users} />
        </li>
        <li>
          <NavLink
            to="/exchange"
            className={({ isActive }) =>
              cn('group relative flex h-full flex-col items-center justify-center gap-1 text-tab outline-none', isActive ? 'text-accent-ink' : 'text-ink-2')
            }
          >
            <span
              aria-hidden="true"
              className="absolute -top-6 left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-full bg-accent text-accent-fg shadow-raised transition-transform duration-150 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-canvas group-active:scale-95 motion-reduce:transition-none"
            >
              <QrCode className="size-7" strokeWidth={2} />
            </span>
            <span aria-hidden="true" className="size-6" />
            <span>Exchange</span>
          </NavLink>
        </li>
        <li>
          <TabLink to="/live" label="Live" icon={Radio} dot={liveDot} />
        </li>
        <li>
          <NavLink to="/settings" className={({ isActive }) => cn(TAB_CLASSES, isActive ? 'text-accent-ink' : 'text-ink-2')}>
            {({ isActive }) => (
              <>
                <Avatar
                  src={user.avatarUrl}
                  name={user.name}
                  size="xs"
                  className={cn(isActive && 'ring-2 ring-accent ring-offset-1 ring-offset-canvas')}
                />
                <span>Settings</span>
              </>
            )}
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
