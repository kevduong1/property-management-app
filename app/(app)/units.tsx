import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
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
  Row,
  SegmentedFilter,
  Select,
} from '@/components/ui';
import { OCCUPANCY_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useSeries } from '@/lib/series-context';
import { can } from '@/lib/rbac';
import { formatCurrency } from '@/lib/format';
import { repo } from '@/services/repo';
import type { Unit } from '@/types';

const OCCUPANCY_FILTERS = [
  { value: null, label: 'All' },
  { value: 'occupied', label: 'Occupied' },
  { value: 'vacant', label: 'Vacant' },
  { value: 'unavailable', label: 'Unavailable' },
];

const OCCUPANCY_OPTIONS = Object.entries(OCCUPANCY_STATUS).map(([value, v]) => ({
  value,
  label: v.label,
}));

export default function UnitsList() {
  const { user } = useAuth();
  const { selectedId } = useSeries();
  const canManage = can(user?.role, 'manage_ops');

  const [occupancy, setOccupancy] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);

  const properties = useAsync(() => repo.listProperties({ seriesId: selectedId }), [selectedId]);
  const { data, loading, reload } = useAsync(
    () => repo.listUnits({ seriesId: selectedId, propertyId, occupancy }),
    [selectedId, propertyId, occupancy],
  );

  const propertyOptions = useMemo(
    () => (properties.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [properties.data],
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [form, setForm] = useState<Partial<Unit>>({});
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setForm({
      occupancyStatus: 'vacant',
      monthlyRent: '0',
      propertyId: propertyId ?? (properties.data?.[0]?.id ?? ''),
    });
    setOpen(true);
  }

  function openEdit(u: Unit) {
    setEditing(u);
    setForm(u);
    setOpen(true);
  }

  async function save() {
    if (!form.name || !form.propertyId) return;
    setSaving(true);
    if (editing) {
      await repo.updateUnit(editing.id, form);
    } else {
      await repo.createUnit(form);
    }
    setSaving(false);
    setOpen(false);
    reload();
  }

  return (
    <AppScreen refreshing={loading} onRefresh={reload}>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">Units</Text>
        {canManage ? <Button title="+ New" size="sm" onPress={openNew} /> : null}
      </View>

      <Select
        label="Property"
        options={propertyOptions}
        value={propertyId}
        onChange={(v) => setPropertyId(v ?? null)}
        allowEmpty
        emptyLabel="All Properties"
      />

      <SegmentedFilter options={OCCUPANCY_FILTERS} value={occupancy} onChange={setOccupancy} />

      {loading ? (
        <Loading />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="door"
          title="No units found"
          message="Add units to your properties to start managing tenants and rent."
          action={canManage ? <Button title="Add Unit" onPress={openNew} /> : undefined}
        />
      ) : (
        data.map((u) => (
          <Card key={u.id}>
            <CardContent>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-foreground">{u.name}</Text>
                  <Text className="mt-0.5 text-sm text-muted-foreground">{u.propertyName}</Text>
                  <Text className="mt-0.5 text-xs text-muted-foreground">{u.seriesName}</Text>
                </View>
                <StatusBadge map={OCCUPANCY_STATUS} value={u.occupancyStatus} />
              </View>

              <View className="mt-3 flex-row flex-wrap gap-x-6 gap-y-1">
                <Metric label="Rent" value={`${formatCurrency(u.monthlyRent)}/mo`} />
                {u.bedrooms != null ? (
                  <Metric label="Beds" value={String(u.bedrooms)} />
                ) : null}
                {u.bathrooms != null ? (
                  <Metric label="Baths" value={String(u.bathrooms)} />
                ) : null}
                {u.squareFeet != null ? (
                  <Metric label="Sq Ft" value={String(u.squareFeet)} />
                ) : null}
                {u.tenantName ? (
                  <Metric label="Tenant" value={u.tenantName} />
                ) : null}
              </View>

              {canManage ? (
                <View className="mt-3 flex-row gap-2">
                  <Button title="Edit" size="sm" variant="ghost" onPress={() => openEdit(u)} />
                </View>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}

      <FormSheet
        visible={open}
        title={editing ? 'Edit Unit' : 'New Unit'}
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitting={saving}
      >
        <Select
          label="Property"
          required
          options={propertyOptions}
          value={form.propertyId ?? null}
          onChange={(v) => setForm((f) => ({ ...f, propertyId: v ?? '' }))}
        />
        <Input
          label="Unit Name / Number"
          required
          value={form.name ?? ''}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          placeholder="Unit 1A"
        />
        <Input
          label="Monthly Rent"
          keyboardType="decimal-pad"
          value={form.monthlyRent ?? ''}
          onChangeText={(monthlyRent) => setForm((f) => ({ ...f, monthlyRent }))}
          placeholder="0.00"
        />
        <Select
          label="Occupancy Status"
          options={OCCUPANCY_OPTIONS}
          value={form.occupancyStatus ?? null}
          onChange={(v) =>
            setForm((f) => ({ ...f, occupancyStatus: (v as Unit['occupancyStatus']) ?? 'vacant' }))
          }
        />
        <Input
          label="Bedrooms"
          keyboardType="numeric"
          value={form.bedrooms != null ? String(form.bedrooms) : ''}
          onChangeText={(v) =>
            setForm((f) => ({ ...f, bedrooms: v ? parseInt(v, 10) : null }))
          }
          placeholder="2"
        />
        <Input
          label="Bathrooms"
          keyboardType="decimal-pad"
          value={form.bathrooms ?? ''}
          onChangeText={(bathrooms) => setForm((f) => ({ ...f, bathrooms }))}
          placeholder="1.5"
        />
        <Input
          label="Sq Ft"
          keyboardType="numeric"
          value={form.squareFeet != null ? String(form.squareFeet) : ''}
          onChangeText={(v) =>
            setForm((f) => ({ ...f, squareFeet: v ? parseInt(v, 10) : null }))
          }
          placeholder="850"
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
