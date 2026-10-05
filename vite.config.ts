import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PURE_MODULE_DIRS = [fileURLToPath(new URL('./shared/src/', import.meta.url)), fileURLToPath(new URL('./src/components/ui/', import.meta.url))];

/** The API's origin when it is hosted elsewhere (VITE_API_URL); null when same-origin. */
function apiOrigin(apiUrl: string | undefined): string | null {
  if (!apiUrl?.trim()) return null;
  try {
    return new URL(apiUrl).origin;
  } catch {
    throw new Error(`VITE_API_URL must be an absolute URL (got "${apiUrl}")`);
  }
}

/** The server's web CSP (SPEC §3.6) minus frame-ancestors, which a <meta> CSP can't carry (vercel.json sends it as a header). */
function contentSecurityPolicy(origin: string | null): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${origin ? ` ${origin}` : ''}`,
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** Build-only: puts the CSP <meta> right after the charset so it covers every script, including theme-init.js. */
function cspMeta(origin: string | null): Plugin {
  return {
    name: 'loopin:csp-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const meta = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(origin)}" />`;
        const charset = /<meta charset="[^"]*"\s*\/?>/i;
        return charset.test(html) ? html.replace(charset, (tag) => `${tag}\n    ${meta}`) : html.replace('<head>', `<head>\n    ${meta}`);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT, 'VITE_');
  // No service worker or icon generation under vitest or in the screenshot harness (mode 'snap').
  const pwaDisabled = mode === 'snap' || Boolean(process.env.VITEST);

  return {
    plugins: [
      react(),
      VitePWA({
        disable: pwaDisabled,
        registerType: 'prompt',
        // PwaUpdater registers it (web only), so native shells never get a service worker.
        injectRegister: false,
        manifest: {
          id: '/',
          scope: '/',
          start_url: '/',
          name: 'Loopin',
          short_name: 'Loopin',
          description: 'Your hackathon passport. Swap profiles with one scan.',
          lang: 'en',
          display: 'standalone',
          theme_color: '#f5f5f7',
          background_color: '#f5f5f7',
          shortcuts: [
            {
              name: 'My code',
              short_name: 'My code',
              description: 'Show your code so someone can scan it',
              url: '/exchange?mode=code',
              icons: [{ src: '/shortcut-code-96x96.png', sizes: '96x96', type: 'image/png' }],
            },
            {
              name: 'Scan',
              short_name: 'Scan',
              description: "Scan someone's code to connect",
              url: '/exchange?mode=scan',
              icons: [{ src: '/shortcut-scan-96x96.png', sizes: '96x96', type: 'image/png' }],
            },
          ],
        },
        // Icons come from public/icon.svg via pwa-assets.config.ts (generated at build time).
        pwaAssets: pwaDisabled
          ? { disabled: true }
          : { config: true, overrideManifestIcons: true, includeHtmlHeadLinks: true, injectThemeColor: false },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/(?:github\.com\/[^/?#]+\.png|avatars\.githubusercontent\.com\/)/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'github-avatars',
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 60, maxAgeSeconds: 7 * 24 * 60 * 60, purgeOnQuotaError: true },
              },
            },
          ],
        },
      }),
      cspMeta(apiOrigin(env.VITE_API_URL)),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': { target: 'http://localhost:8080', changeOrigin: true, ws: false },
      },
    },
    build: {
      target: 'es2022',
      rollupOptions: {
        treeshake: {
          // The shared contract and the UI primitives only declare things, but Rollup can't prove that for top-level
          // calls (zod schemas, forwardRef). Without this, importing one helper from either barrel would pull all of
          // zod and every Radix primitive into the entry chunk.
          moduleSideEffects: (id) => !PURE_MODULE_DIRS.some((dir) => id.startsWith(dir)),
        },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['src/test/setup.ts'],
      css: false,
    },
  };
});
