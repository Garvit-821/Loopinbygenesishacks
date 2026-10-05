import { defineConfig } from 'drizzle-kit';

// Only `drizzle-kit generate` is used (migrations are applied by src/db/migrate.ts at boot), so no
// database credentials are needed here.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
