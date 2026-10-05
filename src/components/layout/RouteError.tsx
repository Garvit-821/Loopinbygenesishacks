import { Compass, RefreshCw } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { Button } from '@/components/ui';
import { usePageTitle } from '@/lib/usePageTitle';

const CHUNK_RELOAD_KEY = 'loopin.chunk-reload';
const CHUNK_RELOAD_WINDOW_MS = 60_000;

/** A lazy page's file is gone — almost always because a new version was deployed while this tab was open. */
export function isChunkLoadError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i.test(
    text,
  );
}

/** Allow one automatic reload per minute, so a file that is really missing can't cause a reload loop. */
function claimAutoReload(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (Date.now() - last < CHUNK_RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="grid min-h-[70dvh] place-items-center px-4 py-10">{children}</div>;
}

function reload() {
  window.location.reload();
}

/** Route error boundary: 404s, "Loopin was updated" (reloads once by itself), and unexpected errors. */
export function RouteError() {
  const error = useRouteError();
  const chunkError = isChunkLoadError(error);
  const [autoReloading] = useState(() => chunkError && claimAutoReload());
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  usePageTitle(notFound ? 'Page not found' : 'Something went wrong');

  useEffect(() => {
    if (autoReloading) reload();
  }, [autoReloading]);

  if (autoReloading) return <LoadingScreen label="Updating Loopin" />;

  if (chunkError) {
    return (
      <Frame>
        <EmptyState
          icon={RefreshCw}
          title="Loopin was updated"
          description="Reload to get the latest version."
          action={<Button onClick={reload}>Reload</Button>}
        />
      </Frame>
    );
  }

  if (notFound) {
    return (
      <Frame>
        <EmptyState
          icon={Compass}
          tone="neutral"
          title="Page not found"
          description="That link doesn't lead anywhere in Loopin."
          action={
            <Button asChild variant="secondary">
              <Link to="/">Go home</Link>
            </Button>
          }
        />
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="flex flex-col items-center">
        <ErrorState error={error} />
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reload}>Reload</Button>
          <Button asChild variant="secondary">
            <Link to="/">Go home</Link>
          </Button>
        </div>
        {import.meta.env.DEV && error instanceof Error ? (
          <pre className="mt-6 max-w-full overflow-x-auto whitespace-pre-wrap rounded-input bg-surface-3 p-3 font-mono text-caption text-ink-2">
            {error.stack ?? error.message}
          </pre>
        ) : null}
      </div>
    </Frame>
  );
}
