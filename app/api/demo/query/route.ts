import { NextResponse } from "next/server";

import { getOrCreateDemoTenant } from "@/lib/demo";
import { answerQuery, type ConversationTurn } from "@/lib/rag/answer";
import { checkDemoQuestionCap } from "@/lib/safety/rate-limit";
import { runSafetyChecks } from "@/lib/safety/middleware";

export const maxDuration = 60;

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

// Public homepage demo — query-only (no upload capability exists on this
// route), locked to the single demo tenant, gated by a strict per-IP trial
// cap on top of the normal safety middleware.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const query = body?.query;
    const history = Array.isArray(body?.history) ? (body.history as ConversationTurn[]) : [];

    if (typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const ip = getClientIp(request);
    const demoCap = await checkDemoQuestionCap(ip);
    if (!demoCap.ok) {
      return NextResponse.json(
        {
          type: "rejected",
          message:
            "You've used all 5 free demo questions for now. Sign up to chat with your own documents, no limit.",
        },
        { status: 429 }
      );
    }

    const demoTenant = await getOrCreateDemoTenant();
    const trimmedQuery = query.trim();

    const safety = await runSafetyChecks({ tenantId: demoTenant.id, ip, query: trimmedQuery });
    if (!safety.allowed) {
      return NextResponse.json(
        { type: "rejected", message: safety.message },
        { status: safety.reason === "rate_limited" ? 429 : 400 }
      );
    }

    const result = await answerQuery({ tenantId: demoTenant.id, query: trimmedQuery, history });

    return NextResponse.json({ ...result, remainingDemoQuestions: demoCap.remaining });
  } catch (error) {
    // Never let an uncaught exception fall through to an empty-body 500 —
    // log the real cause server-side and still return a diagnosable JSON body.
    console.error("/api/demo/query crashed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
