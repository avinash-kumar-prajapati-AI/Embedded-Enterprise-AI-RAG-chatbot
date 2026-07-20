import { defineConfig } from "drizzle-kit";

// DATABASE_URL is only required for commands that connect to the database
// (migrate/push/studio) — `generate` works off the schema file alone.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
