import { desc, eq } from "drizzle-orm";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChatWidget } from "@/components/widget/chat-widget";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getOrCreateDemoTenant } from "@/lib/demo";

// The demo document list changes whenever the admin uploads/deletes docs —
// must be rendered per-request, not baked in at build time.
export const dynamic = "force-dynamic";

const FEATURES = [
  {
    title: "Metadata-filtered retrieval",
    description:
      "pgvector similarity search scoped by tenant and doc_type, with a confidence gate that asks a clarifying question instead of guessing.",
  },
  {
    title: "Bring your own model",
    description:
      "NVIDIA NIM, Groq, OpenRouter, or any OpenAI-compatible custom endpoint — swap providers without touching code.",
  },
  {
    title: "Cost-aware safety pipeline",
    description:
      "Rate limiting, moderation, and confidence gating all run before a single token is spent on a real LLM call.",
  },
  {
    title: "Tenant-scoped everywhere",
    description:
      "Every table, every query, every embed snippet is scoped by tenant — the widget only ever sees its own site_key.",
  },
];

export default async function Home() {
  const demoTenant = await getOrCreateDemoTenant();
  const demoDocuments = await db
    .select({ filename: documents.filename, docType: documents.docType })
    .from(documents)
    .where(eq(documents.tenantId, demoTenant.id))
    .orderBy(desc(documents.uploadedAt));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-border-strong">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold">RAG Chatbot Platform</span>
          <Button render={<Link href="/login" />} nativeButton={false} variant="outline" size="sm">
            Sign in
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <Badge variant="secondary" className="mb-4">
          Beta — try the live demo below
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          A support chatbot that only answers from{" "}
          <span className="text-primary">your documents</span>.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Upload policy, FAQ, and pricing docs. Get an embeddable widget that
          retrieves the right passage, cites its source, and asks for
          clarification instead of making things up.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button render={<Link href="/login" />} nativeButton={false} size="lg">
            Get started
          </Button>
          <span className="text-sm text-muted-foreground">
            or click the chat bubble, bottom right, to try it now
          </span>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <Card className="border-2 border-border-strong shadow-hard">
          <CardHeader>
            <CardTitle>Try it live</CardTitle>
            <CardDescription>
              This demo is answering from the sample documents below —
              5 free questions per visitor. Open the chat bubble in the
              corner to ask something.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {demoDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No demo documents uploaded yet.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {demoDocuments.map((doc) => (
                  <Badge key={doc.filename} variant="outline">
                    {doc.filename} · {doc.docType}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="border-t-2 border-border-strong bg-secondary/40 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-bold">
            Built for the whole pipeline, not just the chat
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="border-2 border-border-strong shadow-hard-sm">
                <CardHeader>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-border-strong py-8 text-center text-sm text-muted-foreground">
        Built as a solo portfolio project — Next.js, Postgres/pgvector, Redis.
      </footer>

      <ChatWidget />
    </div>
  );
}
