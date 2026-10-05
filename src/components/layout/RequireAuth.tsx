import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { AuthPending } from './AuthPending';

/**
 * Signed-in routes. Visitors go to /login?next=<this page>; after an explicit sign-out (or account deletion) to the
 * landing page instead, so Log in doesn't bounce them back where they just left.
 */
export function RequireAuth() {
  const { status, signedOutReason } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <AuthPending />;
  if (status === 'unauthenticated') {
    if (signedOutReason === 'signed_out' || signedOutReason === 'account_deleted') return <Navigate to="/" replace />;
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}
