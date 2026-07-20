import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { storeBlob } from "@/lib/blob";
import { db } from "@/lib/db";
import { documents, docTypeEnum, tenants } from "@/lib/db/schema";
import { getOrCreateDemoTenant, isValidAdminToken } from "@/lib/demo";
import { ingestDocument } from "@/lib/rag/ingest";
import { getPdfPageLimit } from "@/lib/rag/limits";
import { getPdfPageCount, isSupportedMimeType, type PageRange } from "@/lib/rag/parse";

// Parsing + embedding a large PDF can take longer than the platform's
// default function timeout (e.g. Vercel Hobby defaults to 10s).
export const maxDuration = 60;

function parsePageNumber(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const adminToken = formData.get("adminToken");

  // Two ways in: a dashboard session (normal tenants), or the demo-tenant
  // admin token (no login — see /admin/[token]/documents). Never both.
  let tenantId: string | undefined;
  if (typeof adminToken === "string" && adminToken) {
    if (!isValidAdminToken(adminToken)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    tenantId = (await getOrCreateDemoTenant()).id;
  } else {
    const session = await auth();
    tenantId = session?.user?.tenantId ?? undefined;
  }

  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const file = formData.get("file");
  const docType = formData.get("docType");
  const existingDocumentId = formData.get("documentId");
  const fromPage = parsePageNumber(formData.get("fromPage"));
  const toPage = parsePageNumber(formData.get("toPage"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (
    typeof docType !== "string" ||
    !(docTypeEnum.enumValues as string[]).includes(docType)
  ) {
    return NextResponse.json({ error: "Invalid doc_type" }, { status: 400 });
  }
  if (!isSupportedMimeType(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    );
  }
  if ((fromPage && !toPage) || (toPage && !fromPage)) {
    return NextResponse.json(
      { error: "Provide both a from-page and a to-page, or leave both blank" },
      { status: 400 }
    );
  }
  if (fromPage && toPage && fromPage > toPage) {
    return NextResponse.json(
      { error: "From-page must be less than or equal to to-page" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const resolvedDocType = docType as (typeof docTypeEnum.enumValues)[number];

  let pageRange: PageRange | undefined;
  let totalPages: number | null = null;
  if (file.type === "application/pdf") {
    totalPages = await getPdfPageCount(buffer);

    if (fromPage && toPage) {
      if (toPage > totalPages) {
        return NextResponse.json(
          { error: `This PDF only has ${totalPages} pages` },
          { status: 400 }
        );
      }
      pageRange = { from: fromPage, to: toPage };
    } else {
      const [tenant] = await db
        .select({ plan: tenants.plan })
        .from(tenants)
        .where(eq(tenants.id, tenantId));
      const pageLimit = getPdfPageLimit(tenant?.plan ?? "free");

      if (totalPages > pageLimit) {
        return NextResponse.json(
          {
            error: `This PDF has ${totalPages} pages; the ${tenant?.plan ?? "free"} plan can ingest up to ${pageLimit} pages per document — select a page range or upgrade your plan.`,
          },
          { status: 400 }
        );
      }
    }
  }

  let documentId: string;
  if (typeof existingDocumentId === "string" && existingDocumentId) {
    const [existing] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.id, existingDocumentId),
          eq(documents.tenantId, tenantId)
        )
      );
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    documentId = existing.id;
    await db
      .update(documents)
      .set({
        filename: file.name,
        docType: resolvedDocType,
        status: "processing",
        failureReason: null,
        totalPages,
        pageRangeFrom: pageRange?.from ?? null,
        pageRangeTo: pageRange?.to ?? null,
      })
      .where(eq(documents.id, documentId));
  } else {
    const [created] = await db
      .insert(documents)
      .values({
        tenantId,
        docType: resolvedDocType,
        filename: file.name,
        status: "processing",
        totalPages,
        pageRangeFrom: pageRange?.from ?? null,
        pageRangeTo: pageRange?.to ?? null,
      })
      .returning({ id: documents.id });
    documentId = created.id;
  }

  const blobUrl = await storeBlob(tenantId, documentId, file.name, buffer);
  await db
    .update(documents)
    .set({ blobUrl })
    .where(eq(documents.id, documentId));

  try {
    await ingestDocument({
      documentId,
      tenantId,
      docType: resolvedDocType,
      buffer,
      mimeType: file.type,
      pageRange,
    });
  } catch (error) {
    return NextResponse.json(
      {
        documentId,
        status: "failed",
        error: error instanceof Error ? error.message : "Ingestion failed",
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ documentId, status: "ready" });
}
