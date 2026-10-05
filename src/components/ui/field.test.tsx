import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field } from './field';
import { Input } from './input';
import { Textarea } from './textarea';

describe('Field', () => {
  it('labels the control and links the error and hint', () => {
    render(
      <Field label="Handle" hint="3–24 lowercase letters, numbers or underscores" error="That handle is taken" required>
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Handle');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAccessibleDescription('That handle is taken 3–24 lowercase letters, numbers or underscores');
  });

  it('adds no aria-invalid or aria-describedby when there is nothing to describe', () => {
    render(
      <Field label="Name">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Name');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(input).not.toHaveAttribute('aria-required');
  });

  it("keeps the child's own id and aria-describedby", () => {
    render(
      <>
        <p id="privacy-note">Never shown publicly</p>
        <Field label="Email" hint="Used to sign in">
          <Input id="email" aria-describedby="privacy-note" />
        </Field>
      </>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('id', 'email');
    expect(input).toHaveAttribute('aria-describedby', 'privacy-note email-hint');
    expect(input).toHaveAccessibleDescription('Never shown publicly Used to sign in');
  });

  it('wires textareas the same way', () => {
    render(
      <Field label="Private note" error="Keep it under 2001 characters">
        <Textarea />
      </Field>,
    );
    expect(screen.getByLabelText('Private note')).toHaveAccessibleDescription('Keep it under 2001 characters');
  });

  it('passes wiring to render functions for composite controls', () => {
    render(
      <Field label="Visibility" error="Pick one">
        {({ labelId, ...control }) => <div role="radiogroup" aria-labelledby={labelId} {...control} />}
      </Field>,
    );
    const group = screen.getByRole('radiogroup', { name: 'Visibility' });
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).toHaveAccessibleDescription('Pick one');
  });

  it('marks optional fields in the label', () => {
    render(
      <Field label="Website" optional>
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Website Optional')).toBeInTheDocument();
  });
});
