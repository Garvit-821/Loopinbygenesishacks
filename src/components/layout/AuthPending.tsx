import { CircleAlert, Hourglass, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { Button } from '@/components/ui';
import { describeError } from '@/lib/api-error';
import { useAuth } from '@/lib/auth';

/** While the signed-in account loads: the boot spinner, or — if loading it failed — the error with Try again / Sign out. */
export function AuthPending() {
  const { bootError, refresh, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!bootError) return <LoadingScreen />;

  const { kind, message, retryable } = describeError(bootError);
  const icon = kind === 'offline' ? WifiOff : kind === 'slow' ? Hourglass : CircleAlert;

  return (
    <main id="main" tabIndex={-1} className="grid min-h-dvh place-items-center bg-canvas px-4 pb-safe pt-safe outline-none">
      <div role="alert">
        <EmptyState
          icon={icon}
          tone="neutral"
          headingLevel="h2"
          title="Loopin couldn't load your account"
          description={message}
          action={
            <>
              {retryable ? (
                <Button
                  variant="secondary"
                  loading={retrying}
                  onClick={() => {
                    setRetrying(true);
                    void refresh().finally(() => setRetrying(false));
                  }}
                >
                  Try again
                </Button>
              ) : null}
              <Button
                variant="ghost"
                loading={signingOut}
                onClick={() => {
                  setSigningOut(true);
                  void signOut();
                }}
              >
                Sign out
              </Button>
            </>
          }
        />
      </div>
    </main>
  );
}
