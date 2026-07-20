/**
 * Returns the first defined, non-empty env var among the given names.
 *
 * Vercel's marketplace integrations (Supabase, Upstash, etc.) inject their
 * own env var names — often with a project-specific prefix (e.g.
 * `RAG_POSTGRES_URL`) — instead of the generic name our code was written
 * against. Rather than requiring a manually-copied duplicate (which would
 * silently go stale if the integration rotates credentials), each variable
 * we read supports a short list of fallback names.
 */
export function resolveEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}
