import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Defensive, tenant-agnostic cap per IP — protects the public /api/query
// endpoint from a single abusive client regardless of which tenant's
// site_key they're using. Not configurable per plan; this is a platform
// floor, not a tenant setting.
const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "1 m"),
  prefix: "ratelimit:ip",
});

export async function checkIpRateLimit(ip: string): Promise<boolean> {
  const { success } = await ipLimiter.limit(ip);
  return success;
}

// Public homepage demo only: a hard trial cap per IP, far stricter than any
// tenant's real rate limit — the demo is for evaluating the product, not
// for sustained use. Resets weekly rather than being a lifetime ban.
const DEMO_QUESTIONS_PER_IP = 5;
const demoLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.fixedWindow(DEMO_QUESTIONS_PER_IP, "7 d"),
  prefix: "ratelimit:demo",
});

export async function checkDemoQuestionCap(
  ip: string
): Promise<{ ok: boolean; remaining: number }> {
  const { success, remaining } = await demoLimiter.limit(ip);
  return { ok: success, remaining: Math.max(remaining, 0) };
}

export type TenantRateLimitResult =
  | { ok: true }
  | { ok: false; window: "minute" | "day" };

/**
 * Token-bucket rate limit per tenant, using the tenant's configured
 * requests-per-minute / requests-per-day (rate_limit_config table).
 * Ratelimit instances are cheap to construct (no I/O), so building one per
 * call lets the bucket size vary per tenant/plan.
 */
export async function checkTenantRateLimit(params: {
  tenantId: string;
  requestsPerMinute: number;
  requestsPerDay: number;
}): Promise<TenantRateLimitResult> {
  const minuteLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.tokenBucket(params.requestsPerMinute, "1 m", params.requestsPerMinute),
    prefix: "ratelimit:tenant:minute",
  });
  const dayLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(params.requestsPerDay, "1 d"),
    prefix: "ratelimit:tenant:day",
  });

  const [minuteResult, dayResult] = await Promise.all([
    minuteLimiter.limit(params.tenantId),
    dayLimiter.limit(params.tenantId),
  ]);

  if (!minuteResult.success) return { ok: false, window: "minute" };
  if (!dayResult.success) return { ok: false, window: "day" };
  return { ok: true };
}
