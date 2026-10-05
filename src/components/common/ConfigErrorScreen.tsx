import { LogoMark } from './Logo';

/**
 * Shown instead of the app when a native build was made without VITE_API_URL: the app runs from the device, so it
 * has no server to talk to. Rendered outside every provider.
 */
export function ConfigErrorScreen() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-6 pb-safe pt-safe">
      <div className="flex max-w-sm flex-col items-center text-center">
        <LogoMark className="size-14" />
        <h1 className="mt-6 text-title text-ink">Loopin can't connect</h1>
        <p className="mt-2 text-callout text-ink-2">This build of the app doesn't know which server to use.</p>
        <p className="mt-4 text-footnote text-ink-3">
          Building it yourself? Set <code className="font-mono">VITE_API_URL</code> (see{' '}
          <code className="font-mono">.env.capacitor.example</code>) and rebuild.
        </p>
      </div>
    </main>
  );
}
