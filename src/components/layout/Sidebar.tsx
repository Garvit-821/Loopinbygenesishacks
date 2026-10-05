import { formatHandle } from '@loopin/shared';
import { IdCard, LayoutDashboard, QrCode, Radio, Settings, Users, type LucideIcon } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { Avatar } from '@/components/common/Avatar';
import { Logo } from '@/components/common/Logo';
import { useLiveIndicator } from '@/features/live/api';
import { NotificationsBell } from '@/features/live/NotificationsBell';
import { hasRole, useMe } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface SidebarLinkProps {
  to: string;
  label: string;
  icon: LucideIcon;
  dot?: boolean;
}

function SidebarLink({ to, label, icon: Icon, dot = false }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'focus-ring flex h-11 items-center gap-3 rounded-input px-3 text-callout font-medium transition-colors duration-150',
          isActive ? 'bg-accent/10 text-accent-ink' : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
        )
      }
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <span className="flex-1">{label}</span>
      {dot ? (
        <>
          <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
          <span className="sr-only">, new updates</span>
        </>
      ) : null}
    </NavLink>
  );
}

/** Desktop navigation column: logo + notifications, destinations (Organizer for organizers), and the account card. */
export function Sidebar() {
  const user = useMe();
  const liveDot = useLiveIndicator();

  return (
    <aside className="fixed inset-y-0 left-0 z-bar hidden w-64 flex-col border-r border-line-soft bg-surface pb-4 pt-safe md:flex">
      <div className="flex h-16 shrink-0 items-center justify-between pl-4 pr-2">
        <Link to="/passport" className="focus-ring -m-1 flex items-center rounded-input p-1" aria-label="Loopin, your passport">
          <Logo size="sm" />
        </Link>
        <NotificationsBell />
      </div>

      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="flex flex-col gap-0.5">
          <li>
            <SidebarLink to="/passport" label="Passport" icon={IdCard} />
          </li>
          <li>
            <SidebarLink to="/network" label="Network" icon={Users} />
          </li>
          <li>
            <SidebarLink to="/exchange" label="Exchange" icon={QrCode} />
          </li>
          <li>
            <SidebarLink to="/live" label="Live" icon={Radio} dot={liveDot} />
          </li>
          {hasRole(user, 'organizer') ? (
            <li>
              <SidebarLink to="/organizer" label="Organizer" icon={LayoutDashboard} />
            </li>
          ) : null}
        </ul>
      </nav>

      <div className="shrink-0 px-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'focus-ring flex items-center gap-3 rounded-card p-2 transition-colors duration-150',
              isActive ? 'bg-accent/10' : 'hover:bg-surface-3',
            )
          }
        >
          <span className="sr-only">Settings, </span>
          <Avatar src={user.avatarUrl} name={user.name} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-callout font-semibold text-ink">{user.name}</span>
            <span className="block truncate text-footnote text-ink-2">{formatHandle(user.handle)}</span>
          </span>
          <Settings aria-hidden="true" className="size-5 shrink-0 text-ink-3" />
        </NavLink>
      </div>
    </aside>
  );
}
