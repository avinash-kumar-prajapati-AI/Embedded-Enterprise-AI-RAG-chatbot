export interface ModerationResult {
  flagged: boolean;
  categories?: string[];
}

/**
 * OpenAI's moderation endpoint is free and platform-operated (uses our own
 * OPENAI_API_KEY, not a tenant's model-provider key — tenants can be on
 * Groq/NIM/OpenRouter/custom, none of which offer a moderation endpoint).
 * Fails open (allows the query through) if unconfigured or unreachable —
 * a moderation outage shouldn't take down every tenant's chatbot.
 */
export async function moderateText(text: string): Promise<ModerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { flagged: false };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text }),
    });

    if (!response.ok) {
      console.error("Moderation check failed", response.status, await response.text().catch(() => ""));
      return { flagged: false };
    }

    const data = await response.json();
    const result = data?.results?.[0];
    if (!result) return { flagged: false };

    const categories = Object.entries(result.categories ?? {})
      .filter(([, flagged]) => flagged)
      .map(([category]) => category);

    return { flagged: !!result.flagged, categories };
  } catch (error) {
    console.error("Moderation check errored", error);
    return { flagged: false };
  }
}
