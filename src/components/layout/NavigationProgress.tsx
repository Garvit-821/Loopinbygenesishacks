import { useEffect, useState } from 'react';
import { useNavigation } from 'react-router-dom';

const SHOW_AFTER_MS = 150;

/** Thin accent bar at the top while a navigation (lazy page load) takes longer than 150 ms. Visual only. */
export function NavigationProgress() {
  const busy = useNavigation().state !== 'idle';
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!busy) {
      setVisible(false);
      setProgress(0);
      return;
    }
    const timer = window.setTimeout(() => setVisible(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [busy]);

  useEffect(() => {
    if (!visible) return;
    // Next frame, so the bar starts from zero and eases towards (never reaching) the end.
    const frame = window.requestAnimationFrame(() => setProgress(0.9));
    return () => window.cancelAnimationFrame(frame);
  }, [visible]);

  if (!visible) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-toast h-0.5">
      <div
        className="h-full origin-left bg-accent transition-transform ease-ios [transition-duration:8s] motion-reduce:transition-none"
        style={{ transform: `scaleX(${progress})` }}
      />
    </div>
  );
}
