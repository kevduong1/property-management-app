import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit config. Uses the Supabase Postgres connection string.
 *
 * Set DATABASE_URL in `.env` to your Supabase project's connection string
 * (Project Settings -> Database -> Connection string -> URI). Example:
 *   postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
 *
 * Commands:
 *   npm run db:generate   # create SQL migration from src/db/schema.ts
 *   npm run db:push       # push schema directly to the database
 *   npm run db:studio     # open Drizzle Studio
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});
