import type { Config } from "drizzle-kit";

// When using PGlite locally we still generate plain Postgres SQL migrations.
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/property_mgmt",
  },
  verbose: true,
  strict: true,
} satisfies Config;
