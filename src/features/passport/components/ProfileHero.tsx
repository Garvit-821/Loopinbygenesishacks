import { formatHandle, type ContactInfo, type ProfileStats, type PublicUser } from '@loopin/shared';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/common/Avatar';
import { Card } from '@/components/ui';

export interface ProfileHeroProps {
  user: PublicUser;
  stats?: ProfileStats;
  /** Present for yourself and mutual connections: renders contact actions. */
  contact?: ContactInfo | null;
  /** Buttons under the identity (e.g. Show my code, Edit, Share). */
  actions?: ReactNode;
}

/** Foundation stub with the frozen props; the passport feature replaces the body (stats, contact actions, passport styling). */
export function ProfileHero({ user, actions }: ProfileHeroProps) {
  return (
    <Card variant="hero" className="flex flex-col items-center gap-3 text-center">
      <Avatar src={user.avatarUrl} name={user.name} size="xl" />
      <div className="min-w-0">
        <h2 className="text-title text-ink">{user.name}</h2>
        <p className="text-callout text-ink-2">{formatHandle(user.handle)}</p>
        {user.headline ? <p className="mt-1 text-callout text-ink-2">{user.headline}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap justify-center gap-2">{actions}</div> : null}
    </Card>
  );
}
