import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { SegmentedControl, tabPanelProps } from './segmented-control';

type Sort = 'recent' | 'name' | 'event';

const OPTIONS = [
  { value: 'recent', label: 'Recent' },
  { value: 'name', label: 'Name' },
  { value: 'event', label: 'Event', disabled: true },
] as const;

function RadioHarness() {
  const [value, setValue] = useState<Sort>('recent');
  return <SegmentedControl semantics="radio" aria-label="Sort" value={value} onChange={setValue} options={OPTIONS} />;
}

function TabsHarness() {
  const [value, setValue] = useState<Sort>('recent');
  return (
    <>
      <SegmentedControl semantics="tabs" idBase="sort" aria-label="Sort" value={value} onChange={setValue} options={OPTIONS} />
      <div {...tabPanelProps('sort', value)}>Panel for {value}</div>
    </>
  );
}

describe('SegmentedControl', () => {
  it('exposes radio semantics with a roving tabindex', () => {
    render(<RadioHarness />);
    const group = screen.getByRole('radiogroup', { name: 'Sort' });
    const [recent, name, event] = within(group).getAllByRole('radio');
    expect(recent).toHaveAttribute('aria-checked', 'true');
    expect(name).toHaveAttribute('aria-checked', 'false');
    expect(recent).toHaveAttribute('tabindex', '0');
    expect(name).toHaveAttribute('tabindex', '-1');
    expect(event).toBeDisabled();
  });

  it('moves focus and selection with the arrow keys, Home and End, skipping disabled options', async () => {
    const user = userEvent.setup();
    render(<RadioHarness />);
    const recent = screen.getByRole('radio', { name: 'Recent' });
    const name = screen.getByRole('radio', { name: 'Name' });

    await user.tab();
    expect(recent).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute('aria-checked', 'true');
    expect(name).toHaveAttribute('tabindex', '0');
    expect(recent).toHaveAttribute('tabindex', '-1');

    // "Event" is disabled, so the next stop wraps around to the first option.
    await user.keyboard('{ArrowRight}');
    expect(recent).toHaveFocus();
    expect(recent).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('{ArrowLeft}');
    expect(name).toHaveFocus();

    await user.keyboard('{Home}');
    expect(recent).toHaveFocus();

    await user.keyboard('{End}');
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute('aria-checked', 'true');
  });

  it('links tabs to their panel', async () => {
    const user = userEvent.setup();
    render(<TabsHarness />);
    const tablist = screen.getByRole('tablist', { name: 'Sort' });
    const recent = within(tablist).getByRole('tab', { name: 'Recent' });
    expect(recent).toHaveAttribute('aria-selected', 'true');

    const panel = screen.getByRole('tabpanel', { name: 'Recent' });
    expect(recent).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', recent.id);

    await user.click(within(tablist).getByRole('tab', { name: 'Name' }));
    expect(screen.getByRole('tab', { name: 'Name' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Name' })).toHaveTextContent('Panel for name');
  });
});
