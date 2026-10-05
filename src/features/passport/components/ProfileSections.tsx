import type { ProfileView } from '@loopin/shared';
import { Card, CardTitle } from '@/components/ui';

export type CredentialTab = 'stamps' | 'awards' | 'vouches';

export interface ProfileSectionsProps {
  profile: ProfileView;
  tab: CredentialTab;
  onTabChange(tab: CredentialTab): void;
  /** 'self' shows how-to-earn empty states; 'other' is someone else's passport. */
  variant: 'self' | 'other';
}

/** Foundation stub with the frozen props; the passport feature replaces it (skills, credential tabs, activity). */
export function ProfileSections({ profile }: ProfileSectionsProps) {
  const { stats } = profile;
  return (
    <Card>
      <CardTitle as="h2">Passport</CardTitle>
      <p className="mt-1 text-callout text-ink-2">
        {stats.stamps} stamps · {stats.awards} awards · {stats.vouches} vouches
      </p>
    </Card>
  );
}
