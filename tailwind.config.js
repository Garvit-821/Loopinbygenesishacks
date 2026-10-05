// @ts-check
import plugin from 'tailwindcss/plugin';
import animate from 'tailwindcss-animate';

/**
 * Loopin design tokens. Every color is a CSS variable holding RGB channels (defined for light and dark in
 * src/index.css), so opacity modifiers work: `bg-accent/10`. Components use ONLY these semantic names.
 */
const token = (/** @type {string} */ name) => `rgb(var(--${name}) / <alpha-value>)`;

const env = (/** @type {string} */ side) => `env(safe-area-inset-${side}, 0px)`;

/** Safe-area utilities: `pt-safe`, `pb-safe-offset-4` (inset + 1rem), `pb-safe-or-4` (max(inset, 1rem)), `bottom-safe-offset-4`. */
const safeArea = plugin(({ addUtilities, matchUtilities, theme }) => {
  addUtilities({
    '.pt-safe': { paddingTop: env('top') },
    '.pr-safe': { paddingRight: env('right') },
    '.pb-safe': { paddingBottom: env('bottom') },
    '.pl-safe': { paddingLeft: env('left') },
    '.px-safe': { paddingLeft: env('left'), paddingRight: env('right') },
    '.py-safe': { paddingTop: env('top'), paddingBottom: env('bottom') },
  });
  /** @type {Record<string, (value: string) => Record<string, string>>} */
  const offsetUtilities = {};
  for (const [key, side, props] of /** @type {const} */ ([
    ['pt', 'top', ['paddingTop']],
    ['pr', 'right', ['paddingRight']],
    ['pb', 'bottom', ['paddingBottom']],
    ['pl', 'left', ['paddingLeft']],
    ['top', 'top', ['top']],
    ['bottom', 'bottom', ['bottom']],
  ])) {
    offsetUtilities[`${key}-safe-offset`] = (value) => Object.fromEntries(props.map((p) => [p, `calc(${env(side)} + ${value})`]));
    offsetUtilities[`${key}-safe-or`] = (value) => Object.fromEntries(props.map((p) => [p, `max(${env(side)}, ${value})`]));
  }
  offsetUtilities['px-safe-offset'] = (value) => ({
    paddingLeft: `calc(${env('left')} + ${value})`,
    paddingRight: `calc(${env('right')} + ${value})`,
  });
  offsetUtilities['px-safe-or'] = (value) => ({
    paddingLeft: `max(${env('left')}, ${value})`,
    paddingRight: `max(${env('right')}, ${value})`,
  });
  matchUtilities(offsetUtilities, { values: theme('spacing') });
});

/** Frosted bar material, avatar gradients and small helpers that need more than one declaration. */
const materials = plugin(({ addUtilities }) => {
  addUtilities({
    '.frosted': {
      backgroundColor: 'rgb(var(--bar) / var(--bar-alpha))',
      '-webkit-backdrop-filter': 'saturate(180%) blur(20px)',
      backdropFilter: 'saturate(180%) blur(20px)',
      '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
        backgroundColor: 'rgb(var(--bar))',
      },
      '@media (prefers-reduced-transparency: reduce)': {
        backgroundColor: 'rgb(var(--bar))',
        '-webkit-backdrop-filter': 'none',
        backdropFilter: 'none',
      },
    },
    '.scrollbar-none': {
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': { display: 'none' },
    },
    ...Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [
        `.bg-avatar-${i + 1}`,
        { backgroundImage: `linear-gradient(135deg, rgb(var(--avatar-${i + 1}-from)), rgb(var(--avatar-${i + 1}-to)))` },
      ]),
    ),
  });
});

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  future: { hoverOnlyWhenSupported: true },
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
      canvas: token('canvas'),
      surface: { DEFAULT: token('surface'), 2: token('surface-2'), 3: token('surface-3') },
      ink: { DEFAULT: token('ink'), 2: token('ink-2'), 3: token('ink-3') },
      line: { DEFAULT: token('line'), soft: token('line-soft'), strong: token('line-strong') },
      accent: { DEFAULT: token('accent'), hover: token('accent-hover'), fg: token('accent-fg'), ink: token('accent-ink') },
      success: token('success'),
      warning: token('warning'),
      danger: { DEFAULT: token('danger'), solid: token('danger-solid') },
      gold: token('gold'),
      silver: token('silver'),
      bronze: token('bronze'),
      thumb: token('thumb'),
      bar: token('bar'),
      'on-media': token('on-media'),
      // These carry their own alpha (black/40 light, black/60 dark), so they take no opacity modifier.
      scrim: 'rgb(var(--scrim))',
      'media-scrim': 'rgb(var(--media-scrim))',
    },
    fontFamily: {
      sans: ['-apple-system', 'BlinkMacSystemFont', '"Inter Variable"', 'system-ui', 'sans-serif'],
      mono: ['ui-monospace', 'SFMono-Regular', '"JetBrains Mono"', 'monospace'],
    },
    // Named type scale only (no text-sm/text-lg). Letter-spacing follows Inter's dynamic metrics.
    fontSize: {
      display: ['2.5rem', { lineHeight: '2.875rem', letterSpacing: '-0.024em', fontWeight: '700' }],
      'large-title': ['1.75rem', { lineHeight: '2.125rem', letterSpacing: '-0.022em', fontWeight: '600' }],
      title: ['1.375rem', { lineHeight: '1.75rem', letterSpacing: '-0.018em', fontWeight: '600' }],
      headline: ['1.0625rem', { lineHeight: '1.375rem', letterSpacing: '-0.013em', fontWeight: '600' }],
      body: ['1.0625rem', { lineHeight: '1.5rem', letterSpacing: '-0.013em' }],
      callout: ['0.9375rem', { lineHeight: '1.25rem', letterSpacing: '-0.009em' }],
      footnote: ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '-0.003em' }],
      caption: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0' }],
      tab: ['0.6875rem', { lineHeight: '0.8125rem', letterSpacing: '0.005em', fontWeight: '500' }],
    },
    boxShadow: {
      none: 'none',
      // Soft elevation in light mode; a hairline in dark mode (see --shadow-card in index.css).
      card: 'var(--shadow-card)',
      raised: 'var(--shadow-raised)',
      thumb: 'var(--shadow-thumb)',
    },
    extend: {
      borderRadius: {
        input: '0.75rem',
        card: '1rem',
        hero: '1.375rem',
      },
      spacing: {
        12.5: '3.125rem',
      },
      maxHeight: {
        sheet: `calc(100dvh - ${env('top')} - 1rem)`,
      },
      inset: {
        kb: 'var(--kb-inset, 0px)',
      },
      zIndex: {
        bar: '30',
        dialog: '50',
        toast: '60',
      },
      transitionDuration: {
        250: '250ms',
      },
      transitionTimingFunction: {
        ios: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [animate, safeArea, materials],
};
