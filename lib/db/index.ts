import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

// Connections are lazy (the `postgres` client doesn't dial out until the
// first query), so this only throws once a query actually runs — not at
// module load / build time, which happens with no real env configured.
const client = postgres(process.env.DATABASE_URL ?? "", { prepare: false });

export const db = drizzle(client, { schema });
