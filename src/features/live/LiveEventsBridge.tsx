import { useEffect } from 'react';
import { startStream } from '@/lib/stream';

/**
 * Mounted by RootLayout while signed in. Foundation stub with the frozen signature: it only keeps the shared
 * stream connected; the live feature adds the cache updates and toasts for each event (SPEC §6.4).
 */
export function LiveEventsBridge(): null {
  useEffect(() => startStream(), []);
  return null;
}
