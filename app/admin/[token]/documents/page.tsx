import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { getOrCreateDemoTenant, isValidAdminToken } from "@/lib/demo";

import { adminClearAllDocuments, adminDeleteDocument } from "./actions";
import { ClearAllButton } from "../../../dashboard/documents/clear-all-button";
import { DocumentsTable } from "../../../dashboard/documents/documents-table";
import { UploadForm } from "../../../dashboard/documents/upload-form";

export default async function AdminDocumentsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidAdminToken(token)) {
    notFound();
  }

  const demoTenant = await getOrCreateDemoTenant();
  const demoDocuments = await db
    .select()
    .from(documents)
    .where(eq(documents.tenantId, demoTenant.id))
    .orderBy(desc(documents.uploadedAt));

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Demo documents</h1>
          <p className="text-sm text-muted-foreground">
            These power the public "try it live" widget on the homepage.
            Site key: <span className="font-mono">{demoTenant.siteKey}</span>
          </p>
        </div>
        {demoDocuments.length > 0 ? (
          <ClearAllButton onClear={adminClearAllDocuments.bind(null, token)} />
        ) : null}
      </div>

      <UploadForm adminToken={token} />

      <DocumentsTable documents={demoDocuments} onDelete={adminDeleteDocument.bind(null, token)} />
    </div>
  );
}
