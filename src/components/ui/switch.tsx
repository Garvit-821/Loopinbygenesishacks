import * as SwitchPrimitive from '@radix-ui/react-switch';
import { forwardRef, useId, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type SwitchProps = ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

/** On/off toggle (Radix). Label it with <Label htmlFor>, Field, or use SwitchField for a full row. */
export const Switch = forwardRef<ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(function Switch({ className, ...props }, ref) {
  return (
    <SwitchPrimitive.Root
      ref={ref}
      className={cn(
        'focus-ring relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full p-0.5',
        'transition-colors duration-200 data-[state=checked]:bg-accent data-[state=unchecked]:bg-line-strong',
        'disabled:cursor-not-allowed disabled:opacity-40',
        // Expand the touch target to 44px without changing the visual size.
        "before:absolute before:-inset-x-1 before:-inset-y-[7px] before:content-['']",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block size-[27px] rounded-full bg-accent-fg shadow-thumb',
          'transition-transform duration-200 ease-ios data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 motion-reduce:transition-none',
        )}
      />
    </SwitchPrimitive.Root>
  );
});

export interface SwitchFieldProps extends Omit<SwitchProps, 'children'> {
  label: ReactNode;
  description?: ReactNode;
}

/** A full-width row: label (+ description) on the left, switch on the right; the whole row toggles. */
export const SwitchField = forwardRef<ElementRef<typeof SwitchPrimitive.Root>, SwitchFieldProps>(function SwitchField(
  { label, description, className, id: idProp, ...props },
  ref,
) {
  const generatedId = useId();
  const id = idProp ?? `switch${generatedId.replace(/:/g, '')}`;
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <div className={cn('flex min-h-11 items-center justify-between gap-4', className)}>
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer py-1">
        <span className="block text-body text-ink">{label}</span>
        {description ? (
          <span id={descriptionId} className="mt-0.5 block text-footnote text-ink-3">
            {description}
          </span>
        ) : null}
      </label>
      <Switch ref={ref} id={id} aria-describedby={descriptionId} {...props} />
    </div>
  );
});
