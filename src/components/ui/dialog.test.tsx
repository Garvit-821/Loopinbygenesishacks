import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog, DialogContent } from './dialog';

function mockPointer(coarse: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string): MediaQueryList => ({
      matches: coarse && query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  );
}

describe('Dialog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is named by its title and described by its description', () => {
    render(
      <Dialog open>
        <DialogContent title="Edit note" description="Only you can see this.">
          <p>Body</p>
        </DialogContent>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName('Edit note');
    expect(dialog).toHaveAccessibleDescription('Only you can see this.');
  });

  it('keeps a visually hidden title as the accessible name', () => {
    render(
      <Dialog open>
        <DialogContent title="Scan a code" srOnlyTitle>
          <p>Camera</p>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Scan a code');
    expect(screen.getByRole('heading', { name: 'Scan a code' })).toHaveClass('sr-only');
  });

  it('requires a title at the type level', () => {
    // @ts-expect-error — `title` is required on DialogContent.
    const untitled = <DialogContent>Body</DialogContent>;
    expect(untitled.props).not.toHaveProperty('title');
  });

  it('closes from the visible close button', async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent title="Edit note">Body</DialogContent>
      </Dialog>,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('has no close button when it is not dismissible', () => {
    render(
      <Dialog open>
        <DialogContent title="Connecting…" dismissible={false}>
          Body
        </DialogContent>
      </Dialog>,
    );
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('focuses the heading on touch devices so the keyboard does not pop up', () => {
    mockPointer(true);
    render(
      <Dialog open>
        <DialogContent title="Edit note">
          <input aria-label="Note" />
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('heading', { name: 'Edit note' })).toHaveFocus();
  });

  it('focuses the first field with a mouse and keyboard', () => {
    mockPointer(false);
    render(
      <Dialog open>
        <DialogContent title="Edit note">
          <input aria-label="Note" />
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveFocus();
  });
});
