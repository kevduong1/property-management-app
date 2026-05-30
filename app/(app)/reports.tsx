import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Loading,
  Row,
  SectionHeader,
  StatCard,
} from '@/components/ui';
import { RENT_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useSeries } from '@/lib/series-context';
import { formatCurrency, formatPercent } from '@/lib/format';
import { repo } from '@/services/repo';
import type { Filters } from '@/types';

export default function Reports() {
  const { selectedId } = useSeries();

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filters, setFilters] = useState<Filters>({ seriesId: selectedId });

  function applyFilters() {
    setFilters({
      seriesId: selectedId,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
    });
  }

  const summaryAsync = useAsync(() => repo.summary(filters), [filters]);
  const plAsync = useAsync(() => repo.profitAndLossBySeries(), [filters]);
  const expCatAsync = useAsync(() => repo.expenseByCategory(filters), [filters]);
  const rentChargesAsync = useAsync(
    () => repo.listRentCharges({ ...filters, seriesId: selectedId }),
    [filters, selectedId],
  );
  const tenantBalancesAsync = useAsync(() => repo.tenantBalances(), [filters]);
  const depositsAsync = useAsync(() => repo.listDeposits(filters), [filters]);

  const reload = () => {
    summaryAsync.reload();
    plAsync.reload();
    expCatAsync.reload();
    rentChargesAsync.reload();
    tenantBalancesAsync.reload();
    depositsAsync.reload();
  };

  const s = summaryAsync.data;

  return (
    <AppScreen refreshing={summaryAsync.loading} onRefresh={reload}>
      <Text className="text-2xl font-bold text-foreground">Reports</Text>
      <Text className="-mt-1 text-sm text-muted-foreground">
        {selectedId ? 'Filtered to selected series' : 'All series · parent LLC'}
      </Text>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Input
                label="From"
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View className="flex-1">
              <Input
                label="To"
                value={dateTo}
                onChangeText={setDateTo}
                placeholder="YYYY-MM-DD"
              />
            </View>
          </View>
          <View className="mt-3">
            <Button title="Apply" onPress={applyFilters} />
          </View>
        </CardContent>
      </Card>

      {/* a) Parent LLC Overview */}
      <SectionHeader title="Parent LLC Overview" />
      {summaryAsync.loading || !s ? (
        <Loading />
      ) : (
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
      )}

      {/* b) Profit & Loss by Child Series */}
      <SectionHeader title="Profit & Loss by Series" />
      <Card>
        <CardContent className="p-0">
          {plAsync.loading ? (
            <View className="p-4">
              <Loading />
            </View>
          ) : (plAsync.data ?? []).length === 0 ? (
            <View className="p-4">
              <Text className="text-sm text-muted-foreground">No data.</Text>
            </View>
          ) : (
            (plAsync.data ?? []).map((row) => (
              <Row
                key={row.series.id}
                title={row.series.name}
                subtitle={`Income ${formatCurrency(row.income)} · Expenses ${formatCurrency(row.expenses)}`}
                trailing={
                  <Text
                    className={`text-base font-bold ${row.net >= 0 ? 'text-success' : 'text-danger'}`}
                  >
                    {formatCurrency(row.net)}
                  </Text>
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* c) Income Summary by Series */}
      <SectionHeader title="Income Summary by Series" />
      <Card>
        <CardContent className="p-0">
          {(plAsync.data ?? []).map((row) => (
            <Row
              key={row.series.id}
              title={row.series.name}
              trailing={
                <Text className="text-base font-bold text-success">
                  {formatCurrency(row.income)}
                </Text>
              }
            />
          ))}
        </CardContent>
      </Card>

      {/* d) Expense Summary by Series */}
      <SectionHeader title="Expense Summary by Series" />
      <Card>
        <CardContent className="p-0">
          {(plAsync.data ?? []).map((row) => (
            <Row
              key={row.series.id}
              title={row.series.name}
              trailing={
                <Text className="text-base font-bold text-foreground">
                  {formatCurrency(row.expenses)}
                </Text>
              }
            />
          ))}
        </CardContent>
      </Card>

      {/* e) Expense Breakdown by Category */}
      <SectionHeader title="Expense Breakdown by Category" />
      <Card>
        <CardContent className="p-0">
          {expCatAsync.loading ? (
            <View className="p-4">
              <Loading />
            </View>
          ) : (expCatAsync.data ?? []).length === 0 ? (
            <View className="p-4">
              <Text className="text-sm text-muted-foreground">No expenses in range.</Text>
            </View>
          ) : (
            (expCatAsync.data ?? []).map((cat) => (
              <Row
                key={cat.name}
                title={cat.name}
                trailing={
                  <Text className="text-base font-semibold text-foreground">
                    {formatCurrency(cat.total)}
                  </Text>
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* f) Rent Roll (current, limited) */}
      <SectionHeader title="Rent Roll" />
      <Card>
        <CardContent className="p-0">
          {rentChargesAsync.loading ? (
            <View className="p-4">
              <Loading />
            </View>
          ) : (rentChargesAsync.data ?? []).length === 0 ? (
            <View className="p-4">
              <Text className="text-sm text-muted-foreground">No rent charges found.</Text>
            </View>
          ) : (
            <>
              {(rentChargesAsync.data ?? []).slice(0, 10).map((c) => (
                <Row
                  key={c.id}
                  title={c.tenantName}
                  subtitle={`${c.unitName} · ${c.propertyName}`}
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
              ))}
              {(rentChargesAsync.data ?? []).length > 10 ? (
                <View className="px-4 py-2">
                  <Text className="text-xs text-muted-foreground">
                    Showing 10 of {(rentChargesAsync.data ?? []).length} charges. Use Rent Roll for full list.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* g) Tenant Balance Report */}
      <SectionHeader title="Tenant Balance Report" />
      <Card>
        <CardContent className="p-0">
          {tenantBalancesAsync.loading ? (
            <View className="p-4">
              <Loading />
            </View>
          ) : (tenantBalancesAsync.data ?? []).length === 0 ? (
            <View className="p-4">
              <Text className="text-sm text-muted-foreground">No tenant data.</Text>
            </View>
          ) : (
            (tenantBalancesAsync.data ?? []).map((row) => (
              <Row
                key={row.tenant.id}
                title={row.tenant.fullName}
                subtitle={row.seriesName ?? '—'}
                trailing={
                  <Text
                    className={`text-base font-bold ${row.balance > 0 ? 'text-danger' : 'text-success'}`}
                  >
                    {formatCurrency(row.balance)}
                  </Text>
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* h) Security Deposit Report */}
      <SectionHeader title="Security Deposit Report" />
      <Card>
        <CardContent className="p-0">
          {depositsAsync.loading ? (
            <View className="p-4">
              <Loading />
            </View>
          ) : (depositsAsync.data ?? []).length === 0 ? (
            <View className="p-4">
              <Text className="text-sm text-muted-foreground">No security deposits.</Text>
            </View>
          ) : (
            (depositsAsync.data ?? []).map((d) => {
              const net = Number(d.amount ?? 0) - Number(d.refundAmount ?? 0);
              return (
                <Row
                  key={d.id}
                  title={`Deposit ${formatCurrency(d.amount)}`}
                  subtitle={`Refunded ${formatCurrency(d.refundAmount)}`}
                  trailing={
                    <Text className="text-base font-bold text-info">{formatCurrency(net)}</Text>
                  }
                />
              );
            })
          )}
        </CardContent>
      </Card>

      {/* j) Tax Summary Export by Series */}
      <SectionHeader title="Tax Summary by Series" />
      {(plAsync.data ?? []).map((row) => (
        <Card key={row.series.id}>
          <CardHeader>
            <CardTitle>{row.series.name}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Row title="Income" trailing={<Text className="text-sm font-semibold text-success">{formatCurrency(row.income)}</Text>} />
            <Row title="Expenses" trailing={<Text className="text-sm font-semibold text-foreground">{formatCurrency(row.expenses)}</Text>} />
            <Row
              title="Net"
              trailing={
                <Text
                  className={`text-sm font-bold ${row.net >= 0 ? 'text-success' : 'text-danger'}`}
                >
                  {formatCurrency(row.net)}
                </Text>
              }
            />
            <View className="px-4 pb-3 pt-2">
              <Button
                title="Export (coming soon)"
                variant="outline"
                size="sm"
                onPress={() =>
                  Alert.alert(
                    'Export Coming Soon',
                    'CSV and QuickBooks export is a planned feature. This will allow you to export financial data directly to spreadsheets or your accounting software.',
                  )
                }
              />
            </View>
          </CardContent>
        </Card>
      ))}
    </AppScreen>
  );
}
