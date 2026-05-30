import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/AppScreen';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DetailRow,
  EmptyState,
  FormSheet,
  Input,
  Loading,
  Row,
  StatCard,
} from '@/components/ui';
import { SERIES_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatCurrency, formatPercent } from '@/lib/format';
import { repo } from '@/services/repo';
import type { ParentLlc } from '@/types';

export default function ParentLlcScreen() {
  const { user } = useAuth();
  const canManage = can(user?.role, 'manage_org');

  const llcAsync = useAsync(() => repo.getParentLlc(), []);
  const seriesAsync = useAsync(() => repo.listSeries(), []);
  const summaryAsync = useAsync(() => repo.summary({}), []);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<ParentLlc>>({});
  const [saving, setSaving] = useState(false);

  function openEdit() {
    if (!llcAsync.data) return;
    setForm(llcAsync.data);
    setOpen(true);
  }

  async function save() {
    if (!llcAsync.data) return;
    setSaving(true);
    await repo.updateParentLlc(llcAsync.data.id, form);
    setSaving(false);
    setOpen(false);
    llcAsync.reload();
  }

  const reload = () => {
    llcAsync.reload();
    seriesAsync.reload();
    summaryAsync.reload();
  };

  const llc = llcAsync.data;
  const s = summaryAsync.data;

  return (
    <AppScreen refreshing={llcAsync.loading} onRefresh={reload}>
      {llcAsync.loading ? (
        <Loading />
      ) : !llc ? (
        <EmptyState icon="building" title="No Parent LLC found" />
      ) : (
        <>
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-2">
              <Text className="text-2xl font-bold text-foreground">{llc.name}</Text>
              <Text className="mt-0.5 text-sm text-muted-foreground">{llc.legalName ?? llc.name}</Text>
            </View>
            {canManage ? (
              <Button title="Edit" size="sm" variant="outline" onPress={openEdit} />
            ) : null}
          </View>

          <Card>
            <CardHeader>
              <CardTitle>LLC Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <DetailRow label="EIN" value={llc.ein ?? '—'} />
              <DetailRow label="Formation State" value={llc.formationState ?? '—'} />
              <DetailRow label="Notes" value={llc.notes ?? '—'} />
            </CardContent>
          </Card>

          {s ? (
            <>
              <Text className="text-base font-semibold text-foreground">Portfolio Totals</Text>
              <View className="flex-row flex-wrap gap-3">
                <StatCard label="Collected" value={formatCurrency(s.totalRentCollected)} tone="success" />
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
                <StatCard label="Outstanding" value={formatCurrency(s.outstandingRent)} tone="warning" />
                <StatCard label="Deposits Held" value={formatCurrency(s.securityDepositsHeld)} tone="info" />
              </View>
            </>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Child Series</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {seriesAsync.loading ? (
                <View className="p-4">
                  <Loading />
                </View>
              ) : seriesAsync.data && seriesAsync.data.length > 0 ? (
                seriesAsync.data.map((cs) => (
                  <Row
                    key={cs.id}
                    title={cs.name}
                    subtitle={`Properties ${cs.propertyCount} · Units ${cs.occupiedUnits}/${cs.unitCount}`}
                    onPress={() => router.push(`/series/${cs.id}`)}
                    trailing={
                      <View className="items-end gap-1">
                        <Text
                          className={`text-base font-bold ${cs.netIncome >= 0 ? 'text-success' : 'text-danger'}`}
                        >
                          {formatCurrency(cs.netIncome)}
                        </Text>
                        <StatusBadge map={SERIES_STATUS} value={cs.status} />
                      </View>
                    }
                  />
                ))
              ) : (
                <View className="p-4">
                  <EmptyState icon="layers" title="No child series yet" />
                </View>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <FormSheet
        visible={open}
        title="Edit Parent LLC"
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitting={saving}
      >
        <Input
          label="LLC Name"
          required
          value={form.name ?? ''}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          placeholder="Evergreen Properties LLC"
        />
        <Input
          label="Legal Name"
          value={form.legalName ?? ''}
          onChangeText={(legalName) => setForm((f) => ({ ...f, legalName }))}
          placeholder="Full legal name"
        />
        <Input
          label="EIN"
          value={form.ein ?? ''}
          onChangeText={(ein) => setForm((f) => ({ ...f, ein }))}
          placeholder="88-1234567"
        />
        <Input
          label="Formation State"
          value={form.formationState ?? ''}
          onChangeText={(formationState) => setForm((f) => ({ ...f, formationState }))}
          placeholder="TX"
        />
        <Input
          label="Notes"
          value={form.notes ?? ''}
          onChangeText={(notes) => setForm((f) => ({ ...f, notes }))}
          placeholder="Optional notes"
          multiline
          numberOfLines={3}
        />
      </FormSheet>
    </AppScreen>
  );
}
