import { Text, View } from 'react-native';
import {
  Screen,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DetailRow,
  EmptyState,
  Loading,
  Row,
} from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { LEASE_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/format';
import { repo } from '@/services/repo';
import type { DocumentView, LeaseView } from '@/types';

export default function TenantLease() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;

  const leasesAsync = useAsync(
    () => (tenantId ? repo.listLeases({ tenantId }) : Promise.resolve([])),
    [tenantId],
  );
  const docsAsync = useAsync(() => repo.listDocuments({}), []);

  const reload = () => {
    leasesAsync.reload();
    docsAsync.reload();
  };

  const lease: LeaseView | null = leasesAsync.data?.[0] ?? null;

  const sharedDocs: DocumentView[] = (docsAsync.data ?? []).filter((d) => {
    if (!d.sharedWithTenant) return false;
    if (d.entityType === 'lease' && d.entityId === lease?.id) return true;
    if (d.entityType === 'tenant' && d.entityId === tenantId) return true;
    if (d.entityType === 'unit' && d.entityId === lease?.unitId) return true;
    return false;
  });

  const loading = leasesAsync.loading || docsAsync.loading;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Text className="text-2xl font-bold text-foreground">Lease</Text>

      {leasesAsync.loading ? (
        <Loading />
      ) : !lease ? (
        <EmptyState
          icon="file"
          title="No lease found"
          message="Contact your property manager if you believe this is an error."
        />
      ) : (
        <>
          {/* Lease Details */}
          <Card>
            <CardHeader>
              <View className="flex-row items-center justify-between">
                <CardTitle>Lease Details</CardTitle>
                <StatusBadge map={LEASE_STATUS} value={lease.status} />
              </View>
            </CardHeader>
            <CardContent className="pt-0">
              <DetailRow label="Unit" value={lease.unitName} />
              <DetailRow label="Property" value={lease.propertyName} />
              <DetailRow label="Series" value={lease.seriesName} />
              <DetailRow label="Start Date" value={formatDate(lease.startDate)} />
              <DetailRow
                label="End Date"
                value={lease.endDate ? formatDate(lease.endDate) : 'Month-to-month'}
              />
              <DetailRow label="Monthly Rent" value={formatCurrency(lease.monthlyRent)} />
              <DetailRow
                label="Security Deposit"
                value={formatCurrency(lease.securityDepositAmount)}
              />
              <DetailRow label="Rent Due Day" value={`Day ${lease.rentDueDay} of month`} />
              {lease.notes ? <DetailRow label="Notes" value={lease.notes} /> : null}
            </CardContent>
          </Card>

          {/* Shared Documents */}
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {docsAsync.loading ? (
                <View className="p-4">
                  <Loading />
                </View>
              ) : sharedDocs.length === 0 ? (
                <View className="p-4">
                  <EmptyState
                    icon="folder"
                    title="No documents shared"
                    message="Your property manager has not shared any documents yet."
                  />
                </View>
              ) : (
                sharedDocs.map((d) => (
                  <Row key={d.id} title={d.title} subtitle={d.documentType} />
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Screen>
  );
}
