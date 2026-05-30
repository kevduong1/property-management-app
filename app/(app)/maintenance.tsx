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
  SegmentedFilter,
  Select,
} from '@/components/ui';
import { MAINTENANCE_PRIORITY, MAINTENANCE_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useSeries } from '@/lib/series-context';
import { can } from '@/lib/rbac';
import { repo } from '@/services/repo';
import type { MaintenanceRequest, MaintenanceView } from '@/types';

const STATUS_FILTERS = [
  { value: null, label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'canceled', label: 'Canceled' },
];

const PRIORITY_OPTIONS = Object.entries(MAINTENANCE_PRIORITY).map(([value, v]) => ({
  value,
  label: v.label,
}));

const STATUS_OPTIONS = Object.entries(MAINTENANCE_STATUS).map(([value, v]) => ({
  value,
  label: v.label,
}));

export default function Maintenance() {
  const { user } = useAuth();
  const { seriesList, selectedId } = useSeries();
  const canCreate = can(user?.role, 'view_all');
  const canManage = can(user?.role, 'manage_ops');

  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const requests = useAsync(
    () => repo.listMaintenance({ seriesId: selectedId, status: statusFilter }),
    [selectedId, statusFilter],
  );
  const properties = useAsync(() => repo.listProperties({ seriesId: selectedId }), [selectedId]);
  const units = useAsync(() => repo.listUnits({ seriesId: selectedId }), [selectedId]);
  const tenants = useAsync(() => repo.listTenants(), []);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<MaintenanceRequest>>({});
  const [saving, setSaving] = useState(false);

  const seriesOptions = useMemo(
    () => seriesList.map((s) => ({ value: s.id, label: s.name })),
    [seriesList],
  );
  const propertyOptions = useMemo(
    () => (properties.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [properties.data],
  );
  const unitOptions = useMemo(
    () => (units.data ?? []).map((u) => ({ value: u.id, label: `${u.name} (${u.propertyName})` })),
    [units.data],
  );
  const tenantOptions = useMemo(
    () => (tenants.data ?? []).map((t) => ({ value: t.id, label: t.fullName })),
    [tenants.data],
  );

  function openNew() {
    setForm({
      childSeriesId: selectedId ?? seriesList[0]?.id ?? '',
      priority: 'medium',
    });
    setOpen(true);
  }

  async function save() {
    if (!form.title || !form.childSeriesId) return;
    setSaving(true);
    await repo.createMaintenance(form);
    setSaving(false);
    setOpen(false);
    requests.reload();
  }

  async function handleStatusChange(id: string, status: string) {
    await repo.updateMaintenance(id, { status: status as MaintenanceRequest['status'] });
    requests.reload();
  }

  return (
    <AppScreen refreshing={requests.loading} onRefresh={requests.reload}>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">Maintenance</Text>
        {canCreate ? (
          <Button title="+ New Request" size="sm" onPress={openNew} />
        ) : null}
      </View>

      <SegmentedFilter
        options={STATUS_FILTERS}
        value={statusFilter}
        onChange={setStatusFilter}
      />

      {requests.loading ? (
        <Loading />
      ) : !requests.data || requests.data.length === 0 ? (
        <EmptyState
          icon="wrench"
          title="No maintenance requests"
          message="Submit a maintenance request to get started."
          action={canCreate ? <Button title="New Request" onPress={openNew} /> : undefined}
        />
      ) : (
        requests.data.map((m) => (
          <MaintenanceCard
            key={m.id}
            item={m}
            canManage={canManage}
            statusOptions={STATUS_OPTIONS}
            onStatusChange={handleStatusChange}
          />
        ))
      )}

      <FormSheet
        visible={open}
        title="New Maintenance Request"
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitting={saving}
        submitLabel="Submit Request"
      >
        <Input
          label="Title"
          required
          value={form.title ?? ''}
          onChangeText={(title) => setForm((f) => ({ ...f, title }))}
          placeholder="E.g. Leaking faucet in unit 2B"
        />
        <Input
          label="Description"
          value={form.description ?? ''}
          onChangeText={(description) => setForm((f) => ({ ...f, description }))}
          placeholder="Describe the issue"
          multiline
          numberOfLines={3}
        />
        <Select
          label="Series"
          required
          options={seriesOptions}
          value={form.childSeriesId}
          onChange={(v) => setForm((f) => ({ ...f, childSeriesId: v ?? '' }))}
        />
        <Select
          label="Property (optional)"
          options={propertyOptions}
          value={form.propertyId}
          onChange={(v) => setForm((f) => ({ ...f, propertyId: v ?? null }))}
          allowEmpty
          emptyLabel="None"
        />
        <Select
          label="Unit (optional)"
          options={unitOptions}
          value={form.unitId}
          onChange={(v) => setForm((f) => ({ ...f, unitId: v ?? null }))}
          allowEmpty
          emptyLabel="None"
        />
        <Select
          label="Tenant (optional)"
          options={tenantOptions}
          value={form.tenantId}
          onChange={(v) => setForm((f) => ({ ...f, tenantId: v ?? null }))}
          allowEmpty
          emptyLabel="None"
        />
        <Select
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={form.priority ?? 'medium'}
          onChange={(v) =>
            setForm((f) => ({ ...f, priority: (v ?? 'medium') as MaintenanceRequest['priority'] }))
          }
        />
      </FormSheet>
    </AppScreen>
  );
}

function MaintenanceCard({
  item,
  canManage,
  statusOptions,
  onStatusChange,
}: {
  item: MaintenanceView;
  canManage: boolean;
  statusOptions: { value: string; label: string }[];
  onStatusChange: (id: string, status: string) => void;
}) {
  return (
    <Card>
      <CardContent>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-base font-bold text-foreground">{item.title}</Text>
            {item.description ? (
              <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
            <Text className="mt-1 text-xs text-muted-foreground">
              {[item.tenantName, item.unitName, item.propertyName].filter(Boolean).join(' · ')}
            </Text>
            <Text className="text-xs text-muted-foreground">{item.seriesName}</Text>
          </View>
          <View className="items-end gap-1">
            <StatusBadge map={MAINTENANCE_PRIORITY} value={item.priority} />
            <StatusBadge map={MAINTENANCE_STATUS} value={item.status} />
          </View>
        </View>

        {canManage ? (
          <View className="mt-3 border-t border-border pt-2">
            <Select
              label="Change Status"
              options={statusOptions}
              value={item.status}
              onChange={(v) => { if (v) onStatusChange(item.id, v); }}
            />
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}
