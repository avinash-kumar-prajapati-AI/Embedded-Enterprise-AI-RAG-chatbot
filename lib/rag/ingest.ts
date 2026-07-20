import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { chunks, documents, type docTypeEnum } from "@/lib/db/schema";

import { embedPassages } from "./embed";
import { chunkText } from "./chunk";
import { parseDocument, type PageRange } from "./parse";

type DocType = (typeof docTypeEnum.enumValues)[number];

/**
 * Parses, chunks, and embeds a document's content, then replaces any
 * existing chunks for it (re-upload/versioning: old chunks are deleted
 * before the new ones are inserted) and marks the document ready/failed.
 */
export async function ingestDocument(params: {
  documentId: string;
  tenantId: string;
  docType: DocType;
  buffer: Buffer;
  mimeType: string;
  /** PDF only — ingest just this page range instead of the whole document. */
  pageRange?: PageRange;
}): Promise<void> {
  const { documentId, tenantId, docType, buffer, mimeType, pageRange } = params;

  try {
    const text = await parseDocument(buffer, mimeType, pageRange);
    const textChunks = chunkText(text);

    if (textChunks.length === 0) {
      throw new Error("No extractable text found in document");
    }

    const embeddings = await embedPassages(textChunks);

    await db.delete(chunks).where(eq(chunks.documentId, documentId));

    await db.insert(chunks).values(
      textChunks.map((content, index) => ({
        documentId,
        tenantId,
        content,
        embedding: embeddings[index],
        docType,
        metadata: { chunkIndex: index },
      }))
    );

    await db
      .update(documents)
      .set({ status: "ready", failureReason: null })
      .where(eq(documents.id, documentId));
  } catch (error) {
    await db
      .update(documents)
      .set({
        status: "failed",
        failureReason: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(documents.id, documentId));
    throw error;
  }
}
