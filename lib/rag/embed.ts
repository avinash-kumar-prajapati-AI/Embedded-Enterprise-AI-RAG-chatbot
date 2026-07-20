import { tmpdir } from "os";

import type { FeatureExtractionPipeline } from "@huggingface/transformers";

import { EMBEDDING_DIMENSIONS } from "@/lib/db/schema";

// bge-small-en-v1.5 ranks well above MiniLM-L6-v2 on retrieval benchmarks
// (MTEB) while keeping the same 384-dim output — a free, local, drop-in
// upgrade with no schema/migration change needed.
const MODEL_ID = "Xenova/bge-small-en-v1.5";

// BGE models are trained asymmetrically: queries need this instruction
// prefix prepended for retrieval to work well, passages/chunks don't.
// Omitting it doesn't error, it just quietly hurts retrieval quality.
const QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: ";

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

// Local, free embedding model — loaded once per server process and reused.
// First call downloads the model weights to the transformers.js cache dir.
function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (!pipelinePromise) {
    pipelinePromise = import("@huggingface/transformers").then(({ env, pipeline }) => {
      // Serverless platforms (Vercel, etc.) have a read-only filesystem
      // outside of os.tmpdir() — the library's default cache location can
      // fail to write there. /tmp is always writable, on every platform.
      env.cacheDir = tmpdir();
      return pipeline("feature-extraction", MODEL_ID);
    });
  }
  return pipelinePromise;
}

async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const extractor = await getPipeline();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  const vectors = output.tolist() as number[][];

  for (const vector of vectors) {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding model returned ${vector.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`
      );
    }
  }

  return vectors;
}

/** Embeds a search query — use for user questions, never for stored chunks. */
export async function embedQuery(text: string): Promise<number[]> {
  const [embedding] = await embed([QUERY_INSTRUCTION + text]);
  return embedding;
}

/** Embeds document chunks (or anything being searched over, e.g. doc_type descriptions) — no query prefix. */
export async function embedPassages(texts: string[]): Promise<number[][]> {
  return embed(texts);
}
