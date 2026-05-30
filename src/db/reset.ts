/**
 * Drop & recreate the public schema, re-run migrations, and reseed.
 * Run with: npm run db:reset
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { execSync } from "node:child_process";

async function main() {
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE;`);
  await db.execute(sql`CREATE SCHEMA public;`);
  console.log("✓ Schema dropped & recreated.");
  execSync("npm run db:migrate", { stdio: "inherit" });
  execSync("npm run db:seed", { stdio: "inherit" });
}

main().catch((err) => {
  console.error("Reset failed:", err);
  process.exit(1);
});
