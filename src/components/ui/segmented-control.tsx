import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface SegmentedControlBaseProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  'aria-label': string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * `radio` for a choice that filters/sorts in place (radiogroup); `tabs` when each option shows its own panel
 * (tablist — render panels with tabPanelProps(idBase, value), so idBase is required).
 */
export type SegmentedControlProps<T extends string> = SegmentedControlBaseProps<T> &
  ({ semantics: 'radio'; idBase?: string } | { semantics: 'tabs'; idBase: string });

const safeIdPart = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, '_');
const tabId = (idBase: string, value: string) => `${idBase}-tab-${safeIdPart(value)}`;
const panelId = (idBase: string, value: string) => `${idBase}-panel-${safeIdPart(value)}`;

/** Props for the panel of the selected tab: `<div {...tabPanelProps('exchange', mode)}>…</div>`. */
export function tabPanelProps(idBase: string, value: string) {
  return {
    role: 'tabpanel' as const,
    id: panelId(idBase, value),
    'aria-labelledby': tabId(idBase, value),
    tabIndex: 0,
  };
}

const SIZES = {
  sm: { track: 'h-9', segment: 'text-footnote' },
  md: { track: 'h-11', segment: 'text-callout' },
} as const;

/** iOS-style segmented control: roving tabindex, arrow keys (and Home/End) move and select. */
export function SegmentedControl<T extends string>(props: SegmentedControlProps<T>) {
  const { value, onChange, options, size = 'md', className, semantics } = props;
  const idBase = props.idBase;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const focusableIndex =
    selectedIndex !== -1 && !options[selectedIndex].disabled ? selectedIndex : options.findIndex((option) => !option.disabled);

  const select = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    buttons.current[index]?.focus();
    if (option.value !== value) onChange(option.value);
  };

  const step = (from: number, direction: 1 | -1) => {
    for (let offset = 1; offset <= options.length; offset++) {
      const index = (from + direction * offset + options.length) % options.length;
      if (!options[index].disabled) return index;
    }
    return from;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') target = step(index, 1);
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') target = step(index, -1);
    else if (event.key === 'Home') target = step(-1, 1);
    else if (event.key === 'End') target = step(options.length, -1);
    if (target === null) return;
    event.preventDefault();
    select(target);
  };

  const count = Math.max(options.length, 1);

  return (
    <div
      role={semantics === 'tabs' ? 'tablist' : 'radiogroup'}
      aria-label={props['aria-label']}
      aria-orientation={semantics === 'tabs' ? 'horizontal' : undefined}
      className={cn('relative flex w-full rounded-full bg-surface-3 p-1 dark:bg-surface-2', SIZES[size].track, className)}
    >
      {selectedIndex !== -1 ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 rounded-full bg-thumb shadow-thumb transition-transform duration-250 ease-ios motion-reduce:transition-none"
          style={{ width: `calc((100% - 0.5rem) / ${count})`, transform: `translateX(${selectedIndex * 100}%)` }}
        />
      ) : null}
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        const semanticProps =
          semantics === 'tabs' && idBase
            ? {
                role: 'tab' as const,
                id: tabId(idBase, option.value),
                'aria-selected': isSelected,
                'aria-controls': panelId(idBase, option.value),
              }
            : { role: 'radio' as const, 'aria-checked': isSelected };
        return (
          <button
            key={option.value}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            type="button"
            {...semanticProps}
            tabIndex={index === focusableIndex ? 0 : -1}
            disabled={option.disabled}
            onClick={() => select(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'focus-ring-inset relative z-10 flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-3 transition-colors duration-150',
              SIZES[size].segment,
              isSelected ? 'font-semibold text-ink' : 'font-medium text-ink-2 hover:text-ink',
              'disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0',
            )}
          >
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
