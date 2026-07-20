import { and, eq } from "drizzle-orm";

import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { apiKeys, usageLogs, type docTypeEnum } from "@/lib/db/schema";
import { generateCompletion, type ChatMessage } from "@/lib/providers";

import { classifyDocType } from "./classify";
import { embedQuery } from "./embed";
import { searchChunks, type RetrievedChunk } from "./search";

type DocType = (typeof docTypeEnum.enumValues)[number];

// Below this cosine similarity, retrieved context is too weak to answer
// from — ask a clarifying question instead of letting the model guess.
// Kept fairly low because embedding models score instruction-style queries
// ("Summarize X in bullet points") noticeably lower than plain questions on
// the same topic, even when relevant chunks exist — this threshold has to
// tolerate that gap without going so low it stops rejecting genuinely
// unrelated questions. Revisit if the embedding model changes.
const CONFIDENCE_THRESHOLD = 0.25;
const TOP_K = 6;
const MAX_HISTORY_TURNS = 6;

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface Source {
  documentId: string;
  filename: string;
  docType: DocType;
  score: number;
}

export type AnswerResult =
  | { type: "answer"; message: string; sources: Source[] }
  | { type: "clarify"; message: string }
  | { type: "error"; message: string };

export async function answerQuery(params: {
  tenantId: string;
  query: string;
  history?: ConversationTurn[];
}): Promise<AnswerResult> {
  const { tenantId, query, history = [] } = params;

  const queryEmbedding = await embedQuery(query);
  const { docType } = await classifyDocType(queryEmbedding);
  let results = await searchChunks({
    tenantId,
    queryEmbedding,
    docType,
    limit: TOP_K,
  });

  // classifyDocType is a heuristic guess, not ground truth — if it disagrees
  // with how a document was actually tagged, filtering strictly by it can
  // turn "the answer exists but under a different doc_type" into zero
  // results. Treat the classification as a preference, not a hard filter:
  // broaden to all doc_types when the filtered search comes up weak.
  if (docType && (results[0]?.score ?? 0) < CONFIDENCE_THRESHOLD) {
    const broadened = await searchChunks({ tenantId, queryEmbedding, limit: TOP_K });
    if ((broadened[0]?.score ?? 0) > (results[0]?.score ?? 0)) {
      results = broadened;
    }
  }

  const topScore = results[0]?.score ?? 0;

  if (topScore < CONFIDENCE_THRESHOLD) {
    await logUsage({
      tenantId,
      query,
      docTypeMatched: docType,
      confidenceScore: topScore,
      rejectedReason: "low_confidence",
    });
    return {
      type: "clarify",
      message:
        "I'm not sure I have information on that. Could you rephrase your question or add more detail?",
    };
  }

  const [activeKey] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.isActive, true)));

  if (!activeKey) {
    return {
      type: "error",
      message: "This chatbot isn't fully set up yet — no active model provider.",
    };
  }

  const messages = buildPrompt(query, results, history);

  try {
    const completion = await generateCompletion({
      provider: activeKey.provider,
      modelId: activeKey.modelId,
      apiKey: decryptSecret(activeKey.encryptedKey),
      baseUrl: activeKey.baseUrl,
      messages,
    });

    await logUsage({
      tenantId,
      query,
      docTypeMatched: docType,
      confidenceScore: topScore,
      tokensUsed: completion.usage?.totalTokens,
    });

    return {
      type: "answer",
      message: completion.content,
      sources: dedupeSources(results),
    };
  } catch (error) {
    // Fail closed with a clean message — never silently switch models.
    console.error("answerQuery: generation failed", { tenantId, error });
    return {
      type: "error",
      message: "Sorry, something went wrong answering that. Please try again shortly.",
    };
  }
}

function buildPrompt(
  query: string,
  results: RetrievedChunk[],
  history: ConversationTurn[]
): ChatMessage[] {
  const context = results
    .map((r, i) => `[${i + 1}] (${r.docType} — ${r.filename})\n${r.content}`)
    .join("\n\n");

  const system: ChatMessage = {
    role: "system",
    content: [
      "You are a support assistant. Answer ONLY using the context below.",
      "If the answer isn't in the context, say you don't know — never make anything up.",
      "Cite sources inline as [1], [2], etc., matching the numbered context blocks.",
      "",
      "Output format (strict):",
      "- Reply with ONLY the final answer. No preamble, no meta-commentary.",
      "- Never narrate your reasoning or thinking process (e.g. do not write things",
      "  like \"Okay, the user is asking...\" or \"Let me check the context...\").",
      "- Plain text only — no markdown (no **bold**, no #headers, no bullet lists",
      "  unless the user explicitly asks for a list).",
      "- Keep it concise: a few sentences, not an essay.",
      "",
      "Context:",
      context,
    ].join("\n"),
  };

  const recentHistory = history.slice(-MAX_HISTORY_TURNS);

  return [
    system,
    ...recentHistory.map((turn): ChatMessage => ({ role: turn.role, content: turn.content })),
    { role: "user", content: query },
  ];
}

function dedupeSources(results: RetrievedChunk[]): Source[] {
  const byDocument = new Map<string, Source>();
  for (const r of results) {
    const existing = byDocument.get(r.documentId);
    if (!existing || r.score > existing.score) {
      byDocument.set(r.documentId, {
        documentId: r.documentId,
        filename: r.filename,
        docType: r.docType,
        score: r.score,
      });
    }
  }
  return [...byDocument.values()].sort((a, b) => b.score - a.score);
}

async function logUsage(params: {
  tenantId: string;
  query: string;
  docTypeMatched: DocType | null;
  confidenceScore: number;
  tokensUsed?: number;
  rejectedReason?: "rate_limited" | "flagged" | "low_confidence";
}): Promise<void> {
  await db.insert(usageLogs).values({
    tenantId: params.tenantId,
    query: params.query,
    docTypeMatched: params.docTypeMatched ?? undefined,
    confidenceScore: params.confidenceScore,
    tokensUsed: params.tokensUsed,
    rejectedReason: params.rejectedReason,
  });
}
