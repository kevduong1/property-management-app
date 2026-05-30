import { Text, View } from 'react-native';
import { Screen, StatCard, Card, CardContent, CardHeader, CardTitle, EmptyState, Loading, Row } from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { LEASE_STATUS, RENT_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { formatCurrency, formatDate } from '@/lib/format';
import { repo } from '@/services/repo';

export default function TenantHome() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;

  const leasesAsync = useAsync(
    () => (tenantId ? repo.listLeases({ tenantId }) : Promise.resolve([])),
    [tenantId],
  );
  const chargesAsync = useAsync(
    () => (tenantId ? repo.listRentCharges({ tenantId }) : Promise.resolve([])),
    [tenantId],
  );
  const paymentsAsync = useAsync(
    () => (tenantId ? repo.listPayments({ tenantId }) : Promise.resolve([])),
    [tenantId],
  );

  const reload = () => {
    leasesAsync.reload();
    chargesAsync.reload();
    paymentsAsync.reload();
  };

  const lease = leasesAsync.data?.[0] ?? null;
  const totalBalance = (chargesAsync.data ?? []).reduce((sum, c) => sum + c.balance, 0);
  const loading = leasesAsync.loading || chargesAsync.loading || paymentsAsync.loading;

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <Text className="text-2xl font-bold text-foreground">
        Hi, {user?.fullName ?? 'there'}
      </Text>
      <Text className="-mt-1 text-sm text-muted-foreground">Your home overview</Text>

      {loading && !lease ? (
        <Loading />
      ) : (
        <>
          {/* Assigned Unit */}
          <Card>
            <CardHeader>
              <CardTitle>Your Unit</CardTitle>
            </CardHeader>
            <CardContent>
              {lease ? (
                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">{lease.unitName}</Text>
                  <Text className="text-sm text-muted-foreground">{lease.propertyName}</Text>
                  <Text className="text-xs text-muted-foreground">{lease.seriesName}</Text>
                </View>
              ) : (
                <EmptyState icon="door" title="No unit assigned" message="Contact your property manager." />
              )}
            </CardContent>
          </Card>

          {/* Lease Summary */}
          {lease ? (
            <Card>
              <CardHeader>
                <CardTitle>Lease Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <View className="mb-2">
                  <StatusBadge map={LEASE_STATUS} value={lease.status} />
                </View>
                <View className="gap-1">
                  <Text className="text-sm text-muted-foreground">
                    Start: <Text className="font-medium text-foreground">{formatDate(lease.startDate)}</Text>
                  </Text>
                  {lease.endDate ? (
                    <Text className="text-sm text-muted-foreground">
                      End: <Text className="font-medium text-foreground">{formatDate(lease.endDate)}</Text>
                    </Text>
                  ) : null}
                  <Text className="text-sm text-muted-foreground">
                    Monthly Rent:{' '}
                    <Text className="font-medium text-foreground">
                      {formatCurrency(lease.monthlyRent)}
                    </Text>
                  </Text>
                </View>
              </CardContent>
            </Card>
          ) : null}

          {/* Current Balance */}
          <View className="flex-row">
            <StatCard
              label="Current Balance"
              value={formatCurrency(totalBalance)}
              tone={totalBalance > 0 ? 'danger' : 'success'}
              sub={totalBalance > 0 ? 'Amount owed' : 'All paid up!'}
            />
          </View>

          {/* Rent Charge History */}
          <Card>
            <CardHeader>
              <CardTitle>Rent Charges</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {chargesAsync.loading ? (
                <View className="p-4">
                  <Loading />
                </View>
              ) : (chargesAsync.data ?? []).length === 0 ? (
                <View className="p-4">
                  <EmptyState icon="dollar" title="No charges yet" />
                </View>
              ) : (
                (chargesAsync.data ?? []).map((c) => (
                  <Row
                    key={c.id}
                    title={`Due ${formatDate(c.dueDate)}`}
                    subtitle={formatCurrency(c.rentAmount)}
                    trailing={
                      <View className="items-end gap-1">
                        <Text
                          className={`text-sm font-bold ${c.balance > 0 ? 'text-danger' : 'text-success'}`}
                        >
                          {formatCurrency(c.balance)}
                        </Text>
                        <StatusBadge map={RENT_STATUS} value={c.computedStatus} />
                      </View>
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {paymentsAsync.loading ? (
                <View className="p-4">
                  <Loading />
                </View>
              ) : (paymentsAsync.data ?? []).length === 0 ? (
                <View className="p-4">
                  <EmptyState icon="dollar" title="No payments yet" />
                </View>
              ) : (
                (paymentsAsync.data ?? []).map((p) => (
                  <Row
                    key={p.id}
                    title={formatCurrency(p.amount)}
                    subtitle={`${formatDate(p.receivedDate)} · ${p.method}`}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Screen>
  );
}
