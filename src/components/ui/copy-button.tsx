import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { copyToClipboard } from '@/lib/utils';
import { Button, type ButtonVariant } from './button';

export interface CopyButtonProps {
  /** Exact text to copy. */
  value: string;
  /** Visible label (or the accessible name when iconOnly). */
  label?: string;
  copiedLabel?: string;
  iconOnly?: boolean;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  className?: string;
  onCopied?: () => void;
}

/** Copies `value`; confirms with a checkmark for 2 s (announced to screen readers) or toasts on failure. */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  iconOnly = false,
  variant = 'secondary',
  size = 'sm',
  className,
  onCopied,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const handleCopy = async () => {
    if (await copyToClipboard(value)) {
      setCopied(true);
      onCopied?.();
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Couldn't copy", { description: 'Select the text and copy it manually.' });
    }
  };

  const icon = copied ? <Check aria-hidden="true" strokeWidth={2.5} /> : <Copy aria-hidden="true" />;

  return (
    <>
      {iconOnly ? (
        <Button variant={variant} size="icon" aria-label={copied ? copiedLabel : label} onClick={() => void handleCopy()} className={className}>
          {icon}
        </Button>
      ) : (
        <Button variant={variant} size={size} onClick={() => void handleCopy()} className={className}>
          {icon}
          {copied ? copiedLabel : label}
        </Button>
      )}
      <span role="status" className="sr-only">
        {copied ? copiedLabel : ''}
      </span>
    </>
  );
}
