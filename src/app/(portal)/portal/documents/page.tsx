import { FileText, Download } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getTenantOverview } from "@/lib/tenant-portal";
import { formatDate } from "@/lib/date";
import { documentTypeLabels } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const session = await requireSession();
  const overview = await getTenantOverview(
    session.tenantId!,
    session.organizationId,
  );

  const { documents } = overview;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Documents shared with you by your property manager."
      />

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents shared yet"
          description="Your property manager will share lease documents, notices, and other files here when they're available."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Shared Documents ({documents.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-start justify-between gap-4 px-6 py-4"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{doc.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <Badge tone="muted">
                          {documentTypeLabels[doc.type] ?? doc.type}
                        </Badge>
                        {doc.fileName ? (
                          <span className="text-xs text-muted-foreground">
                            {doc.fileName}
                            {doc.sizeBytes
                              ? ` · ${formatBytes(doc.sizeBytes)}`
                              : ""}
                          </span>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          Added {formatDate(doc.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {doc.storageKey ? (
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      className="flex shrink-0 items-center gap-1 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
                      download={doc.fileName ?? true}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      No file attached
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
