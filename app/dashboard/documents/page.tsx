import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";

import { clearAllDocuments, deleteDocument } from "./actions";
import { ClearAllButton } from "./clear-all-button";
import { DocumentsTable } from "./documents-table";
import { UploadForm } from "./upload-form";

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user?.tenantId) {
    redirect("/login");
  }

  const tenantDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.tenantId, session.user.tenantId))
    .orderBy(desc(documents.uploadedAt));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Upload policy, FAQ, pricing, and about docs to power the chatbot's
            retrieval.
          </p>
        </div>
        {tenantDocuments.length > 0 ? <ClearAllButton onClear={clearAllDocuments} /> : null}
      </div>

      <UploadForm />

      <DocumentsTable documents={tenantDocuments} onDelete={deleteDocument} />
    </div>
  );
}
