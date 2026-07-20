export type ProviderId = "nvidia_nim" | "openrouter" | "groq" | "custom";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateCompletionParams {
  provider: ProviderId;
  modelId: string;
  apiKey: string;
  /** Required when provider === "custom"; ignored otherwise (each known provider has a fixed base URL). */
  baseUrl?: string | null;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateCompletionResult {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export class ProviderCallError extends Error {
  constructor(
    public readonly provider: ProviderId,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ProviderCallError";
  }
}
