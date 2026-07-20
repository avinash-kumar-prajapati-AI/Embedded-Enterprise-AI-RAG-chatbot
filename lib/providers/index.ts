import {
  type GenerateCompletionParams,
  type GenerateCompletionResult,
  type ProviderId,
  ProviderCallError,
} from "./types";

export * from "./types";

// All four providers speak the same OpenAI-compatible chat completions
// schema, so one implementation handles all of them — only the base URL
// differs. "custom" requires the caller to supply their own base URL.
const DEFAULT_BASE_URLS: Record<Exclude<ProviderId, "custom">, string> = {
  nvidia_nim: "https://integrate.api.nvidia.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
};

async function callChatCompletions(
  provider: ProviderId,
  baseUrl: string,
  apiKey: string,
  body: Record<string, unknown>
): Promise<{ response: Response; text: string }> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    // Fail closed: never fall back to a different model silently.
    throw new ProviderCallError(provider, "Network error calling model provider", error);
  }

  const text = await response.text();
  return { response, text };
}

export async function generateCompletion(
  params: GenerateCompletionParams
): Promise<GenerateCompletionResult> {
  const baseUrl =
    params.provider === "custom" ? params.baseUrl : DEFAULT_BASE_URLS[params.provider];

  if (!baseUrl) {
    throw new ProviderCallError(params.provider, "Missing base URL for custom provider");
  }

  const baseBody = {
    model: params.modelId,
    messages: params.messages,
    temperature: params.temperature ?? 0.2,
    max_tokens: params.maxTokens ?? 1024,
  };

  // Groq-specific: for reasoning models (DeepSeek-R1, QwQ, etc.), this tells
  // Groq's API to run the reasoning step server-side and return only the
  // final answer in `content`, instead of us guessing how to strip it
  // client-side. Not every Groq model supports the field though (it 400s on
  // non-reasoning models like llama-3.3), so if that happens we retry once
  // without it rather than failing the whole request.
  let { response, text } =
    params.provider === "groq"
      ? await callChatCompletions(params.provider, baseUrl, params.apiKey, {
          ...baseBody,
          reasoning_format: "hidden",
        })
      : await callChatCompletions(params.provider, baseUrl, params.apiKey, baseBody);

  if (!response.ok && params.provider === "groq" && text.includes("reasoning_format")) {
    ({ response, text } = await callChatCompletions(
      params.provider,
      baseUrl,
      params.apiKey,
      baseBody
    ));
  }

  if (!response.ok) {
    throw new ProviderCallError(
      params.provider,
      `Provider returned ${response.status}: ${text.slice(0, 500)}`
    );
  }

  const data = JSON.parse(text);
  const message = data?.choices?.[0]?.message;
  const rawContent = message?.content;

  if (typeof rawContent !== "string" || !rawContent.trim()) {
    // Some reasoning models return an empty `content` and put everything in
    // a separate `reasoning`/`reasoning_content` field when they run out of
    // output tokens before finishing their answer — surface that distinctly
    // so it's obvious this is a token-budget problem, not a broken response.
    const usedUpOnReasoning =
      typeof message?.reasoning === "string" || typeof message?.reasoning_content === "string";
    throw new ProviderCallError(
      params.provider,
      usedUpOnReasoning
        ? "Model spent its whole output budget on reasoning and never produced an answer — try a smaller max output or a non-reasoning model."
        : "Provider response was missing message content"
    );
  }

  return {
    content: stripReasoning(rawContent),
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  };
}

// Reasoning models (DeepSeek-R1, QwQ, etc.) served through an
// OpenAI-compatible endpoint sometimes inline their chain-of-thought in
// `content` wrapped in <think> tags instead of a separate reasoning field.
// Strip it so callers never see raw reasoning — harmless no-op otherwise.
function stripReasoning(content: string): string {
  const stripped = content.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  return stripped || content.trim();
}
