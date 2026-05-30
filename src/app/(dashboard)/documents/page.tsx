import { FileText } from "lucide-react";
import { and, eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { documentTypeLabels, titleCase } from "@/lib/labels";
import { formatDate } from "@/lib/date";
import {
  seriesOptions,
  propertyOptions,
  unitOptions,
  tenantOptions,
  getPrimaryParentLlc,
} from "@/lib/lookups";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import { CreateDocumentButton } from "./document-form";
import { deleteDocument } from "./actions";
import type { DocumentType } from "@/db/schema";

export const dynamic = "force-dynamic";

const DOCUMENT_TYPE_FILTER_OPTIONS = (
  Object.keys(documentTypeLabels) as DocumentType[]
).map((t) => ({ value: t, label: documentTypeLabels[t] }));

const documentTypeTones: Record<
  DocumentType,
  "default" | "success" | "info" | "warning" | "danger" | "muted"
> = {
  lease: "success",
  receipt: "info",
  invoice: "warning",
  insurance: "info",
  formation: "default",
  vendor_contract: "muted",
  tenant_notice: "warning",
  inspection_photo: "muted",
  other: "muted",
};

export default async function DocumentsPage(props: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await props.searchParams;
  const session = await requireSession();
  const orgId = session.organizationId;

  const canCreate = can(session.role, "document", "create");
  const canDelete = can(session.role, "document", "delete");

  const seriesFilter = sp.series ?? null;
  const typeFilter = (sp.type as DocumentType) ?? null;

  const [
    seriesOpts,
    propOpts,
    unitOpts,
    tenantOpts,
    parentLlc,
  ] = await Promise.all([
    seriesOptions(orgId),
    propertyOptions(orgId, seriesFilter),
    unitOptions(orgId, seriesFilter),
    tenantOptions(orgId),
    getPrimaryParentLlc(orgId),
  ]);

  // Query documents with filters
  const conds = [eq(documents.organizationId, orgId)];
  if (seriesFilter) conds.push(eq(documents.childSeriesId, seriesFilter));
  if (typeFilter) conds.push(eq(documents.type, typeFilter));

  const rows = await db
    .select()
    .from(documents)
    .where(and(...conds))
    .orderBy(documents.createdAt);

  const filters = [
    {
      key: "series",
      label: "Series",
      options: seriesOpts,
      allLabel: "All series",
    },
    {
      key: "type",
      label: "Type",
      options: DOCUMENT_TYPE_FILTER_OPTIONS,
      allLabel: "All types",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documents"
        description="Upload and manage documents for your portfolio entities."
      >
        {canCreate ? (
          <CreateDocumentButton
            seriesOptions={seriesOpts}
            propertyOptions={propOpts}
            unitOptions={unitOpts}
            tenantOptions={tenantOpts}
            parentLlcId={parentLlc?.id ?? null}
            parentLlcName={parentLlc?.name ?? null}
          />
        ) : null}
      </PageHeader>

      <FilterBar filters={filters} />

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload lease agreements, receipts, insurance docs, and more."
          action={
            canCreate ? (
              <CreateDocumentButton
                seriesOptions={seriesOpts}
                propertyOptions={propOpts}
                unitOptions={unitOpts}
                tenantOptions={tenantOpts}
                parentLlcId={parentLlc?.id ?? null}
                parentLlcName={parentLlc?.name ?? null}
              />
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Attached to</TableHead>
                <TableHead>Shared</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Uploaded</TableHead>
                {canDelete ? <TableHead className="w-[60px]" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {doc.title}
                  </TableCell>
                  <TableCell>
                    <Badge tone={documentTypeTones[doc.type] ?? "muted"}>
                      {documentTypeLabels[doc.type]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {titleCase(doc.entityType)}
                  </TableCell>
                  <TableCell>
                    {doc.sharedWithTenant ? (
                      <Badge tone="info">Shared</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        Private
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[160px] truncate">
                    {doc.fileName ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground whitespace-nowrap">
                    {formatDate(doc.createdAt)}
                  </TableCell>
                  {canDelete ? (
                    <TableCell>
                      <ConfirmDelete
                        action={deleteDocument}
                        id={doc.id}
                        title={`Delete "${doc.title}"?`}
                        description="This removes the document record. The uploaded file may remain in storage."
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
