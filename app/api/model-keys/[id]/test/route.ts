import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { generateCompletion, ProviderCallError } from "@/lib/providers";

export const maxDuration = 30;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)));

  if (!key) {
    return NextResponse.json({ error: "Model key not found" }, { status: 404 });
  }

  try {
    const result = await generateCompletion({
      provider: key.provider,
      modelId: key.modelId,
      apiKey: decryptSecret(key.encryptedKey),
      baseUrl: key.baseUrl,
      messages: [{ role: "user", content: "Reply with the single word: pong" }],
      maxTokens: 10,
    });
    return NextResponse.json({
      ok: true,
      message: `Connected — model replied: "${result.content.trim().slice(0, 80)}"`,
    });
  } catch (error) {
    // Log the failure server-side; the client only ever sees a clean message.
    console.error("Model key test failed", { provider: key.provider, error });
    const message =
      error instanceof ProviderCallError
        ? error.message
        : "Connection test failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
