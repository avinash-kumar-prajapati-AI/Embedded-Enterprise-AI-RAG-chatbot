import { defineConfig } from "drizzle-kit";

import { resolveEnv } from "@/lib/env";

// DATABASE_URL is only required for commands that connect to the database
// (migrate/push/studio) — `generate` works off the schema file alone.
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveEnv("DATABASE_URL", "RAG_POSTGRES_URL", "POSTGRES_URL") ?? "",
  },
});
