"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function TestButton({ keyId }: { keyId: string }) {
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );

  async function handleTest() {
    setIsTesting(true);
    setResult(null);
    try {
      const response = await fetch(`/api/model-keys/${keyId}/test`, {
        method: "POST",
      });
      const data = await response.json();
      setResult({ ok: response.ok, message: data.message ?? data.error });
    } catch {
      setResult({ ok: false, message: "Request failed" });
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleTest}
        disabled={isTesting}
      >
        {isTesting ? "Testing…" : "Test connection"}
      </Button>
      {result ? (
        <p className={`text-xs ${result.ok ? "text-muted-foreground" : "text-destructive"}`}>
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
