import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/AppScreen';
import { PageHeader } from '@/components/PageHeader';
import { NotesPanel } from '@/components/NotesPanel';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DetailRow,
  EmptyState,
  Loading,
  Row,
  StatCard,
} from '@/components/ui';
import { LEASE_STATUS, MAINTENANCE_STATUS, RENT_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { formatCurrency, formatDate } from '@/lib/format';
import { repo } from '@/services/repo';

export default function TenantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const tenantAsync = useAsync(() => repo.listTenants({ tenantId: id }), [id]);
  const leasesAsync = useAsync(() => repo.listLeases({ tenantId: id }), [id]);
  const chargesAsync = useAsync(() => repo.listRentCharges({ tenantId: id }), [id]);
  const maintenanceAsync = useAsync(() => repo.listMaintenance({ tenantId: id }), [id]);

  const loading =
    tenantAsync.loading ||
    leasesAsync.loading ||
    chargesAsync.loading ||
    maintenanceAsync.loading;

  if (tenantAsync.loading) {
    return (
      <AppScreen showSeriesBar={false}>
        <Loading />
      </AppScreen>
    );
  }

  const tenant = tenantAsync.data?.[0];

  if (!tenant) {
    return (
      <AppScreen showSeriesBar={false}>
        <PageHeader title="Tenant" back />
        <EmptyState icon="users" title="Tenant not found" />
      </AppScreen>
    );
  }

  const activeLease = leasesAsync.data?.find(
    (l) => l.status === 'active' || l.status === 'month_to_month',
  );

  const balance = tenant.balance;

  function onRefresh() {
    tenantAsync.reload();
    leasesAsync.reload();
    chargesAsync.reload();
    maintenanceAsync.reload();
  }

  return (
    <AppScreen showSeriesBar={false} refreshing={loading} onRefresh={onRefresh}>
      <PageHeader title={tenant.fullName} subtitle="Tenant" back />

      {/* Balance stat */}
      <View className="flex-row flex-wrap gap-3">
        <StatCard
          label="Outstanding Balance"
          value={formatCurrency(balance)}
          tone={balance > 0 ? 'danger' : 'success'}
        />
      </View>

      {/* Contact card */}
      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <DetailRow label="Email" value={tenant.email ?? '—'} />
          <DetailRow label="Phone" value={tenant.phone ?? '—'} />
          <DetailRow label="Emergency Contact" value={tenant.emergencyContactName ?? '—'} />
          <DetailRow label="Emergency Phone" value={tenant.emergencyContactPhone ?? '—'} />
        </CardContent>
      </Card>

      {/* Active lease */}
      <Card>
        <CardHeader>
          <CardTitle>Active Lease</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {activeLease ? (
            <>
              <DetailRow label="Unit" value={`${activeLease.propertyName} / ${activeLease.unitName}`} />
              <DetailRow label="Monthly Rent" value={formatCurrency(activeLease.monthlyRent)} />
              <DetailRow label="Start Date" value={formatDate(activeLease.startDate)} />
              <DetailRow
                label="End Date"
                value={activeLease.endDate ? formatDate(activeLease.endDate) : 'Month-to-month'}
              />
              <DetailRow
                label="Status"
                value={<StatusBadge map={LEASE_STATUS} value={activeLease.status} />}
              />
              {activeLease.securityDepositAmount ? (
                <DetailRow
                  label="Security Deposit"
                  value={formatCurrency(activeLease.securityDepositAmount)}
                />
              ) : null}
            </>
          ) : (
            <Text className="py-2 text-sm text-muted-foreground">No active lease.</Text>
          )}
        </CardContent>
      </Card>

      {/* Rent history */}
      <Card>
        <CardHeader>
          <CardTitle>Rent History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {chargesAsync.data && chargesAsync.data.length > 0 ? (
            chargesAsync.data.map((c) => (
              <Row
                key={c.id}
                title={`Due ${formatDate(c.dueDate)}`}
                subtitle={`Charge ${formatCurrency(c.rentAmount)}${Number(c.lateFeeAmount) > 0 ? ` + ${formatCurrency(c.lateFeeAmount)} late fee` : ''}`}
                meta={`Balance ${formatCurrency(c.balance)}`}
                trailing={<StatusBadge map={RENT_STATUS} value={c.computedStatus} />}
              />
            ))
          ) : (
            <View className="p-4">
              <Text className="text-sm text-muted-foreground">No rent charges yet.</Text>
            </View>
          )}
        </CardContent>
      </Card>

      {/* Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {maintenanceAsync.data && maintenanceAsync.data.length > 0 ? (
            maintenanceAsync.data.map((m) => (
              <Row
                key={m.id}
                title={m.title}
                subtitle={m.propertyName ? `${m.propertyName}${m.unitName ? ` / ${m.unitName}` : ''}` : undefined}
                meta={formatDate(m.createdAt)}
                trailing={<StatusBadge map={MAINTENANCE_STATUS} value={m.status} />}
              />
            ))
          ) : (
            <View className="p-4">
              <Text className="text-sm text-muted-foreground">No maintenance requests.</Text>
            </View>
          )}
        </CardContent>
      </Card>

      <NotesPanel entityType="tenant" entityId={id} />
    </AppScreen>
  );
}
