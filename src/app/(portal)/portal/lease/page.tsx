import { FileSignature, MapPin, Building2, Calendar } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getTenantOverview } from "@/lib/tenant-portal";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import {
  leaseStatusLabels,
  leaseStatusTones,
  occupancyLabels,
  occupancyTones,
} from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function LeaseDetailsPage() {
  const session = await requireSession();
  const overview = await getTenantOverview(
    session.tenantId!,
    session.organizationId,
  );

  const { leases, primaryLease, deposits } = overview;

  if (!primaryLease) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Lease Details"
          description="Your lease terms and unit information."
        />
        <EmptyState
          icon={FileSignature}
          title="No lease on file"
          description="You don't have an active lease on record. Contact your property manager for assistance."
        />
      </div>
    );
  }

  const addressParts = [
    primaryLease.unit.property.addressLine1,
    primaryLease.unit.property.addressLine2,
    primaryLease.unit.property.city,
    primaryLease.unit.property.state,
    primaryLease.unit.property.postalCode,
  ].filter(Boolean);

  const primaryDeposit =
    deposits.find((d) => d.leaseId === primaryLease.id) ?? deposits[0] ?? null;

  const bedroomLabel =
    primaryLease.unit.bedrooms != null
      ? `${primaryLease.unit.bedrooms} BR`
      : null;
  const bathroomLabel =
    primaryLease.unit.bathrooms != null
      ? `${(primaryLease.unit.bathrooms / 10).toFixed(1).replace(".0", "")} BA`
      : null;
  const sqftLabel =
    primaryLease.unit.squareFeet != null
      ? `${primaryLease.unit.squareFeet.toLocaleString()} sq ft`
      : null;
  const unitDetails = [bedroomLabel, bathroomLabel, sqftLabel]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lease Details"
        description="Your lease terms, unit information, and security deposit."
      />

      {/* Lease status + term */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle>Lease Terms</CardTitle>
            <Badge tone={leaseStatusTones[primaryLease.status]}>
              {leaseStatusLabels[primaryLease.status]}
            </Badge>
          </div>
          <CardDescription>
            Current lease agreement details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <LabelValue label="Start date" value={formatDate(primaryLease.startDate)} />
            <LabelValue
              label="End date"
              value={
                primaryLease.endDate
                  ? formatDate(primaryLease.endDate)
                  : "Month-to-month"
              }
            />
            <LabelValue
              label="Monthly rent"
              value={formatCents(primaryLease.monthlyRentCents)}
            />
            <LabelValue
              label="Security deposit (in lease)"
              value={formatCents(primaryLease.securityDepositCents)}
            />
          </div>
          {primaryLease.notes ? (
            <div className="mt-4 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">Notes</p>
              <p>{primaryLease.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Unit info */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle>Unit Information</CardTitle>
            <Badge
              tone={
                occupancyTones[primaryLease.unit.occupancyStatus] ?? "muted"
              }
            >
              {occupancyLabels[primaryLease.unit.occupancyStatus] ??
                primaryLease.unit.occupancyStatus}
            </Badge>
          </div>
          <CardDescription>
            Details about your assigned unit and property
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <LabelValue
              icon={Building2}
              label="Property"
              value={primaryLease.unit.property.name}
            />
            <LabelValue
              icon={MapPin}
              label="Unit"
              value={primaryLease.unit.label}
            />
            <LabelValue
              label="Series"
              value={primaryLease.unit.property.series.name}
            />
            {unitDetails ? (
              <LabelValue label="Unit specs" value={unitDetails} />
            ) : null}
          </div>
          {addressParts.length > 0 ? (
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Property address
              </p>
              <p className="font-medium">{addressParts.join(", ")}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Security deposit */}
      <Card>
        <CardHeader>
          <CardTitle>Security Deposit</CardTitle>
          <CardDescription>
            Deposit held on file for your tenancy
          </CardDescription>
        </CardHeader>
        <CardContent>
          {primaryDeposit ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <LabelValue
                label="Amount held"
                value={formatCents(primaryDeposit.amountCents)}
              />
              <LabelValue
                label="Received"
                value={formatDate(primaryDeposit.receivedDate)}
              />
              {primaryDeposit.refundAmountCents > 0 ? (
                <LabelValue
                  label="Refunded"
                  value={formatCents(primaryDeposit.refundAmountCents)}
                />
              ) : null}
              {primaryDeposit.refundDate ? (
                <LabelValue
                  label="Refund date"
                  value={formatDate(primaryDeposit.refundDate)}
                />
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No security deposit record found. Contact your property manager if
              you believe this is incorrect.
            </p>
          )}
        </CardContent>
      </Card>

      {/* All leases (if more than one) */}
      {leases.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Lease History</CardTitle>
            <CardDescription>All leases associated with your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leases.map((lease) => (
                <div
                  key={lease.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      {lease.unit.property.name} — {lease.unit.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Calendar className="mr-1 inline h-3 w-3" />
                      {formatDate(lease.startDate)}
                      {lease.endDate ? ` – ${formatDate(lease.endDate)}` : " (open)"}
                    </p>
                  </div>
                  <Badge tone={leaseStatusTones[lease.status]}>
                    {leaseStatusLabels[lease.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function LabelValue({
  icon: Icon,
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon ? (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      ) : null}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
