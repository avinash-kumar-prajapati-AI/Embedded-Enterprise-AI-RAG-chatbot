const SUPPORTED_MIME_TYPES = ["application/pdf", "text/plain"] as const;

export interface PageRange {
  /** 1-indexed, inclusive. */
  from: number;
  /** 1-indexed, inclusive. */
  to: number;
}

export class UnsupportedFileTypeError extends Error {
  constructor(mimeType: string) {
    super(`Unsupported file type: ${mimeType}`);
    this.name = "UnsupportedFileTypeError";
  }
}

/** Number of pages in a PDF — used to enforce per-plan ingestion caps before parsing the whole thing. */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    return info.total;
  } finally {
    await parser.destroy();
  }
}

/**
 * Extracts raw text from an uploaded PDF or plain-text file. `pageRange`
 * (PDF only) lets the caller ingest a subset of pages — useful for large
 * PDFs where only a section is relevant, or to stay under a plan's page cap.
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  pageRange?: PageRange
): Promise<string> {
  if (mimeType === "text/plain") {
    return buffer.toString("utf-8");
  }

  if (mimeType === "application/pdf") {
    // pdf-parse flattens table layout into plain text (columns read
    // left-to-right, top-to-bottom) — fine for prose, imperfect for
    // pricing tables. Swap for LlamaParse/unstructured later if needed.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText(
        pageRange ? { first: pageRange.from, last: pageRange.to } : undefined
      );
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  throw new UnsupportedFileTypeError(mimeType);
}

export function isSupportedMimeType(
  mimeType: string
): mimeType is (typeof SUPPORTED_MIME_TYPES)[number] {
  return (SUPPORTED_MIME_TYPES as readonly string[]).includes(mimeType);
}
