import { useState } from 'react';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const SIZES = {
  xs: 'size-6 text-tab',
  sm: 'size-8 text-caption',
  md: 'size-10 text-callout',
  lg: 'size-16 text-title',
  xl: 'size-24 text-large-title',
} as const;

export type AvatarSize = keyof typeof SIZES;

/** Literal class names so Tailwind keeps them; defined in tailwind.config.js from the --avatar-N tokens. */
const GRADIENTS = [
  'bg-avatar-1',
  'bg-avatar-2',
  'bg-avatar-3',
  'bg-avatar-4',
  'bg-avatar-5',
  'bg-avatar-6',
  'bg-avatar-7',
  'bg-avatar-8',
] as const;

/** FNV-1a with a final avalanche: stable per name, and spreads similar names across the palette. */
function gradientFor(name: string): string {
  let hash = 0x811c9dc5;
  for (const char of name) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x45d9f3b);
  hash ^= hash >>> 16;
  return GRADIENTS[(hash >>> 0) % GRADIENTS.length];
}

export interface AvatarProps {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  /** Default true: hidden from screen readers because the name is shown next to it. Set false to announce the name. */
  decorative?: boolean;
  className?: string;
}

/** Photo when available (falls back on error) over initials on a gradient picked from the name. */
export function Avatar({ src, name, size = 'md', decorative = true, className }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-accent-fg',
        SIZES[size],
        gradientFor(name),
        // Hairline so light photos don't melt into light backgrounds (gradients don't need one).
        showImage && 'after:pointer-events-none after:absolute after:inset-0 after:rounded-full after:ring-1 after:ring-inset after:ring-ink/10',
        className,
      )}
    >
      <span aria-hidden="true">{initials(name)}</span>
      {showImage && src ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailedSrc(src)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </span>
  );
}
