import { useAuth } from '@/lib/auth';
import { AppShell } from './AppShell';
import { AuthPending } from './AuthPending';
import { PublicLayout } from './PublicLayout';

/** One persistent shell for every in-app route: the app chrome when signed in, the public chrome otherwise. */
export function ShellLayout() {
  const { status } = useAuth();
  if (status === 'loading') return <AuthPending />;
  return status === 'authenticated' ? <AppShell /> : <PublicLayout />;
}
