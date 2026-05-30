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
  SegmentedFilter,
  Select,
} from '@/components/ui';
import { PROPERTY_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useSeries } from '@/lib/series-context';
import { can } from '@/lib/rbac';
import { formatCurrency } from '@/lib/format';
import { repo } from '@/services/repo';
import type { Property } from '@/types';

const STATUS_FILTERS = [
  { value: null, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'sold', label: 'Sold' },
];

const STATUS_OPTIONS = Object.entries(PROPERTY_STATUS).map(([value, v]) => ({
  value,
  label: v.label,
}));

export default function PropertiesList() {
  const { user } = useAuth();
  const { seriesList, selectedId } = useSeries();
  const canManage = can(user?.role, 'manage_ops');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data, loading, reload } = useAsync(
    () => repo.listProperties({ seriesId: selectedId, status: statusFilter }),
    [selectedId, statusFilter],
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState<Partial<Property>>({});
  const [saving, setSaving] = useState(false);

  const seriesOptions = seriesList.map((s) => ({ value: s.id, label: s.name }));

  function openNew() {
    setEditing(null);
    setForm({ status: 'active', childSeriesId: selectedId ?? seriesList[0]?.id ?? '' });
    setOpen(true);
  }

  function openEdit(p: Property) {
    setEditing(p);
    setForm(p);
    setOpen(true);
  }

  async function save() {
    if (!form.name || !form.childSeriesId) return;
    setSaving(true);
    if (editing) {
      await repo.updateProperty(editing.id, form);
    } else {
      await repo.createProperty(form);
    }
    setSaving(false);
    setOpen(false);
    reload();
  }

  return (
    <AppScreen refreshing={loading} onRefresh={reload}>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">Properties</Text>
        {canManage ? <Button title="+ New" size="sm" onPress={openNew} /> : null}
      </View>

      <SegmentedFilter options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />

      {loading ? (
        <Loading />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="home"
          title="No properties yet"
          message="Add your first property to start tracking units and rent."
          action={canManage ? <Button title="Add Property" onPress={openNew} /> : undefined}
        />
      ) : (
        data.map((p) => (
          <Card key={p.id}>
            <CardContent>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-foreground">{p.name}</Text>
                  <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={1}>
                    {[p.addressLine1, p.city, p.state].filter(Boolean).join(', ')}
                  </Text>
                  <Text className="mt-0.5 text-xs text-muted-foreground">{p.seriesName}</Text>
                </View>
                <StatusBadge map={PROPERTY_STATUS} value={p.status} />
              </View>

              <View className="mt-3 flex-row flex-wrap gap-x-6 gap-y-1">
                <Metric label="Units" value={`${p.occupiedUnits}/${p.unitCount} occupied`} />
                <Metric label="Rent Roll" value={`${formatCurrency(p.monthlyRentRoll)}/mo`} />
              </View>

              <View className="mt-3 flex-row gap-2">
                <Button
                  title="Open"
                  size="sm"
                  variant="outline"
                  onPress={() => router.push(`/properties/${p.id}`)}
                />
                {canManage ? (
                  <Button title="Edit" size="sm" variant="ghost" onPress={() => openEdit(p)} />
                ) : null}
              </View>
            </CardContent>
          </Card>
        ))
      )}

      <FormSheet
        visible={open}
        title={editing ? 'Edit Property' : 'New Property'}
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitting={saving}
      >
        <Input
          label="Name"
          required
          value={form.name ?? ''}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          placeholder="123 Maple St"
        />
        <Select
          label="Series"
          required
          options={seriesOptions}
          value={form.childSeriesId ?? null}
          onChange={(v) => setForm((f) => ({ ...f, childSeriesId: v ?? '' }))}
        />
        <Input
          label="Address"
          value={form.addressLine1 ?? ''}
          onChangeText={(addressLine1) => setForm((f) => ({ ...f, addressLine1 }))}
          placeholder="123 Main St"
        />
        <Input
          label="City"
          value={form.city ?? ''}
          onChangeText={(city) => setForm((f) => ({ ...f, city }))}
          placeholder="Springfield"
        />
        <Input
          label="State"
          value={form.state ?? ''}
          onChangeText={(state) => setForm((f) => ({ ...f, state }))}
          placeholder="IL"
        />
        <Input
          label="Postal Code"
          value={form.postalCode ?? ''}
          onChangeText={(postalCode) => setForm((f) => ({ ...f, postalCode }))}
          placeholder="62701"
        />
        <Select
          label="Status"
          options={STATUS_OPTIONS}
          value={form.status ?? null}
          onChange={(v) =>
            setForm((f) => ({ ...f, status: (v as Property['status']) ?? 'active' }))
          }
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}
