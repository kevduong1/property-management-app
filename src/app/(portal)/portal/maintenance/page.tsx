import { Wrench } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getTenantOverview } from "@/lib/tenant-portal";
import { formatDate } from "@/lib/date";
import {
  maintenanceStatusLabels,
  maintenanceStatusTones,
  maintenancePriorityLabels,
  maintenancePriorityTones,
} from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewRequestButton } from "./request-form";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const session = await requireSession();
  const overview = await getTenantOverview(
    session.tenantId!,
    session.organizationId,
  );

  const { maintenanceRequests } = overview;

  // Sort most recent first.
  const sorted = [...maintenanceRequests].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Submit and track repair requests for your unit."
      >
        <NewRequestButton />
      </PageHeader>

      {sorted.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No maintenance requests"
          description="Use the button above to submit a new repair or maintenance request."
          action={<NewRequestButton />}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((req) => (
            <Card key={req.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{req.title}</CardTitle>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      tone={
                        maintenancePriorityTones[req.priority] ?? "muted"
                      }
                    >
                      {maintenancePriorityLabels[req.priority] ?? req.priority}
                    </Badge>
                    <Badge tone={maintenanceStatusTones[req.status] ?? "muted"}>
                      {maintenanceStatusLabels[req.status] ?? req.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {req.description ? (
                  <p className="text-sm text-muted-foreground">
                    {req.description}
                  </p>
                ) : null}
                {req.resolutionNotes ? (
                  <div className="rounded-lg bg-muted/50 p-3 text-sm">
                    <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Resolution notes
                    </p>
                    <p>{req.resolutionNotes}</p>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Submitted {formatDate(req.createdAt)}
                  {req.updatedAt.getTime() !== req.createdAt.getTime()
                    ? ` · Updated ${formatDate(req.updatedAt)}`
                    : ""}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
