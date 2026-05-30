import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/AppScreen';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  FormSheet,
  Input,
  Loading,
  Select,
} from '@/components/ui';
import { SERIES_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useSeries } from '@/lib/series-context';
import { can } from '@/lib/rbac';
import { formatCurrency } from '@/lib/format';
import { repo } from '@/services/repo';
import type { ChildSeries } from '@/types';

const STATUS_OPTIONS = Object.entries(SERIES_STATUS).map(([value, v]) => ({ value, label: v.label }));

export default function SeriesList() {
  const { user } = useAuth();
  const { refresh: refreshContext } = useSeries();
  const canManage = can(user?.role, 'manage_ops');
  const { data, loading, reload } = useAsync(() => repo.listSeries(), []);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ChildSeries | null>(null);
  const [form, setForm] = useState<Partial<ChildSeries>>({});
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setForm({ status: 'active' });
    setOpen(true);
  }
  function openEdit(s: ChildSeries) {
    setEditing(s);
    setForm(s);
    setOpen(true);
  }
  async function save() {
    if (!form.name) return;
    setSaving(true);
    if (editing) await repo.updateSeries(editing.id, form);
    else await repo.createSeries(form);
    setSaving(false);
    setOpen(false);
    reload();
    refreshContext();
  }

  return (
    <AppScreen refreshing={loading} onRefresh={reload}>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">Child Series</Text>
        {canManage ? <Button title="+ New" size="sm" onPress={openNew} /> : null}
      </View>
      <Text className="-mt-1 text-sm text-muted-foreground">
        Each series isolates finances & liability under the parent LLC.
      </Text>

      {loading ? (
        <Loading />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="layers"
          title="No child series yet"
          message="Create your first series to start organizing properties and finances."
          action={canManage ? <Button title="Create Series" onPress={openNew} /> : undefined}
        />
      ) : (
        data.map((s) => (
          <Card key={s.id}>
            <CardContent>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-foreground">{s.name}</Text>
                  {s.description ? (
                    <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={2}>
                      {s.description}
                    </Text>
                  ) : null}
                </View>
                <StatusBadge map={SERIES_STATUS} value={s.status} />
              </View>

              <View className="mt-3 flex-row flex-wrap gap-x-6 gap-y-1">
                <Metric label="Properties" value={String(s.propertyCount)} />
                <Metric label="Units" value={`${s.occupiedUnits}/${s.unitCount}`} />
                <Metric label="Income" value={formatCurrency(s.income)} />
                <Metric label="Expenses" value={formatCurrency(s.expenses)} />
                <Metric
                  label="Net"
                  value={formatCurrency(s.netIncome)}
                  tone={s.netIncome >= 0 ? 'success' : 'danger'}
                />
              </View>

              <View className="mt-3 flex-row gap-2">
                <Button title="Open" size="sm" variant="outline" onPress={() => router.push(`/series/${s.id}`)} />
                {canManage ? (
                  <Button title="Edit" size="sm" variant="ghost" onPress={() => openEdit(s)} />
                ) : null}
              </View>
            </CardContent>
          </Card>
        ))
      )}

      <FormSheet
        visible={open}
        title={editing ? 'Edit Series' : 'New Child Series'}
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitting={saving}
      >
        <Input
          label="Name"
          required
          value={form.name ?? ''}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          placeholder="Series A — Maple Street"
        />
        <Input
          label="Description / Notes"
          value={form.description ?? ''}
          onChangeText={(description) => setForm((f) => ({ ...f, description }))}
          placeholder="What this series holds"
          multiline
          numberOfLines={3}
        />
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={form.status}
          onChange={(status) => setForm((f) => ({ ...f, status: (status as ChildSeries['status']) ?? 'active' }))}
        />
        <Input
          label="EIN (optional)"
          value={form.ein ?? ''}
          onChangeText={(ein) => setForm((f) => ({ ...f, ein }))}
          placeholder="88-1234567"
        />
        <Input
          label="Bank Account Nickname (optional)"
          value={form.bankAccountNickname ?? ''}
          onChangeText={(bankAccountNickname) => setForm((f) => ({ ...f, bankAccountNickname }))}
          placeholder="Evergreen A Checking"
        />
      </FormSheet>
    </AppScreen>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'danger' }) {
  return (
    <View>
      <Text className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Text>
      <Text
        className={`text-sm font-semibold ${
          tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-foreground'
        }`}
      >
        {value}
      </Text>
    </View>
  );
}
