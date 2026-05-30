import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/AppScreen';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Loading, Row, StatCard } from '@/components/ui';
import { RENT_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useSeries } from '@/lib/series-context';
import { formatCurrency, formatPercent } from '@/lib/format';
import { repo } from '@/services/repo';

export default function Dashboard() {
  const { selectedId, selected } = useSeries();
  const filters = { seriesId: selectedId };

  const summary = useAsync(() => repo.summary(filters), [selectedId]);
  const lateCharges = useAsync(
    () => repo.listRentCharges({ seriesId: selectedId, status: 'late' }),
    [selectedId],
  );
  const pl = useAsync(() => repo.profitAndLossBySeries(), []);

  const reload = () => {
    summary.reload();
    lateCharges.reload();
    pl.reload();
  };

  const s = summary.data;

  return (
    <AppScreen refreshing={summary.loading} onRefresh={reload}>
      <Text className="text-2xl font-bold text-foreground">
        {selected ? selected.name : 'Portfolio Overview'}
      </Text>
      <Text className="-mt-1 text-sm text-muted-foreground">
        {selected ? 'Child series dashboard' : 'All series · parent LLC'}
      </Text>

      {summary.loading || !s ? (
        <Loading />
      ) : (
        <>
          {/* Financial summary cards */}
          <View className="flex-row flex-wrap gap-3">
            <StatCard label="Rent Due" value={formatCurrency(s.totalRentDue)} />
            <StatCard label="Collected" value={formatCurrency(s.totalRentCollected)} tone="success" />
            <StatCard label="Outstanding" value={formatCurrency(s.outstandingRent)} tone="warning" />
            <StatCard label="Late Rent" value={formatCurrency(s.lateRent)} tone="danger" />
            <StatCard label="Expenses" value={formatCurrency(s.totalExpenses)} />
            <StatCard
              label="Net Income"
              value={formatCurrency(s.netIncome)}
              tone={s.netIncome >= 0 ? 'success' : 'danger'}
            />
            <StatCard
              label="Occupancy"
              value={formatPercent(s.occupancyRate)}
              sub={`${s.occupiedUnits}/${s.unitCount} units`}
            />
            <StatCard label="Deposits Held" value={formatCurrency(s.securityDepositsHeld)} tone="info" />
          </View>

          {/* Quick actions */}
          <View className="flex-row flex-wrap gap-2">
            <Button title="Record Payment" size="sm" onPress={() => router.push('/rent')} />
            <Button title="Add Expense" size="sm" variant="outline" onPress={() => router.push('/expenses')} />
            <Button title="Add Property" size="sm" variant="outline" onPress={() => router.push('/properties')} />
          </View>

          {/* Profit & loss by series (only on the all-series view) */}
          {!selectedId ? (
            <Card>
              <CardHeader>
                <CardTitle>Profit &amp; Loss by Series</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {pl.data?.map((row) => (
                  <Row
                    key={row.series.id}
                    title={row.series.name}
                    subtitle={`Income ${formatCurrency(row.income)} · Expenses ${formatCurrency(row.expenses)}`}
                    onPress={() => router.push(`/series/${row.series.id}`)}
                    trailing={
                      <Text className={`text-base font-bold ${row.net >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatCurrency(row.net)}
                      </Text>
                    }
                  />
                ))}
              </CardContent>
            </Card>
          ) : null}

          {/* Late rent */}
          <Card>
            <CardHeader>
              <CardTitle>Late Rent</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {lateCharges.data && lateCharges.data.length > 0 ? (
                lateCharges.data.map((c) => (
                  <Row
                    key={c.id}
                    title={c.tenantName}
                    subtitle={`${c.propertyName} · ${c.unitName}`}
                    onPress={() => router.push('/rent')}
                    trailing={
                      <View className="items-end gap-1">
                        <Text className="text-base font-bold text-danger">{formatCurrency(c.balance)}</Text>
                        <StatusBadge map={RENT_STATUS} value={c.computedStatus} />
                      </View>
                    }
                  />
                ))
              ) : (
                <View className="p-4">
                  <EmptyState icon="check" title="No late rent" message="Everyone is current. Nice." />
                </View>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AppScreen>
  );
}
