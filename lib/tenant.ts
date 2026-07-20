import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { rateLimitConfig, tenants, users } from "@/lib/db/schema";
import { generateSecretKey, generateSiteKey } from "@/lib/keys";

/** Provisions a new tenant and makes the given user its owner. */
export async function provisionTenantForUser(
  userId: string,
  workspaceNameSeed: string
): Promise<void> {
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: workspaceNameSeed || "New workspace",
      siteKey: generateSiteKey(),
      secretKey: generateSecretKey(),
    })
    .returning();

  // Explicit row (rather than relying only on code-level fallbacks) so
  // limits are visible/editable from the dashboard later (Phase 9).
  await db.insert(rateLimitConfig).values({ tenantId: tenant.id });

  await db
    .update(users)
    .set({ tenantId: tenant.id, role: "owner" })
    .where(eq(users.id, userId));
}
