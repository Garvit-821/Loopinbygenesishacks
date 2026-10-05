import type { NotificationList } from '@loopin/shared';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { qk } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';

export interface NotificationsBellProps {
  className?: string;
}

/** Foundation stub with the frozen props (TopBar and Sidebar); the live feature adds the notifications sheet. */
export function NotificationsBell({ className }: NotificationsBellProps) {
  const { data } = useQuery({
    queryKey: qk.notifications,
    queryFn: ({ signal }) => apiFetch<NotificationList>('/notifications', { signal }),
  });
  const unread = data?.unreadCount ?? 0;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      className={cn('relative', className)}
    >
      <Bell />
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger-solid px-1 text-tab text-accent-fg"
        >
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Button>
  );
}
