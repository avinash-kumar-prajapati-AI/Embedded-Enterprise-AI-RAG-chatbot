import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { rateLimitConfig, tenants } from "@/lib/db/schema";
import { generateSecretKey } from "@/lib/keys";

/**
 * The single fixed tenant behind the public homepage "try it live" widget.
 * Identified by DEMO_SITE_KEY (not by name) so it survives renames; created
 * on first access if it doesn't exist yet.
 */
export async function getOrCreateDemoTenant(): Promise<{ id: string; siteKey: string }> {
  const siteKey = process.env.DEMO_SITE_KEY;
  if (!siteKey) {
    throw new Error("DEMO_SITE_KEY is not set");
  }

  const [existing] = await db
    .select({ id: tenants.id, siteKey: tenants.siteKey })
    .from(tenants)
    .where(eq(tenants.siteKey, siteKey));
  if (existing) return existing;

  const [created] = await db
    .insert(tenants)
    .values({ name: "Demo", siteKey, secretKey: generateSecretKey() })
    .returning({ id: tenants.id, siteKey: tenants.siteKey });

  await db.insert(rateLimitConfig).values({ tenantId: created.id });

  return created;
}

export function isValidAdminToken(token: string): boolean {
  const expected = process.env.DEMO_ADMIN_TOKEN;
  return !!expected && token === expected;
}
