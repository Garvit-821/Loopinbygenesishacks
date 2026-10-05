import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

/**
 * PWA icons generated from public/icon.svg (vite-plugin-pwa runs this at build time): favicon.ico, pwa-64/192/512,
 * a maskable 512 and the 180 px Apple touch icon.
 */

/** The tile's bottom gradient stop: fills the rounded corners of the full-bleed icons (maskable, Apple). */
const TILE_FILL = '#0059CC';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Lossless true-colour PNGs: the default (quality 60) quantises to a palette and dithers the tile's gradient.
    png: { compressionLevel: 9 },
    // The mark sits inside a 160/512 radius, well within the maskable safe zone, so no extra padding is needed. The
    // filled corners lie outside circle and squircle masks; only square-ish masks show a sliver at the top corners.
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: TILE_FILL } },
    // iOS draws transparent pixels black; fill the corners so its own mask finds a solid tile.
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: TILE_FILL } },
  },
  images: ['public/icon.svg'],
});
