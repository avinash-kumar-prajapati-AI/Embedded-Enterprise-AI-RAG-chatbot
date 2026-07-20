"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: { documentId: string; filename: string; docType: string; score: number }[];
}

export function ChatTest({ siteKey }: { siteKey: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  async function handleSend() {
    const query = input.trim();
    if (!query || isSending) return;

    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((prev) => [...prev, { role: "user", content: query }]);
    setInput("");
    setIsSending(true);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteKey, query, history }),
      });

      const rawBody = await response.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawBody);
      } catch {
        throw new Error(`Server returned a non-JSON response (status ${response.status}): ${rawBody.slice(0, 200)}`);
      }

      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: (data.message as string) ?? (data.error as string) ?? "No response",
          sources: data.sources as Turn["sources"],
        },
      ]);
    } catch (error) {
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: error instanceof Error ? `Request failed: ${error.message}` : "Request failed — check your connection.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        ref={scrollRef}
        className="h-112 space-y-3 overflow-y-auto rounded-lg border-2 border-border-strong bg-card p-4 shadow-hard-sm"
      >
        {turns.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ask a question about your uploaded documents.
          </p>
        ) : null}
        {turns.map((turn, i) => (
          <div key={i} className={turn.role === "user" ? "text-right" : "text-left"}>
            <p className="inline-block max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-left text-sm">
              {turn.content}
            </p>
            {turn.sources && turn.sources.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {turn.sources.map((s) => (
                  <Badge key={s.documentId} variant="outline">
                    {s.filename} ({s.score.toFixed(2)})
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {isSending ? <p className="text-sm text-muted-foreground">Thinking…</p> : null}
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Ask a question…"
        />
        <Button onClick={handleSend} disabled={isSending}>
          {isSending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
