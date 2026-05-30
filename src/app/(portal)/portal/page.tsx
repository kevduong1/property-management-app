import Link from "next/link";
import {
  FileSignature,
  Wallet,
  FileText,
  Wrench,
  MapPin,
  Building2,
  Layers,
} from "lucide-react";
import { requireSession } from "@/lib/auth";
import { getTenantOverview } from "@/lib/tenant-portal";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/date";
import { leaseStatusLabels, leaseStatusTones } from "@/lib/labels";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const QUICK_LINKS = [
  {
    href: "/portal/lease",
    icon: FileSignature,
    label: "View Lease",
    description: "Terms, dates, and deposit details",
  },
  {
    href: "/portal/rent",
    icon: Wallet,
    label: "Rent & Balance",
    description: "Charges, payments, and outstanding balance",
  },
  {
    href: "/portal/documents",
    icon: FileText,
    label: "Documents",
    description: "Shared notices and lease documents",
  },
  {
    href: "/portal/maintenance",
    icon: Wrench,
    label: "Maintenance",
    description: "Submit and track repair requests",
  },
];

export default async function PortalHomePage() {
  const session = await requireSession();
  // tenantId is guaranteed by the layout (which shows a friendly message if null)
  const overview = await getTenantOverview(
    session.tenantId!,
    session.organizationId,
  );

  const { primaryLease, totalBalanceCents, lateCount } = overview;

  const propertyAddress = primaryLease
    ? [
        primaryLease.unit.property.addressLine1,
        primaryLease.unit.property.city,
        primaryLease.unit.property.state,
        primaryLease.unit.property.postalCode,
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Home"
        description="Welcome to your tenant portal. Here's a snapshot of your tenancy."
      />

      {/* Property / Unit context */}
      {primaryLease ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Unit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-3">
              <InfoItem
                icon={Building2}
                label="Property"
                value={primaryLease.unit.property.name}
              />
              <InfoItem
                icon={MapPin}
                label="Unit"
                value={primaryLease.unit.label}
              />
              <InfoItem
                icon={Layers}
                label="Series"
                value={primaryLease.unit.property.series.name}
              />
            </div>
            {propertyAddress ? (
              <p className="text-sm text-muted-foreground">{propertyAddress}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={Building2}
          title="No active lease"
          description="You don't have an active lease on record. Contact your property manager if you think this is a mistake."
        />
      )}

      {/* Lease summary card */}
      {primaryLease ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Lease Summary</CardTitle>
              <Badge tone={leaseStatusTones[primaryLease.status]}>
                {leaseStatusLabels[primaryLease.status]}
              </Badge>
            </div>
            <CardDescription>
              Your current lease at a glance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <InfoItem
                label="Start date"
                value={formatDate(primaryLease.startDate)}
              />
              <InfoItem
                label="End date"
                value={
                  primaryLease.endDate
                    ? formatDate(primaryLease.endDate)
                    : "Month-to-month"
                }
              />
              <InfoItem
                label="Monthly rent"
                value={formatCents(primaryLease.monthlyRentCents)}
              />
            </div>
            <div className="mt-4 flex">
              <Button asChild variant="outline" size="sm">
                <Link href="/portal/lease">View full lease details</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Balance stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Outstanding balance"
          value={formatCents(totalBalanceCents)}
          tone={totalBalanceCents > 0 ? "danger" : "success"}
          icon={Wallet}
          sublabel={
            totalBalanceCents === 0
              ? "All paid up"
              : "Unpaid charges remain"
          }
        />
        <StatCard
          label="Late charges"
          value={String(lateCount)}
          tone={lateCount > 0 ? "danger" : "success"}
          icon={Wallet}
          sublabel={lateCount === 0 ? "No late charges" : `${lateCount} overdue`}
        />
        <StatCard
          label="Monthly rent"
          value={
            primaryLease
              ? formatCents(primaryLease.monthlyRentCents)
              : "—"
          }
          tone="default"
          icon={Building2}
          sublabel="Per your current lease"
        />
      </div>

      {/* Quick links */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Quick links
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary hover:bg-accent"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted group-hover:bg-primary/10">
                  <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{link.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {link.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function InfoItem({
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
