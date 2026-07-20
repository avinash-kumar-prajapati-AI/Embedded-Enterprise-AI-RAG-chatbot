"use server";

import { eq } from "drizzle-orm";
import { rm } from "fs/promises";
import { revalidatePath } from "next/cache";
import { join } from "path";

import { UPLOAD_ROOT } from "@/lib/blob";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getOrCreateDemoTenant, isValidAdminToken } from "@/lib/demo";

function assertToken(token: string): void {
  if (!isValidAdminToken(token)) {
    throw new Error("Unauthorized");
  }
}

function blobUrlToLocalPath(blobUrl: string | null): string | null {
  if (!blobUrl?.startsWith("local://")) return null;
  return blobUrl.slice("local://".length);
}

export async function adminDeleteDocument(token: string, documentId: string): Promise<void> {
  assertToken(token);
  const demoTenant = await getOrCreateDemoTenant();

  const [existing] = await db
    .select({ blobUrl: documents.blobUrl, tenantId: documents.tenantId })
    .from(documents)
    .where(eq(documents.id, documentId));
  if (!existing || existing.tenantId !== demoTenant.id) return;

  await db.delete(documents).where(eq(documents.id, documentId));

  const localPath = blobUrlToLocalPath(existing.blobUrl);
  if (localPath) await rm(localPath, { force: true });

  revalidatePath(`/admin/${token}/documents`);
}

export async function adminClearAllDocuments(token: string): Promise<void> {
  assertToken(token);
  const demoTenant = await getOrCreateDemoTenant();

  await db.delete(documents).where(eq(documents.tenantId, demoTenant.id));
  await rm(join(UPLOAD_ROOT, demoTenant.id), { recursive: true, force: true });

  revalidatePath(`/admin/${token}/documents`);
}
