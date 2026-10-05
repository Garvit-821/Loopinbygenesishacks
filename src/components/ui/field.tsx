import { CircleAlert } from 'lucide-react';
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

/** Props Field wires onto its control. */
export interface FieldControlProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: true;
  'aria-required'?: true;
}

export interface FieldProps {
  label: ReactNode;
  /** Help text under the control (linked with aria-describedby). */
  hint?: ReactNode;
  /** Error message (linked with aria-describedby; sets aria-invalid). */
  error?: string | null;
  /** Sets aria-required on the control. Required fields carry no visual marker; mark the optional ones instead. */
  required?: boolean;
  /** Appends a muted "Optional" to the label. */
  optional?: boolean;
  /** Right side of the label row, e.g. a character counter or a "Forgot password?" link. */
  accessory?: ReactNode;
  /** Visually hide the label (it stays the control's accessible name). */
  srOnlyLabel?: boolean;
  /** Control id (defaults to the child's id, else a generated one). */
  id?: string;
  className?: string;
  /**
   * A single control element (Input, Textarea, Select, TagInput, Switch…), which receives the wiring props;
   * or a render function for composite controls: `(control) => <MyControl {...control} />`.
   */
  children: ReactElement | ((control: FieldControlProps & { labelId: string }) => ReactNode);
}

/** Label + control + hint/error, with id / aria-describedby / aria-invalid / aria-required wired up. */
export function Field({ label, hint, error, required, optional, accessory, srOnlyLabel, id: idProp, className, children }: FieldProps) {
  const generatedId = useId();
  const childProps = isValidElement(children) ? (children.props as { id?: string; 'aria-describedby'?: string }) : undefined;
  const id = idProp ?? childProps?.id ?? `field${generatedId.replace(/:/g, '')}`;
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const control: FieldControlProps = {
    id,
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
    ...(error ? { 'aria-invalid': true as const } : {}),
    ...(required ? { 'aria-required': true as const } : {}),
  };

  let content: ReactNode;
  if (typeof children === 'function') {
    content = children({ ...control, labelId });
  } else {
    const ownDescribedBy = childProps?.['aria-describedby'];
    content = cloneElement(children, {
      ...control,
      'aria-describedby': [ownDescribedBy, describedBy].filter(Boolean).join(' ') || undefined,
    } as Partial<FieldControlProps>);
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className={cn('flex min-h-5 items-baseline justify-between gap-3', srOnlyLabel && !accessory && 'sr-only')}>
        <Label id={labelId} htmlFor={id} className={cn(srOnlyLabel && 'sr-only')}>
          {label}
          {/* The space keeps "Website Optional" two words for screen readers. */}
          {optional ? <span className="ml-0.5 font-normal text-ink-3"> Optional</span> : null}
        </Label>
        {accessory ? <div className="shrink-0 text-footnote text-ink-3">{accessory}</div> : null}
      </div>
      {content}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-footnote text-danger">
          <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className="text-footnote text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
