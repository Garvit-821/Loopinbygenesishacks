import type { EventSummary } from '@loopin/shared';
import { Field, Select } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useEvent, useEvents } from './api';

export interface EventSelectProps {
  /** Selected event id; null = no event. */
  value: string | null;
  onChange(id: string | null): void;
  /** Field label (default "Event"). */
  label?: string;
  className?: string;
}

interface EventGroup {
  label: string;
  events: EventSummary[];
}

function groupEvents(events: readonly EventSummary[], now: number): EventGroup[] {
  const groups: EventGroup[] = [
    { label: 'Happening now', events: [] },
    { label: 'Upcoming', events: [] },
    { label: 'Past', events: [] },
  ];
  for (const event of events) {
    if (event.isActive) groups[0].events.push(event);
    else if (Date.parse(event.endsAt) >= now) groups[1].events.push(event);
    else groups[2].events.push(event);
  }
  return groups.filter((group) => group.events.length > 0);
}

/** Native picker for "which event" (nullable): '' ↔ null. Keeps showing a selected event that isn't in the list. */
export function EventSelect({ value, onChange, label = 'Event', className }: EventSelectProps) {
  const events = useEvents();
  const list = events.data ?? [];
  const missing = value !== null && events.data !== undefined && !list.some((event) => event.id === value);
  const unavailable = events.data === undefined && !events.isLoading;
  const showSelectedOnly = value !== null && (missing || unavailable);
  const selected = useEvent(showSelectedOnly ? value : null);

  return (
    <Field
      label={label}
      className={className}
      hint={unavailable ? "Events couldn't load right now — you can still save without one." : undefined}
    >
      <Select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={events.isLoading}
        aria-busy={events.isLoading || undefined}
      >
        <option value="">{events.isLoading ? 'Loading events…' : 'No event'}</option>
        {groupEvents(list, Date.now()).map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} · {formatDate(event.startsAt)}
              </option>
            ))}
          </optgroup>
        ))}
        {showSelectedOnly ? <option value={value}>{selected.data?.name ?? 'Selected event'}</option> : null}
      </Select>
    </Field>
  );
}
