"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function DeleteButton({
  documentId,
  filename,
  onDelete,
}: {
  documentId: string;
  filename: string;
  onDelete: (documentId: string) => Promise<void>;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Delete "${filename}"? This removes it and its indexed chunks.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await onDelete(documentId);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Button type="button" variant="destructive" size="sm" onClick={handleClick} disabled={isDeleting}>
      {isDeleting ? "Deleting…" : "Delete"}
    </Button>
  );
}
