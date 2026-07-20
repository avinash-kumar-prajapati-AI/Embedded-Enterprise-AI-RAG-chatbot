import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";
import { answerQuery, type ConversationTurn } from "@/lib/rag/answer";
import { runSafetyChecks } from "@/lib/safety/middleware";
import { checkDemoQuestionCap } from "@/lib/safety/rate-limit";

// Embedding + provider round-trip can occasionally run long, especially on
// a cold serverless start while the local embedding model loads.
export const maxDuration = 60;

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

// Public endpoint — scoped by site_key only (never the tenant's secret_key).
// This is what the embeddable widget calls (Phase 7) *and* the public
// homepage demo — no dashboard session required. Safety checks (rate limit
// -> moderation) run before any LLM call. The demo tenant additionally gets
// a strict per-IP trial cap on top of the normal checks.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const siteKey = body?.siteKey;
    const query = body?.query;
    const history = Array.isArray(body?.history) ? (body.history as ConversationTurn[]) : [];

    if (typeof siteKey !== "string" || !siteKey) {
      return NextResponse.json({ error: "Missing siteKey" }, { status: 400 });
    }
    if (typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const [tenant] = await db
      .select({ id: tenants.id, siteKey: tenants.siteKey })
      .from(tenants)
      .where(eq(tenants.siteKey, siteKey));

    if (!tenant) {
      return NextResponse.json({ error: "Invalid siteKey" }, { status: 404 });
    }

    const trimmedQuery = query.trim();
    const ip = getClientIp(request);
    const isDemoTenant = tenant.siteKey === process.env.DEMO_SITE_KEY;

    let remainingDemoQuestions: number | undefined;
    if (isDemoTenant) {
      const demoCap = await checkDemoQuestionCap(ip);
      remainingDemoQuestions = demoCap.remaining;
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
    }

    const safety = await runSafetyChecks({ tenantId: tenant.id, ip, query: trimmedQuery });
    if (!safety.allowed) {
      return NextResponse.json(
        { type: "rejected", message: safety.message },
        { status: safety.reason === "rate_limited" ? 429 : 400 }
      );
    }

    const result = await answerQuery({ tenantId: tenant.id, query: trimmedQuery, history });

    return NextResponse.json({ ...result, remainingDemoQuestions });
  } catch (error) {
    console.error("/api/query crashed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
