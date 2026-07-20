import { and, cosineDistance, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { chunks, documents, type docTypeEnum } from "@/lib/db/schema";

type DocType = (typeof docTypeEnum.enumValues)[number];

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  filename: string;
  docType: DocType;
  content: string;
  /** Cosine similarity: 1 = identical, 0 = unrelated. */
  score: number;
}

export async function searchChunks(params: {
  tenantId: string;
  queryEmbedding: number[];
  docType?: DocType | null;
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const { tenantId, queryEmbedding, docType, limit = 5 } = params;

  const distance = cosineDistance(chunks.embedding, queryEmbedding);

  const rows = await db
    .select({
      chunkId: chunks.id,
      documentId: chunks.documentId,
      filename: documents.filename,
      docType: chunks.docType,
      content: chunks.content,
      distance,
    })
    .from(chunks)
    .innerJoin(documents, eq(documents.id, chunks.documentId))
    .where(
      docType
        ? and(eq(chunks.tenantId, tenantId), eq(chunks.docType, docType))
        : eq(chunks.tenantId, tenantId)
    )
    .orderBy(distance)
    .limit(limit);

  return rows.map((row) => ({
    chunkId: row.chunkId,
    documentId: row.documentId,
    filename: row.filename,
    docType: row.docType,
    content: row.content,
    score: 1 - Number(row.distance),
  }));
}
