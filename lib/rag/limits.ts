// Per-plan cap on PDF pages ingested in one go when no explicit page range
// is given. Keeps a single huge PDF from blowing past what a free-tier
// tenant should reasonably index; paid plans get a much higher ceiling.
// Revisit alongside real usage-cap enforcement in Phase 9.
const PLAN_PDF_PAGE_LIMITS: Record<string, number> = {
  free: 20,
};
const DEFAULT_PDF_PAGE_LIMIT = 200;

export function getPdfPageLimit(plan: string): number {
  return PLAN_PDF_PAGE_LIMITS[plan] ?? DEFAULT_PDF_PAGE_LIMIT;
}
