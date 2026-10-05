import { handleLookupSchema } from '@loopin/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { TagInput, type TagInputProps } from './tag-input';

function Harness({ initial = [], ...props }: Partial<TagInputProps> & { initial?: string[] }) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <>
      <TagInput aria-label="Tags" {...props} value={value} onChange={setValue} />
      <output data-testid="value">{value.join('|')}</output>
    </>
  );
}

const valueText = () => screen.getByTestId('value').textContent;

describe('TagInput', () => {
  it('adds tags on Enter and comma, trimming and skipping case-insensitive duplicates', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Tags' });

    await user.type(input, '  Follow   up {Enter}');
    await user.type(input, 'Rust,');
    await user.type(input, 'rust{Enter}');

    expect(valueText()).toBe('Follow up|Rust');
    expect(input).toHaveValue('');
  });

  it('removes a tag with its chip button and the last tag with Backspace', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Teammate', 'Mentor', 'Hiring']} />);

    await user.click(screen.getByRole('button', { name: 'Remove Mentor' }));
    expect(valueText()).toBe('Teammate|Hiring');

    await user.click(screen.getByRole('textbox', { name: 'Tags' }));
    await user.keyboard('{Backspace}');
    expect(valueText()).toBe('Teammate');
  });

  it('offers suggestions that are not added yet, filtered by the text typed', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['Teammate']} suggestions={['Follow up', 'Teammate', 'Mentor']} />);
    const suggestions = screen.getByRole('group', { name: 'Suggestions' });
    expect(within(suggestions).queryByRole('button', { name: 'Teammate' })).not.toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Tags' }), 'men');
    expect(within(suggestions).queryByRole('button', { name: 'Follow up' })).not.toBeInTheDocument();

    await user.click(within(suggestions).getByRole('button', { name: 'Mentor' }));
    expect(valueText()).toBe('Teammate|Mentor');
    // The half-typed draft is replaced by the suggestion, not committed on blur.
    expect(screen.getByRole('textbox', { name: 'Tags' })).toHaveValue('');
  });

  it('stops accepting tags at the maximum', () => {
    render(<Harness initial={['One', 'Two']} max={2} suggestions={['Three']} />);
    const input = screen.getByRole('textbox', { name: 'Tags' });
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute('placeholder', 'Up to 2');
    expect(screen.queryByRole('group', { name: 'Suggestions' })).not.toBeInTheDocument();
  });

  it('uses a custom normalizer and rejects what it returns null for', async () => {
    const user = userEvent.setup();
    const normalize = (raw: string) => {
      const parsed = handleLookupSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    };
    render(<Harness normalize={normalize} formatTag={(handle) => `@${handle}`} />);
    const input = screen.getByRole('textbox', { name: 'Tags' });

    await user.type(input, '@Ananya_ML{Enter}');
    await user.type(input, 'not a handle!{Enter}');

    expect(valueText()).toBe('ananya_ml');
    expect(screen.getByRole('button', { name: 'Remove @ananya_ml' })).toBeInTheDocument();
    // Rejected text stays in the field so it can be fixed.
    expect(input).toHaveValue('not a handle!');
  });
});
