import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';
import { useTheme } from '@/lib/theme';
import { Spinner } from './spinner';

export { toast } from 'sonner';

/**
 * App-wide toast host (sonner), themed with Loopin tokens. Render once inside ThemeProvider.
 * Usage anywhere: `toast.success('Saved to your network')`, `toast('Title', { description, action: { label, onClick } })`.
 */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      theme={resolvedTheme}
      position="top-center"
      offset={16}
      mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 8px)', left: '12px', right: '12px' }}
      gap={10}
      visibleToasts={3}
      containerAriaLabel="Notifications"
      style={{ zIndex: 60, fontFamily: 'inherit' }}
      icons={{
        success: <CircleCheck aria-hidden="true" className="size-5 text-success" />,
        error: <CircleAlert aria-hidden="true" className="size-5 text-danger" />,
        warning: <TriangleAlert aria-hidden="true" className="size-5 text-warning" />,
        info: <Info aria-hidden="true" className="size-5 text-accent-ink" />,
        loading: <Spinner size="md" className="text-ink-3" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-[var(--width)] items-start gap-3 rounded-card bg-surface px-4 py-3.5 text-ink shadow-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          icon: 'mt-px flex shrink-0',
          content: 'flex min-w-0 flex-1 flex-col gap-0.5',
          title: 'text-callout font-semibold text-ink',
          description: 'text-footnote text-ink-2',
          actionButton:
            'focus-ring ml-1 inline-flex h-8 shrink-0 items-center self-center rounded-full bg-accent px-3.5 text-footnote font-semibold text-accent-fg hover:bg-accent-hover',
          cancelButton:
            'focus-ring ml-1 inline-flex h-8 shrink-0 items-center self-center rounded-full bg-surface-3 px-3.5 text-footnote font-semibold text-ink',
        },
      }}
      {...props}
    />
  );
}
