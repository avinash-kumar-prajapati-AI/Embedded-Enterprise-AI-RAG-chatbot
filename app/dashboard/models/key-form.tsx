"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { createModelKey } from "./actions";

const PROVIDERS = [
  { value: "nvidia_nim", label: "NVIDIA NIM" },
  { value: "openrouter", label: "OpenRouter" },
  { value: "groq", label: "Groq" },
  { value: "custom", label: "Custom (OpenAI-compatible)" },
] as const;

export function KeyForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [provider, setProvider] = useState<string>("groq");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsSubmitting(true);
    try {
      await createModelKey(formData);
      formRef.current?.reset();
      setProvider("groq");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add model key");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-lg border-2 border-border-strong bg-card p-4 shadow-hard-sm"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="provider">Provider</Label>
        <Select
          value={provider}
          onValueChange={(value) => setProvider(value ?? "groq")}
        >
          <SelectTrigger id="provider" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name="provider" value={provider} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="modelId">Model ID</Label>
        <Input
          id="modelId"
          name="modelId"
          placeholder="e.g. llama-3.1-70b-versatile"
          required
          className="w-56"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="label">Label</Label>
        <Input id="label" name="label" placeholder="e.g. Groq Llama 70B" required />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="apiKey">API key</Label>
        <Input id="apiKey" name="apiKey" type="password" required />
      </div>

      {provider === "custom" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="baseUrl">Base URL</Label>
          <Input
            id="baseUrl"
            name="baseUrl"
            placeholder="https://api.example.com/v1"
            required
            className="w-64"
          />
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Adding…" : "Add model key"}
      </Button>

      {error ? <p className="w-full text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
