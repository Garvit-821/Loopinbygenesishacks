import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/scripts/migrate.ts',
    'src/scripts/seed.ts',
    'src/scripts/grant-role.ts',
    'src/scripts/generate-keys.ts',
  ],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  // The shared contract is raw TypeScript, so it is compiled into the bundle. Every other dependency
  // (pg, PGlite, drizzle, pino, …) stays external and is resolved from node_modules at runtime.
  noExternal: ['@loopin/shared'],
  sourcemap: true,
  clean: true,
});
