import { Plus } from 'lucide-react';
import { useId, useMemo, useRef, useState, type ClipboardEvent, type FocusEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Chip } from './chip';

export interface TagSuggestion {
  value: string;
  /** Shown instead of the value (e.g. "Ananya Iyer · @ananya_ml"); also searched. */
  label?: string;
}

export interface TagInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  /** Offered below the field, filtered by what's typed; already-added values are hidden. */
  suggestions?: readonly (string | TagSuggestion)[];
  /** Maximum number of tags. */
  max?: number;
  /** Maximum characters per tag. */
  maxLength?: number;
  placeholder?: string;
  /** Clean up typed text; return null to reject it. Default: trim and collapse whitespace. */
  normalize?: (raw: string) => string | null;
  /** How a stored value is displayed in its chip (e.g. handles as "@handle"). */
  formatTag?: (value: string) => string;
  /** How many suggestions to show at once (default 8). */
  maxSuggestions?: number;
  disabled?: boolean;
  className?: string;
  /** Wiring from Field (applied to the text input). */
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
  'aria-required'?: boolean | 'true' | 'false';
  'aria-label'?: string;
}

const defaultNormalize = (raw: string) => raw.trim().replace(/\s+/g, ' ') || null;

function toSuggestion(item: string | TagSuggestion): Required<TagSuggestion> {
  return typeof item === 'string' ? { value: item, label: item } : { value: item.value, label: item.label ?? item.value };
}

/** Free-form tags as removable chips. Enter or comma adds, Backspace on an empty field removes the last one. */
export function TagInput({
  value,
  onChange,
  suggestions = [],
  max,
  maxLength,
  placeholder = 'Add a tag',
  normalize = defaultNormalize,
  formatTag = (tag) => tag,
  maxSuggestions = 8,
  disabled,
  className,
  id,
  'aria-describedby': describedBy,
  ...aria
}: TagInputProps) {
  const [draft, setDraft] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const instructionsId = `tags${useId().replace(/:/g, '')}`;
  const atMax = max !== undefined && value.length >= max;

  const taken = useMemo(() => new Set(value.map((tag) => tag.toLowerCase())), [value]);

  const visibleSuggestions = useMemo(() => {
    if (atMax) return [];
    const query = draft.trim().toLowerCase();
    return suggestions
      .map(toSuggestion)
      .filter((item, index, all) => all.findIndex((other) => other.value.toLowerCase() === item.value.toLowerCase()) === index)
      .filter((item) => !taken.has(item.value.toLowerCase()))
      .filter((item) => !query || item.label.toLowerCase().includes(query) || item.value.toLowerCase().includes(query))
      .slice(0, maxSuggestions);
  }, [atMax, draft, suggestions, taken, maxSuggestions]);

  /** Adds the given raw values in one change. `invalid` counts values the normalizer rejected. */
  const addMany = (raws: string[]): { added: number; invalid: number } => {
    const next = [...value];
    const seen = new Set(taken);
    const added: string[] = [];
    let invalid = 0;
    let rejectedForLimit = false;
    for (const raw of raws) {
      if (!raw.trim()) continue;
      const tag = normalize(raw);
      if (!tag) {
        invalid += 1;
        continue;
      }
      if (seen.has(tag.toLowerCase())) continue;
      if (max !== undefined && next.length >= max) {
        rejectedForLimit = true;
        break;
      }
      next.push(tag);
      seen.add(tag.toLowerCase());
      added.push(tag);
    }
    if (added.length > 0) {
      onChange(next);
      setAnnouncement(`Added ${added.map(formatTag).join(', ')}`);
    } else if (rejectedForLimit) {
      setAnnouncement(`You can add up to ${max}`);
    } else if (invalid > 0) {
      setAnnouncement(raws.length === 1 ? `Can't add “${raws[0].trim()}”` : `Some entries couldn't be added`);
    }
    return { added: added.length, invalid };
  };

  const remove = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
    setAnnouncement(`Removed ${formatTag(tag)}`);
    inputRef.current?.focus();
  };

  const commitDraft = () => {
    if (!draft.trim()) return;
    // Text the normalizer rejects stays in the field so it can be corrected.
    if (addMany([draft]).invalid === 0) setDraft('');
  };

  const onBlur = (event: FocusEvent<HTMLInputElement>) => {
    // Moving to a chip or suggestion inside the component keeps the draft; leaving the component commits it.
    if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return;
    commitDraft();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' || event.key === ',') {
      // Never submit the surrounding form while typing a tag.
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      event.preventDefault();
      remove(value[value.length - 1]);
    }
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData('text');
    if (!/[,\n]/.test(text)) return;
    event.preventDefault();
    addMany(text.split(/[,\n]/));
  };

  return (
    <div ref={rootRef} className={cn('flex flex-col gap-2.5', className)}>
      <div
        className={cn(
          'flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-input border border-line-strong bg-surface px-1.5 py-1.5',
          'transition-[border-color,box-shadow] duration-150',
          'focus-within:border-accent focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-surface',
          aria['aria-invalid'] === true || aria['aria-invalid'] === 'true' ? 'border-danger' : null,
          disabled && 'cursor-not-allowed bg-surface-2',
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.length > 0 ? (
          <ul role="list" className="contents">
            {value.map((tag) => (
              <li key={tag} className="flex max-w-full">
                <Chip size="sm" onRemove={() => remove(tag)} removeLabel={`Remove ${formatTag(tag)}`} disabled={disabled}>
                  {formatTag(tag)}
                </Chip>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={draft}
          disabled={disabled || atMax}
          maxLength={maxLength}
          placeholder={atMax ? `Up to ${max}` : placeholder}
          enterKeyHint="enter"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={onBlur}
          aria-describedby={[describedBy, instructionsId].filter(Boolean).join(' ')}
          className="h-8 min-w-[8ch] flex-1 bg-transparent px-2 text-body text-ink outline-none placeholder:text-ink-3 disabled:cursor-not-allowed"
          {...aria}
        />
      </div>
      {visibleSuggestions.length > 0 ? (
        <div role="group" aria-label="Suggestions" className="flex flex-wrap gap-2">
          {visibleSuggestions.map((item) => (
            <button
              key={item.value}
              type="button"
              disabled={disabled}
              // Keep focus in the text field so a half-typed draft isn't committed by its blur.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                addMany([item.value]);
                setDraft('');
                inputRef.current?.focus();
              }}
              className={cn(
                'focus-ring inline-flex h-8 max-w-full items-center gap-1 rounded-full border border-dashed border-line-strong px-3 text-footnote font-medium text-ink-2',
                'transition-colors duration-150 hover:border-solid hover:bg-surface-2 hover:text-ink disabled:opacity-40',
              )}
            >
              <Plus aria-hidden="true" className="-ml-0.5 size-3.5 shrink-0" strokeWidth={2.5} />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      ) : null}
      <span id={instructionsId} className="sr-only">
        Press Enter or comma to add. Backspace removes the last one.
      </span>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
