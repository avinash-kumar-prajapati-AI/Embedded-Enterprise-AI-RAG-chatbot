"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: { documentId: string; filename: string; docType: string; score: number }[];
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
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
      const response = await fetch("/api/demo/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, history }),
      });

      const rawBody = await response.text();
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(rawBody);
      } catch {
        throw new Error(`Server returned a non-JSON response (status ${response.status}): ${rawBody.slice(0, 200)}`);
      }

      if (typeof data.remainingDemoQuestions === "number") {
        setRemaining(data.remainingDemoQuestions);
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
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="mb-3 flex h-[32rem] w-[22rem] flex-col overflow-hidden rounded-lg border-2 border-border-strong bg-card shadow-hard-lg sm:w-96">
          <div className="flex items-center justify-between border-b-2 border-border-strong bg-primary px-4 py-3">
            <div>
              <p className="font-bold text-primary-foreground">Ask the demo bot</p>
              <p className="text-xs text-primary-foreground/80">
                {remaining !== null ? `${remaining} question${remaining === 1 ? "" : "s"} left` : "5 free questions"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1 text-primary-foreground hover:bg-primary-foreground/10"
              aria-label="Close chat"
            >
              <X className="size-5" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
            {turns.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ask a question about the sample documents below.
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
                      <Badge key={s.documentId} variant="outline" className="text-[10px]">
                        {s.filename}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {isSending ? <p className="text-sm text-muted-foreground">Thinking…</p> : null}
          </div>

          <div className="flex gap-2 border-t-2 border-border-strong p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
              placeholder="Ask a question…"
              disabled={remaining === 0}
            />
            <Button onClick={handleSend} disabled={isSending || remaining === 0} size="sm">
              Send
            </Button>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        size="icon-lg"
        onClick={() => setIsOpen((v) => !v)}
        className="size-14 rounded-full shadow-hard-lg"
        aria-label={isOpen ? "Close chat" : "Open chat"}
      >
        {isOpen ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </Button>
    </div>
  );
}
