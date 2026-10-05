import { X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PlaceholderPage } from '@/components/layout/PlaceholderPage';
import { Button } from '@/components/ui';

export default function DoorPage() {
  const { eventId = '' } = useParams();
  return (
    <main id="main" tabIndex={-1} className="min-h-dvh bg-canvas pb-safe pt-safe outline-none">
      <div className="flex justify-end px-safe-offset-2 pt-2">
        <Button asChild variant="ghost" size="icon" aria-label="Exit door mode">
          <Link to={`/organizer/events/${encodeURIComponent(eventId)}`}>
            <X />
          </Link>
        </Button>
      </div>
      <PlaceholderPage
        title="Door check-in"
        description="Full-screen check-in for the door: scan codes and stamp attendees fast."
      />
    </main>
  );
}
