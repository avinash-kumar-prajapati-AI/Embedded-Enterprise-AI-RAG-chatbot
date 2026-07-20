import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// os.tmpdir() (not a project-relative path) so this also works on
// serverless platforms with a read-only filesystem outside /tmp (Vercel,
// etc.) — files here are ephemeral, which is fine: the raw upload is only
// needed transiently for parsing, everything durable lands in Postgres.
export const UPLOAD_ROOT = join(tmpdir(), "rag-chatbot-uploads");

/**
 * Stub blob storage. Swap this out for an S3-compatible client
 * (BLOB_STORAGE_* env vars are already scaffolded in .env.example) once
 * real storage is wired up; callers only depend on this function's
 * signature.
 */
export async function storeBlob(
  tenantId: string,
  documentId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const dir = join(UPLOAD_ROOT, tenantId);
  await mkdir(dir, { recursive: true });

  const path = join(dir, `${documentId}-${filename}`);
  await writeFile(path, buffer);

  return `local://${path}`;
}
