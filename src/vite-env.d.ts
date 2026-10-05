/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
/// <reference types="vite-plugin-pwa/vanillajs" />

interface ImportMetaEnv {
  /** API origin when the web app is hosted separately (e.g. "https://api.loopin.example"). Unset = same origin. */
  readonly VITE_API_URL?: string;
  /** Public origin used in share/copy links (needed in native shells, where location.origin is not shareable). */
  readonly VITE_PUBLIC_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
