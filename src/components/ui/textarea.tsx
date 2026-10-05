import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { fieldControlClasses } from './input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Visible rows before any typing (default 3). */
  minRows?: number;
  /** Grows with its content up to this many rows, then scrolls (default 10). */
  maxRows?: number;
}

/** Multi-line text field that grows with its content. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, minRows = 3, maxRows = 10, onInput, value, ...props },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, []);

  const resize = useCallback(() => {
    const element = innerRef.current;
    if (!element) return;
    const style = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(style.lineHeight) || 24;
    const chrome =
      Number.parseFloat(style.paddingTop) +
      Number.parseFloat(style.paddingBottom) +
      Number.parseFloat(style.borderTopWidth) +
      Number.parseFloat(style.borderBottomWidth);
    const min = lineHeight * minRows + chrome;
    const max = lineHeight * maxRows + chrome;
    element.style.height = 'auto';
    const content = element.scrollHeight + Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
    element.style.height = `${Math.min(Math.max(content, min), max)}px`;
    element.style.overflowY = content > max ? 'auto' : 'hidden';
  }, [minRows, maxRows]);

  // Re-measure when a controlled value changes (including programmatic resets).
  useLayoutEffect(resize, [resize, value]);

  // Text reflows when the width changes, which changes the height it needs.
  useEffect(() => {
    const element = innerRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    let lastWidth = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== lastWidth) {
        lastWidth = element.clientWidth;
        resize();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [resize]);

  return (
    <textarea
      ref={innerRef}
      rows={minRows}
      value={value}
      onInput={(event) => {
        resize();
        onInput?.(event);
      }}
      className={cn(fieldControlClasses, 'resize-none px-3.5 py-2.5', className)}
      {...props}
    />
  );
});
