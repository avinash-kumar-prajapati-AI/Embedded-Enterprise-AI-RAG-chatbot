import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { resolveEnv } from "@/lib/env";

import * as schema from "./schema";

// DATABASE_URL is the canonical name; the rest are fallbacks for whatever
// Vercel's Supabase integration prefixes things with (varies per project —
// e.g. RAG_POSTGRES_URL). POSTGRES_URL (pooled) is preferred over
// *_URL_NON_POOLING (risks exhausting connections on serverless) and over
// *_PRISMA_URL (has Prisma-specific query params we don't want).
const connectionString =
  resolveEnv("DATABASE_URL", "RAG_POSTGRES_URL", "POSTGRES_URL") ?? "";

// Connections are lazy (the `postgres` client doesn't dial out until the
// first query), so this only throws once a query actually runs — not at
// module load / build time, which happens with no real env configured.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
