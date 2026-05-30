/**
 * Apply generated SQL migrations to whichever driver is active.
 * Run with: npm run db:migrate
 */
import "dotenv/config";
import { migrate as migratePg } from "drizzle-orm/postgres-js/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

const MIGRATIONS_FOLDER = "./drizzle";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const driver = process.env.DB_DRIVER ?? (databaseUrl ? "postgres" : "pglite");

  if (driver === "postgres") {
    const postgres = (await import("postgres")).default;
    const client = postgres(databaseUrl!, { max: 1 });
    const db = drizzlePg(client, { schema });
    await migratePg(db, { migrationsFolder: MIGRATIONS_FOLDER });
    await client.end();
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const pg = new PGlite(process.env.PGLITE_DIR ?? ".pglite");
    const db = drizzlePglite(pg as never, { schema });
    await migratePglite(db as never, { migrationsFolder: MIGRATIONS_FOLDER });
    await pg.close();
  }
  console.log(`✓ Migrations applied (${driver}).`);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
