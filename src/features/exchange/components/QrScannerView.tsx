import { ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ScannerStatus =
  | 'idle'
  | 'requesting'
  | 'scanning'
  | 'paused'
  | 'denied'
  | 'no-camera'
  | 'in-use'
  | 'insecure'
  | 'unsupported'
  | 'error';

export interface QrScannerViewProps {
  /** Decoded QR text (identical text within `dedupeMs` is ignored). */
  onResult(text: string): void;
  paused?: boolean;
  dedupeMs?: number;
  className?: string;
  onStatusChange?(status: ScannerStatus): void;
}

/** Foundation stub with the frozen props; the exchange feature replaces it with the camera scanner. */
export function QrScannerView({ className }: QrScannerViewProps) {
  return (
    <div className={cn('grid aspect-square w-full place-items-center rounded-hero bg-surface-3 text-ink-2', className)}>
      <ScanLine aria-hidden="true" className="size-10" />
    </div>
  );
}
