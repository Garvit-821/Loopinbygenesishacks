import type { UserRole } from '@loopin/shared';
import { Lock } from 'lucide-react';
import { Link, Outlet } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui';
import { hasRole, useAuth } from '@/lib/auth';
import { PageContainer } from './PageContainer';

export interface RequireRoleProps {
  role: Exclude<UserRole, 'member'>;
}

const COPY = {
  organizer: {
    title: 'Organizers only',
    description: 'This part of Loopin is for event organizers. If you run an event, ask a Loopin admin for organizer access.',
  },
  admin: {
    title: 'Admins only',
    description: 'Only Loopin admins can manage roles.',
  },
} as const;

/** Renders the child routes for users with at least `role`; everyone else gets an explanation (use under RequireAuth). */
export function RequireRole({ role }: RequireRoleProps) {
  const { user } = useAuth();
  if (hasRole(user, role)) return <Outlet />;
  return (
    <PageContainer>
      <EmptyState
        icon={Lock}
        tone="neutral"
        headingLevel="h2"
        title={COPY[role].title}
        description={COPY[role].description}
        action={
          <Button asChild variant="secondary">
            <Link to="/passport">Go to your passport</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
