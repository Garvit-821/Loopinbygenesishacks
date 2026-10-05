import { useEffect } from 'react';

/**
 * Keep the screen on while `active` (QR code display, door mode). Browsers release the lock when the page is
 * hidden, so it is re-requested whenever the page becomes visible again. Silently does nothing when unsupported
 * or refused (low battery, permissions policy).
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let disposed = false;
    let requesting = false;

    const request = async () => {
      if (disposed || requesting || sentinel || document.visibilityState !== 'visible') return;
      requesting = true;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (disposed) {
          void lock.release().catch(() => undefined);
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null;
        });
      } catch {
        // NotAllowedError (hidden page, battery saver) — nothing useful to tell the user.
      } finally {
        requesting = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      const lock = sentinel;
      sentinel = null;
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
