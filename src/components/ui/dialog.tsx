import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { useKeyboardInset } from '@/lib/useKeyboardInset';
import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const TABBABLE =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function firstTabbable(container: HTMLElement | null): HTMLElement | null {
  return container?.querySelector<HTMLElement>(TABBABLE) ?? null;
}

/** Rendered inside the content, so the keyboard listener only runs while a dialog is actually open. */
function KeyboardInsetWhileOpen() {
  useKeyboardInset();
  return null;
}

type ContentPrimitiveProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content>;

export interface DialogContentProps extends Omit<ContentPrimitiveProps, 'title' | 'children'> {
  /** Required: every dialog is named by a visible (or srOnlyTitle) heading. */
  title: ReactNode;
  /** Keep the title for screen readers but hide it visually. */
  srOnlyTitle?: boolean;
  description?: ReactNode;
  /**
   * Sticky action area (safe-area aware). Pass buttons in [secondary, primary] order: they stack full-width with the
   * primary on top on phones and sit right-aligned on larger screens. For forms, give the submit button `form="<form id>"`.
   */
  footer?: ReactNode;
  /** Width on ≥ sm screens: sm 384px · md 512px (default) · lg 672px. Phones always get a bottom sheet. */
  size?: 'sm' | 'md' | 'lg';
  /** Element to focus when the dialog closes (when it wasn't opened from a DialogTrigger). */
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** false = no close button, Escape and outside clicks are ignored (e.g. while a request is running). */
  dismissible?: boolean;
  bodyClassName?: string;
  children?: ReactNode;
}

const WIDTHS = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' } as const;

/**
 * Bottom sheet below `sm` (positioned above the on-screen keyboard), centered card from `sm` up.
 * Initial focus: the heading on touch devices (no surprise keyboard), else the first field/button
 * (an element with `data-autofocus` or React `autoFocus` wins).
 */
export const DialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(function DialogContent(
  {
    title,
    srOnlyTitle = false,
    description,
    footer,
    size = 'md',
    returnFocusRef,
    dismissible = true,
    className,
    bodyClassName,
    children,
    onOpenAutoFocus,
    onCloseAutoFocus,
    onEscapeKeyDown,
    onInteractOutside,
    ...props
  },
  ref,
) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  // The body only exists while the dialog is open, so it is tracked as state to (re)start the observer below.
  const [bodyNode, setBodyNode] = useState<HTMLDivElement | null>(null);
  const [bodyOverflows, setBodyOverflows] = useState(false);
  const hasBody = children !== undefined && children !== null && children !== false;

  const setPanelRef = useCallback(
    (element: HTMLDivElement | null) => {
      panelRef.current = element;
      if (typeof ref === 'function') ref(element);
      else if (ref) ref.current = element;
    },
    [ref],
  );

  const setBodyRef = useCallback((element: HTMLDivElement | null) => {
    bodyRef.current = element;
    setBodyNode(element);
  }, []);

  // The footer gets a hairline only when the body actually scrolls under it.
  useEffect(() => {
    if (!bodyNode || !footer || typeof ResizeObserver === 'undefined') {
      setBodyOverflows(false);
      return;
    }
    const check = () => setBodyOverflows(bodyNode.scrollHeight > bodyNode.clientHeight + 1);
    const observer = new ResizeObserver(check);
    observer.observe(bodyNode);
    if (bodyNode.firstElementChild) observer.observe(bodyNode.firstElementChild);
    check();
    return () => observer.disconnect();
  }, [bodyNode, footer]);

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        className={cn(
          'fixed inset-0 z-dialog bg-scrim',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          'duration-200 motion-reduce:animate-none',
        )}
      />
      <DialogPrimitive.Content
        ref={setPanelRef}
        {...(description ? {} : { 'aria-describedby': undefined })}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
          const explicit = panelRef.current?.querySelector<HTMLElement>('[data-autofocus]');
          const target = explicit ?? (coarsePointer ? null : (firstTabbable(bodyRef.current) ?? firstTabbable(footerRef.current)));
          (target ?? titleRef.current)?.focus();
        }}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          const target = returnFocusRef?.current;
          if (target) {
            event.preventDefault();
            target.focus();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (!dismissible) event.preventDefault();
          onEscapeKeyDown?.(event);
        }}
        onInteractOutside={(event) => {
          if (!dismissible) event.preventDefault();
          onInteractOutside?.(event);
        }}
        className={cn(
          'fixed z-dialog flex flex-col bg-surface text-ink shadow-raised outline-none',
          // Phones: bottom sheet above the keyboard.
          'inset-x-0 bottom-kb max-h-sheet rounded-t-hero',
          'max-sm:data-[state=open]:animate-in max-sm:data-[state=open]:slide-in-from-bottom',
          'max-sm:data-[state=closed]:animate-out max-sm:data-[state=closed]:slide-out-to-bottom',
          // ≥ sm: centered card (inset + auto margins + fit-content height centers without transforms).
          'sm:inset-0 sm:m-auto sm:h-fit sm:max-h-[85dvh] sm:w-[calc(100%-2rem)] sm:rounded-hero',
          'sm:data-[state=open]:animate-in sm:data-[state=open]:fade-in-0 sm:data-[state=open]:zoom-in-95',
          'sm:data-[state=closed]:animate-out sm:data-[state=closed]:fade-out-0 sm:data-[state=closed]:zoom-out-95',
          'duration-250 ease-ios motion-reduce:animate-none',
          WIDTHS[size],
          className,
        )}
        {...props}
      >
        <KeyboardInsetWhileOpen />
        <div
          className={cn(
            'relative shrink-0 px-5 pt-2 sm:pt-5',
            srOnlyTitle && !description ? 'min-h-14 pb-0' : 'pb-3',
            !hasBody && !footer && 'pb-safe-or-5 sm:pb-5',
          )}
        >
          <div aria-hidden="true" className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-line sm:hidden" />
          <DialogPrimitive.Title
            ref={titleRef}
            tabIndex={-1}
            className={cn('text-title text-ink outline-none', dismissible && 'pr-10', srOnlyTitle && 'sr-only')}
          >
            {title}
          </DialogPrimitive.Title>
          {description ? (
            <DialogPrimitive.Description className={cn('mt-1 text-callout text-ink-2', dismissible && srOnlyTitle && 'pr-10')}>
              {description}
            </DialogPrimitive.Description>
          ) : null}
          {dismissible ? (
            <DialogPrimitive.Close
              aria-label="Close"
              className="focus-ring absolute right-2.5 top-3.5 grid size-11 place-items-center rounded-full text-ink-2 hover:text-ink sm:top-3"
            >
              <span className="grid size-[30px] place-items-center rounded-full bg-surface-3 transition-colors">
                <X aria-hidden="true" className="size-4" strokeWidth={2.5} />
              </span>
            </DialogPrimitive.Close>
          ) : null}
        </div>
        {hasBody ? (
          <div
            ref={setBodyRef}
            className={cn(
              'min-h-0 flex-1 overflow-y-auto overscroll-contain px-5',
              footer ? 'pb-4' : 'pb-safe-or-5 sm:pb-5',
              bodyClassName,
            )}
          >
            {children}
          </div>
        ) : null}
        {footer ? (
          <div
            ref={footerRef}
            className={cn(
              'flex shrink-0 flex-col-reverse gap-2 border-t px-5 pb-safe-or-4 pt-3 sm:flex-row sm:justify-end sm:pb-5',
              bodyOverflows ? 'border-line-soft' : 'border-transparent',
            )}
          >
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});
