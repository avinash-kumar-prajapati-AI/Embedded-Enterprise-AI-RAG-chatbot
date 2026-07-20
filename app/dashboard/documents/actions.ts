"use server";

import { and, eq } from "drizzle-orm";
import { rm } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { join } from "path";

import { auth } from "@/lib/auth";
import { UPLOAD_ROOT } from "@/lib/blob";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

/** Local stub storage only stores `local://<absolute path>` — extract the path. */
function blobUrlToLocalPath(blobUrl: string | null): string | null {
  if (!blobUrl?.startsWith("local://")) return null;
  return blobUrl.slice("local://".length);
}

/**
 * Deletes one document (and, via cascade, its chunks) — verifies it
 * belongs to the current tenant first, so a tenant can never delete
 * another tenant's document by guessing an id.
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const [existing] = await db
    .select({ blobUrl: documents.blobUrl })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)));
  if (!existing) return;

  await db
    .delete(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)));

  const localPath = blobUrlToLocalPath(existing.blobUrl);
  if (localPath) {
    await rm(localPath, { force: true });
  }

  revalidatePath("/dashboard/documents");
}

/**
 * Deletes every document (and, via cascade, every chunk) belonging to the
 * current tenant only — a quick reset button for test data during
 * development, never touches other tenants.
 */
export async function clearAllDocuments(): Promise<void> {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  await db.delete(documents).where(eq(documents.tenantId, tenantId));
  await rm(join(UPLOAD_ROOT, tenantId), { recursive: true, force: true });

  revalidatePath("/dashboard/documents");
}
