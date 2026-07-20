import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DeleteButton } from "./delete-button";
import { StatusBadge } from "./status-badge";

export interface DocumentRow {
  id: string;
  filename: string;
  docType: string;
  status: "processing" | "ready" | "failed";
  failureReason: string | null;
  uploadedAt: Date;
  totalPages: number | null;
  pageRangeFrom: number | null;
  pageRangeTo: number | null;
}

function formatPages(doc: Pick<DocumentRow, "totalPages" | "pageRangeFrom" | "pageRangeTo">): string {
  if (doc.totalPages == null) return "—";
  if (doc.pageRangeFrom != null && doc.pageRangeTo != null) {
    return `${doc.pageRangeFrom}–${doc.pageRangeTo} of ${doc.totalPages}`;
  }
  return `${doc.totalPages} page${doc.totalPages === 1 ? "" : "s"}`;
}

export function DocumentsTable({
  documents,
  onDelete,
}: {
  documents: DocumentRow[];
  onDelete: (documentId: string) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border-2 border-border-strong shadow-hard-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Filename</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Pages</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No documents yet.
              </TableCell>
            </TableRow>
          ) : (
            documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium">{doc.filename}</TableCell>
                <TableCell>
                  <Badge variant="outline">{doc.docType}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatPages(doc)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={doc.status} />
                  {doc.status === "failed" && doc.failureReason ? (
                    <p className="mt-1 text-xs text-muted-foreground">{doc.failureReason}</p>
                  ) : null}
                </TableCell>
                <TableCell>{new Date(doc.uploadedAt).toLocaleString()}</TableCell>
                <TableCell>
                  <DeleteButton documentId={doc.id} filename={doc.filename} onDelete={onDelete} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
