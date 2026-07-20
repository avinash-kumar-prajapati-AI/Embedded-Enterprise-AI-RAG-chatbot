export interface ChunkOptions {
  /** Target chunk size in characters. */
  targetChars?: number;
  /** Number of trailing sentences carried into the next chunk for context continuity. */
  overlapSentences?: number;
}

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  targetChars: 1000,
  overlapSentences: 2,
};

interface Section {
  heading: string | null;
  text: string;
}

// A short, mostly-uppercase line with no sentence-ending punctuation reads
// as a heading in most policy/legal/report documents (e.g. "APPLICABILITY
// OF GUIDELINES"). Not perfect — an all-caps table cell could false-positive
// — but it's a cheap, useful signal with no per-sentence embedding cost.
const HEADING_PATTERN = /^[A-Z0-9][A-Z0-9 ,&()/-]{2,80}$/;

function isHeadingLine(line: string): boolean {
  if (line.length < 3 || line.length > 80) return false;
  if (/[.!?]$/.test(line)) return false;
  return HEADING_PATTERN.test(line);
}

/**
 * Splits raw extracted text into sections at detected heading lines. Text
 * under a heading keeps that heading attached (see `chunkText`), so
 * retrieval for a query that names the heading verbatim — e.g. "APPLICABILITY
 * OF GUIDELINES" — matches strongly even if the heading itself is short.
 */
function splitIntoSections(text: string): Section[] {
  const lines = text.split(/\r?\n/);
  const sections: Section[] = [];
  let currentHeading: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (body) sections.push({ heading: currentHeading, text: body });
    buffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (isHeadingLine(line)) {
      flush();
      currentHeading = line;
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (sections.length === 0) {
    const body = text.replace(/\s+/g, " ").trim();
    if (body) sections.push({ heading: null, text: body });
  }

  return sections;
}

/**
 * Hybrid chunking: structure-aware section splitting (headings) combined
 * with sentence-window packing within each section — not a naive
 * fixed-size splitter. Chunk boundaries always fall between sentences and
 * never cross a heading, each chunk overlaps the previous one within its
 * section, and every chunk under a heading carries that heading so the
 * embedding captures the section title, not just the body text.
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const { targetChars, overlapSentences } = { ...DEFAULT_OPTIONS, ...options };
  const sections = splitIntoSections(text);

  const chunks: string[] = [];

  for (const section of sections) {
    const sentences = splitIntoSentences(section.text);
    if (sentences.length === 0) continue;

    const prefix = section.heading ? `${section.heading}\n` : "";
    const budget = Math.max(targetChars - prefix.length, 200);

    let windowStart = 0;
    while (windowStart < sentences.length) {
      let charCount = 0;
      let windowEnd = windowStart;

      while (windowEnd < sentences.length) {
        const nextLength = sentences[windowEnd].length + 1;
        if (charCount > 0 && charCount + nextLength > budget) break;
        charCount += nextLength;
        windowEnd += 1;
      }
      // Always include at least one sentence, even if it exceeds the budget.
      if (windowEnd === windowStart) windowEnd = windowStart + 1;

      const body = sentences.slice(windowStart, windowEnd).join(" ").trim();
      chunks.push(`${prefix}${body}`.trim());

      if (windowEnd >= sentences.length) break;
      windowStart = Math.max(windowEnd - overlapSentences, windowStart + 1);
    }
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

function splitIntoSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  // Split after sentence-ending punctuation followed by whitespace and a
  // capital/digit (avoids splitting on abbreviations like "e.g." mid-word).
  const matches = normalized.match(/[^.!?]+[.!?]+(?=\s+[A-Z0-9]|\s*$)|[^.!?]+$/g);
  return (matches ?? [normalized]).map((s) => s.trim()).filter(Boolean);
}
