"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DOC_TYPES = ["policy", "faq", "pricing", "about"] as const;

export function UploadForm({ adminToken }: { adminToken?: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [docType, setDocType] = useState<string>("faq");
  const [isPdf, setIsPdf] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    if (!formData.get("file") || (formData.get("file") as File).size === 0) {
      setError("Choose a file to upload.");
      return;
    }
    if (adminToken) {
      formData.set("adminToken", adminToken);
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Upload failed");
        return;
      }
      if (result.status === "failed") {
        setError(result.error ?? "Ingestion failed");
      }

      formRef.current?.reset();
      setIsPdf(false);
      router.refresh();
    } catch {
      setError("Upload failed — check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border-2 border-border-strong bg-card p-4 shadow-hard-sm"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="doc-type">Document type</Label>
        <Select
          value={docType}
          onValueChange={(value) => setDocType(value ?? "faq")}
        >
          <SelectTrigger id="doc-type" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOC_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="docType" value={docType} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="file">File (PDF or .txt)</Label>
        <Input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.txt"
          required
          onChange={(e) => setIsPdf(e.target.files?.[0]?.type === "application/pdf")}
        />
      </div>

      {isPdf ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fromPage">Page range (optional)</Label>
          <div className="flex items-center gap-1.5">
            <Input
              id="fromPage"
              name="fromPage"
              type="number"
              min={1}
              placeholder="from"
              className="w-20"
            />
            <span className="text-sm text-muted-foreground">to</span>
            <Input
              id="toPage"
              name="toPage"
              type="number"
              min={1}
              placeholder="to"
              className="w-20"
            />
          </div>
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Uploading…" : "Upload"}
      </Button>

      {isPdf ? (
        <p className="w-full text-xs text-muted-foreground">
          Leave the page range blank to ingest the whole PDF (free plan: up
          to 20 pages). For bigger PDFs, pick a page range to ingest just
          that section.
        </p>
      ) : null}
      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
