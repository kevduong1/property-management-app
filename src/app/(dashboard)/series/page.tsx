import Link from "next/link";
import { Layers } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { getSeriesSummaries } from "@/lib/metrics";
import { db } from "@/db";
import { childSeries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { formatCents } from "@/lib/money";
import { seriesStatusTones } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDelete } from "@/components/shared/confirm-delete";
import {
  CreateSeriesButton,
  EditSeriesButton,
} from "./series-form";
import { deleteSeries } from "./actions";

export default async function SeriesPage() {
  const session = await requireSession();
  const canCreate = can(session.role, "series", "create");
  const canEdit = can(session.role, "series", "edit");
  const canDelete = can(session.role, "series", "delete");

  const [rows, summaries] = await Promise.all([
    db
      .select()
      .from(childSeries)
      .where(eq(childSeries.organizationId, session.organizationId)),
    getSeriesSummaries(session.organizationId),
  ]);
  const summaryById = new Map(summaries.map((s) => [s.seriesId, s]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Child Series"
        description="Each child series keeps its properties and books financially separate."
      >
        {canCreate ? <CreateSeriesButton /> : null}
      </PageHeader>

      {rows.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No child series yet"
          description="Create your first child series to start organizing properties and finances."
          action={canCreate ? <CreateSeriesButton /> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => {
            const sum = summaryById.get(s.id);
            return (
              <Card key={s.id} className="flex flex-col">
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">
                      <Link
                        href={`/series/${s.id}`}
                        className="hover:underline"
                      >
                        {s.name}
                      </Link>
                    </CardTitle>
                    <Badge tone={seriesStatusTones[s.status] ?? "muted"}>
                      {s.status}
                    </Badge>
                  </div>
                  {s.description ? (
                    <CardDescription className="line-clamp-2">
                      {s.description}
                    </CardDescription>
                  ) : null}
                </CardHeader>
                <CardContent className="mt-auto space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Metric
                      label="Income"
                      value={formatCents(sum?.incomeCents ?? 0)}
                    />
                    <Metric
                      label="Expenses"
                      value={formatCents(sum?.expensesCents ?? 0)}
                    />
                    <Metric
                      label="Net"
                      value={formatCents(sum?.netCents ?? 0)}
                      tone={
                        (sum?.netCents ?? 0) >= 0 ? "success" : "danger"
                      }
                    />
                    <Metric
                      label="Outstanding"
                      value={formatCents(sum?.outstandingCents ?? 0)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {sum?.propertyCount ?? 0} properties ·{" "}
                    {sum?.unitCount ?? 0} units
                    {s.bankAccountNickname
                      ? ` · ${s.bankAccountNickname}`
                      : ""}
                  </p>
                  {canEdit || canDelete ? (
                    <div className="flex items-center gap-2 pt-1">
                      {canEdit ? <EditSeriesButton series={s} /> : null}
                      {canDelete ? (
                        <ConfirmDelete
                          action={deleteSeries}
                          id={s.id}
                          title={`Delete ${s.name}?`}
                          description="This removes the series. Properties must be moved or deleted first."
                        />
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "danger"
        ? "text-red-600"
        : "";
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
