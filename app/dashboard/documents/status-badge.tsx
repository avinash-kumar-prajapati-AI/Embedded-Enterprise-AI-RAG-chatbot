import { Badge } from "@/components/ui/badge";

const VARIANTS = {
  ready: "default",
  processing: "secondary",
  failed: "destructive",
} as const;

export function StatusBadge({ status }: { status: keyof typeof VARIANTS }) {
  return <Badge variant={VARIANTS[status]}>{status}</Badge>;
}
