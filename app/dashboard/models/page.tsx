import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { deleteModelKey, setActiveModelKey } from "./actions";
import { KeyForm } from "./key-form";
import { TestButton } from "./test-button";

export default async function ModelsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const keys = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.tenantId, session.user.tenantId))
    .orderBy(desc(apiKeys.createdAt));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Model providers</h1>
        <p className="text-sm text-muted-foreground">
          Add an OpenAI-compatible provider (NVIDIA NIM, OpenRouter, Groq, or
          a custom endpoint) and mark one as active — that's the model used
          to answer chatbot queries.
        </p>
      </div>

      <KeyForm />

      <div className="overflow-hidden rounded-lg border-2 border-border-strong shadow-hard-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Model ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No model keys yet.
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.label}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{key.provider}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{key.modelId}</TableCell>
                  <TableCell>
                    {key.isActive ? (
                      <Badge>active</Badge>
                    ) : (
                      <Badge variant="secondary">inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <TestButton keyId={key.id} />
                      {!key.isActive ? (
                        <form
                          action={async () => {
                            "use server";
                            await setActiveModelKey(key.id);
                          }}
                        >
                          <Button type="submit" variant="outline" size="sm">
                            Set active
                          </Button>
                        </form>
                      ) : null}
                      <form
                        action={async () => {
                          "use server";
                          await deleteModelKey(key.id);
                        }}
                      >
                        <Button type="submit" variant="destructive" size="sm">
                          Delete
                        </Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
