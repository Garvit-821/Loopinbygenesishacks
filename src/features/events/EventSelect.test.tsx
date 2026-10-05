import type { EventList, EventSummary } from '@loopin/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventSelect } from './EventSelect';

function makeEvent(overrides: Partial<EventSummary>): EventSummary {
  return {
    id: 'e-1',
    slug: 'genesis-hacks-2026',
    name: 'Genesis Hacks 2026',
    kind: 'hackathon',
    location: 'Bengaluru',
    startsAt: '2026-10-04T04:30:00.000Z',
    endsAt: '2099-10-06T12:30:00.000Z',
    isActive: true,
    tagline: '',
    description: '',
    rsvpCount: 0,
    myRsvp: false,
    ...overrides,
  };
}

const events: EventList = {
  events: [
    makeEvent({}),
    makeEvent({ id: 'e-2', slug: 'winter', name: 'Genesis Winter Invitational', isActive: false, startsAt: '2099-11-19T04:30:00.000Z' }),
    makeEvent({ id: 'e-3', slug: 'pune', name: 'Hackers Occupied Pune', isActive: false, endsAt: '2026-06-07T12:30:00.000Z' }),
  ],
};

const fetchMock = vi.fn<typeof fetch>();

function renderSelect(value: string | null, onChange = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EventSelect value={value} onChange={onChange} label="Met at" />
    </QueryClientProvider>,
  );
  return onChange;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe('EventSelect', () => {
  it('groups events and maps the empty option to null', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(events), { status: 200 }));
    const onChange = renderSelect('e-1');
    const select = screen.getByLabelText('Met at');
    await waitFor(() => expect(select).not.toBeDisabled());

    expect(screen.getByRole('group', { name: 'Happening now' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Upcoming' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Past' })).toBeInTheDocument();
    expect(select).toHaveValue('e-1');

    await userEvent.selectOptions(select, 'No event');
    expect(onChange).toHaveBeenLastCalledWith(null);
    await userEvent.selectOptions(select, screen.getByRole('option', { name: /Hackers Occupied Pune/ }));
    expect(onChange).toHaveBeenLastCalledWith('e-3');
  });

  it('keeps showing a selected event that is not in the list', async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/events')
        ? new Response(JSON.stringify(events), { status: 200 })
        : new Response(JSON.stringify({ event: makeEvent({ id: 'e-old', name: 'Genesis Hacks 2024', isActive: false }) }), { status: 200 }),
    );
    renderSelect('e-old');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Genesis Hacks 2024' })).toBeInTheDocument());
    expect(screen.getByLabelText('Met at')).toHaveValue('e-old');
  });
});
