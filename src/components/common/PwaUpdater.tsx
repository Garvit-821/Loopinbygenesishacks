import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from '@/components/ui';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_TOAST_ID = 'pwa-update';

/**
 * Registers the service worker (web only; never rendered in native shells) and offers new versions with an
 * "Update available — Reload" toast. Long-lived tabs check for a new version every hour.
 */
export function PwaUpdater() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      window.setInterval(() => {
        if (navigator.onLine && document.visibilityState === 'visible') registration.update().catch(() => undefined);
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast('Update available', {
      id: UPDATE_TOAST_ID,
      description: 'A new version of Loopin is ready.',
      duration: Infinity,
      action: { label: 'Reload', onClick: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
