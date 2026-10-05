import type { Announcement } from '@loopin/shared';
import { Card } from '@/components/ui';
import { timeAgo } from '@/lib/format';

export interface AnnouncementCardProps {
  announcement: Announcement;
  /** Shows a delete action (organizer views). */
  onDelete?: () => void;
  /** Denser layout for previews and lists. */
  compact?: boolean;
}

/** Foundation stub with the frozen props; the live feature replaces it (kind badge, action button, author, delete). */
export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  return (
    <Card asChild>
      <article>
        <h3 className="text-headline text-ink">{announcement.title}</h3>
        <p className="mt-1 whitespace-pre-line text-callout text-ink-2">{announcement.body}</p>
        <p className="mt-2 text-footnote text-ink-3">
          <time dateTime={announcement.createdAt}>{timeAgo(announcement.createdAt)}</time>
        </p>
      </article>
    </Card>
  );
}
