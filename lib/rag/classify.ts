import type { docTypeEnum } from "@/lib/db/schema";

import { embedPassages } from "./embed";

type DocType = (typeof docTypeEnum.enumValues)[number];

const DOC_TYPE_DESCRIPTIONS: Record<DocType, string> = {
  policy:
    "Company policies, terms of service, privacy policy, legal terms, rules and guidelines.",
  faq: "Frequently asked questions, general how-to information, common questions and answers.",
  pricing:
    "Pricing, plans, costs, subscription tiers, billing, and payment information.",
  about:
    "About the company, team, mission, history, and contact information.",
};

const DOC_TYPES = Object.keys(DOC_TYPE_DESCRIPTIONS) as DocType[];

// Below this cosine similarity, the query doesn't clearly belong to any
// one doc_type — search across all types instead of filtering.
const MIN_CLASSIFICATION_SCORE = 0.15;

let descriptionEmbeddingsPromise: Promise<Map<DocType, number[]>> | null = null;

function getDescriptionEmbeddings(): Promise<Map<DocType, number[]>> {
  if (!descriptionEmbeddingsPromise) {
    descriptionEmbeddingsPromise = embedPassages(
      DOC_TYPES.map((type) => DOC_TYPE_DESCRIPTIONS[type])
    ).then((embeddings) => new Map(DOC_TYPES.map((type, i) => [type, embeddings[i]])));
  }
  return descriptionEmbeddingsPromise;
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/**
 * Guesses which doc_type a query is about by comparing the query's
 * embedding against a fixed description of each doc_type. Cheap — no LLM
 * call — since both sides are normalized vectors from the same local
 * embedding model, so dot product is cosine similarity.
 */
export async function classifyDocType(
  queryEmbedding: number[]
): Promise<{ docType: DocType | null; scores: Record<DocType, number> }> {
  const descriptionEmbeddings = await getDescriptionEmbeddings();

  const scores = {} as Record<DocType, number>;
  let bestType: DocType | null = null;
  let bestScore = -Infinity;

  for (const [docType, embedding] of descriptionEmbeddings) {
    const score = dotProduct(queryEmbedding, embedding);
    scores[docType] = score;
    if (score > bestScore) {
      bestScore = score;
      bestType = docType;
    }
  }

  return {
    docType: bestScore >= MIN_CLASSIFICATION_SCORE ? bestType : null,
    scores,
  };
}
