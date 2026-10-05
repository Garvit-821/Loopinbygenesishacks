import { useEffect } from 'react';

/**
 * Publishes the on-screen keyboard height as `--kb-inset` on <html> (bottom sheets sit at `bottom: var(--kb-inset)`).
 * Browsers that resize the layout viewport for the keyboard (interactive-widget=resizes-content) report 0;
 * iOS Safari overlays the keyboard, so its height is derived from visualViewport.
 * Reference-counted so several mounted users share one listener.
 */

let subscribers = 0;
let frame = 0;

function measure(): void {
  const viewport = window.visualViewport;
  if (!viewport) return;
  const inset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop));
  document.documentElement.style.setProperty('--kb-inset', `${inset}px`);
}

function schedule(): void {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(measure);
}

export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    subscribers += 1;
    if (subscribers === 1) {
      viewport.addEventListener('resize', schedule);
      viewport.addEventListener('scroll', schedule);
      measure();
    }
    return () => {
      subscribers -= 1;
      if (subscribers === 0) {
        viewport.removeEventListener('resize', schedule);
        viewport.removeEventListener('scroll', schedule);
        cancelAnimationFrame(frame);
        document.documentElement.style.removeProperty('--kb-inset');
      }
    };
  }, []);
}
