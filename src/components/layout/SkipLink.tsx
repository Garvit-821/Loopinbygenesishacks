import type { MouseEvent } from 'react';

/** First focusable element: jumps keyboard users past the navigation to the page content (<main id="main">). */
export function SkipLink() {
  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    const main = document.getElementById('main');
    if (!main) return;
    // Focus directly instead of following the hash, which the router would treat as a navigation.
    event.preventDefault();
    main.focus();
  };
  return (
    <a
      href="#main"
      onClick={skip}
      className="focus-ring sr-only rounded-full bg-accent text-callout font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-safe-offset-2 focus:z-toast focus:px-4 focus:py-2.5 focus:shadow-raised"
    >
      Skip to content
    </a>
  );
}
