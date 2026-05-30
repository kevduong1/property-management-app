/**
 * Database client with a swappable driver.
 *
 * - If DATABASE_URL is set (and DB_DRIVER !== "pglite"): use postgres-js against
 *   a real Postgres (Supabase / Neon / RDS / local).
 * - Otherwise: use an embedded PGlite database persisted to ./.pglite so the app
 *   runs with zero external infrastructure (great for the MVP demo, CI, etc.).
 *
 * Both paths use the SAME Drizzle schema and the SAME generated SQL migrations,
 * because PGlite is real Postgres compiled to WASM.
 */
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzlePg<typeof schema>>;

const databaseUrl = process.env.DATABASE_URL;
const driver =
  process.env.DB_DRIVER ?? (databaseUrl ? "postgres" : "pglite");

// Reuse a single connection across hot reloads / serverless invocations.
const globalForDb = globalThis as unknown as {
  __db?: Database;
  __pglite?: unknown;
};

function createDb(): Database {
  if (driver === "postgres") {
    if (!databaseUrl) {
      throw new Error(
        "DB_DRIVER=postgres requires DATABASE_URL to be set.",
      );
    }
    // Lazy require so PGlite-only deploys don't need postgres installed.
    const postgres = require("postgres");
    const client = postgres(databaseUrl, { max: 10 });
    return drizzlePg(client, { schema, casing: "snake_case" }) as Database;
  }

  // PGlite (embedded). Persist to disk so data survives between requests.
  const { PGlite } = require("@electric-sql/pglite");
  const dataDir = process.env.PGLITE_DIR ?? ".pglite";
  const pg =
    (globalForDb.__pglite as InstanceType<typeof PGlite> | undefined) ??
    new PGlite(dataDir);
  globalForDb.__pglite = pg;
  return drizzlePglite(pg as never, { schema }) as unknown as Database;
}

export const db: Database = globalForDb.__db ?? createDb();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__db = db;
}

export { schema };
export const isPglite = driver === "pglite";
