"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiKeys, providerEnum } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/crypto";

async function requireTenantId(): Promise<string> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");
  return tenantId;
}

export async function createModelKey(formData: FormData): Promise<void> {
  const tenantId = await requireTenantId();

  const provider = formData.get("provider");
  const modelId = formData.get("modelId");
  const label = formData.get("label");
  const apiKey = formData.get("apiKey");
  const baseUrl = formData.get("baseUrl");

  if (
    typeof provider !== "string" ||
    !(providerEnum.enumValues as string[]).includes(provider) ||
    typeof modelId !== "string" ||
    !modelId.trim() ||
    typeof label !== "string" ||
    !label.trim() ||
    typeof apiKey !== "string" ||
    !apiKey.trim()
  ) {
    throw new Error("Missing or invalid model key fields");
  }
  if (provider === "custom" && (typeof baseUrl !== "string" || !baseUrl.trim())) {
    throw new Error("Custom provider requires a base URL");
  }

  await db.insert(apiKeys).values({
    tenantId,
    provider: provider as (typeof providerEnum.enumValues)[number],
    modelId: modelId.trim(),
    label: label.trim(),
    baseUrl: provider === "custom" ? (baseUrl as string).trim() : null,
    encryptedKey: encryptSecret(apiKey.trim()),
    isActive: false,
  });

  revalidatePath("/dashboard/models");
}

export async function deleteModelKey(id: string): Promise<void> {
  const tenantId = await requireTenantId();
  await db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)));
  revalidatePath("/dashboard/models");
}

/** Only one active key per tenant — the one actually used for generation. */
export async function setActiveModelKey(id: string): Promise<void> {
  const tenantId = await requireTenantId();

  await db
    .update(apiKeys)
    .set({ isActive: false })
    .where(eq(apiKeys.tenantId, tenantId));

  await db
    .update(apiKeys)
    .set({ isActive: true })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)));

  revalidatePath("/dashboard/models");
}
