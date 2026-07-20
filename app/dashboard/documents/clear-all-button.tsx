"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function ClearAllButton({ onClear }: { onClear: () => Promise<void> }) {
  const router = useRouter();
  const [isClearing, setIsClearing] = useState(false);

  async function handleClick() {
    if (!window.confirm("Delete all documents and chunks for this workspace? This can't be undone.")) {
      return;
    }
    setIsClearing(true);
    try {
      await onClear();
      router.refresh();
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <Button type="button" variant="destructive" size="sm" onClick={handleClick} disabled={isClearing}>
      {isClearing ? "Clearing…" : "Clear all documents"}
    </Button>
  );
}
