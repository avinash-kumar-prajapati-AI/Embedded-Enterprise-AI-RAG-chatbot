# lib/providers

Model provider abstraction (Phase 4). `generateCompletion()` in `index.ts`
handles NVIDIA NIM, OpenRouter, Groq, and custom endpoints through one
OpenAI-compatible chat-completions implementation — they only differ by
base URL. Throws `ProviderCallError` on failure; callers must not silently
fall back to a different model on error (log it, surface a clean message).
