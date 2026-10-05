import { useState, type ReactNode, type RefObject } from 'react';
import { Button } from './button';
import { Dialog, DialogContent } from './dialog';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button for irreversible actions. */
  destructive?: boolean;
  /**
   * Runs on confirm. A returned promise shows a spinner; the dialog closes when it resolves and stays open when it
   * rejects (show the error yourself, e.g. a toast or inline message in `children`).
   */
  onConfirm: () => void | Promise<unknown>;
  /** Extra busy state controlled by the caller (e.g. mutation.isPending). */
  loading?: boolean;
  confirmDisabled?: boolean;
  /** Extra content between the description and the buttons (e.g. a "type your handle" field). */
  children?: ReactNode;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  loading = false,
  confirmDisabled = false,
  children,
  returnFocusRef,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const busy = loading || pending;

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller reports the failure; keep the dialog open so the user can retry or cancel.
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!busy || next) && onOpenChange(next)}>
      <DialogContent
        size="sm"
        title={title}
        description={description}
        dismissible={!busy}
        returnFocusRef={returnFocusRef}
        footer={
          <>
            <Button variant="secondary" disabled={busy} onClick={() => onOpenChange(false)} className="sm:min-w-24">
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              loading={busy}
              disabled={confirmDisabled}
              onClick={() => void handleConfirm()}
              className="sm:min-w-24"
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}
