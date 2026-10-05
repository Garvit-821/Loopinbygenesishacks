import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { safeNext } from '@/lib/utils';
import { AuthPending } from './AuthPending';
import { PublicLayout } from './PublicLayout';

/**
 * Landing and auth pages. Visitors who arrive signed in are sent on to `?next` (or /passport). Someone who signs in
 * here is not redirected by the layout: the page navigates itself (onboarding for new accounts, `next`, …), so the
 * two navigations never race.
 */
export function PublicOnlyLayout() {
  const { status } = useAuth();
  const [searchParams] = useSearchParams();
  const [wasSignedOutHere, setWasSignedOutHere] = useState(status === 'unauthenticated');
  if (status === 'unauthenticated' && !wasSignedOutHere) setWasSignedOutHere(true);

  if (status === 'loading') return <AuthPending />;
  if (status === 'authenticated' && !wasSignedOutHere) return <Navigate to={safeNext(searchParams.get('next'))} replace />;
  return <PublicLayout />;
}
