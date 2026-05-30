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
import { LEASE_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useSeries } from '@/lib/series-context';
import { can } from '@/lib/rbac';
import { formatCurrency, formatDate } from '@/lib/format';
import { repo } from '@/services/repo';
import type { Lease, LeaseView } from '@/types';

const STATUS_FILTERS = [
  { value: null, label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'month_to_month', label: 'Month-to-month' },
  { value: 'expired', label: 'Expired' },
  { value: 'terminated', label: 'Terminated' },
];

const LEASE_STATUS_OPTIONS = Object.entries(LEASE_STATUS).map(([value, v]) => ({
  value,
  label: v.label,
}));

export default function Leases() {
  const { user } = useAuth();
  const { selectedId } = useSeries();
  const canManage = can(user?.role, 'manage_ops');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const leasesAsync = useAsync(
    () => repo.listLeases({ seriesId: selectedId, status: statusFilter }),
    [selectedId, statusFilter],
  );
  const tenantsAsync = useAsync(() => repo.listTenants(), []);
  const unitsAsync = useAsync(() => repo.listUnits(), []);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LeaseView | null>(null);
  const [form, setForm] = useState<Partial<Lease>>({});
  const [saving, setSaving] = useState(false);

  const tenantOptions = useMemo(
    () => (tenantsAsync.data ?? []).map((t) => ({ value: t.id, label: t.fullName })),
    [tenantsAsync.data],
  );

  const unitOptions = useMemo(
    () =>
      (unitsAsync.data ?? []).map((u) => ({
        value: u.id,
        label: `${u.propertyName} / ${u.name}`,
      })),
    [unitsAsync.data],
  );

  function openNew() {
    setEditing(null);
    setForm({ status: 'active' });
    setOpen(true);
  }

  function openEdit(l: LeaseView) {
    setEditing(l);
    setForm(l);
    setOpen(true);
  }

  async function save() {
    if (!form.tenantId || !form.unitId) return;
    setSaving(true);
    if (editing) {
      await repo.updateLease(editing.id, form);
    } else {
      await repo.createLease(form);
    }
    setSaving(false);
    setOpen(false);
    leasesAsync.reload();
  }

  return (
    <AppScreen refreshing={leasesAsync.loading} onRefresh={leasesAsync.reload}>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">Leases</Text>
        {canManage ? <Button title="+ New" size="sm" onPress={openNew} /> : null}
      </View>

      <SegmentedFilter options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />

      {leasesAsync.loading ? (
        <Loading />
      ) : !leasesAsync.data || leasesAsync.data.length === 0 ? (
        <EmptyState
          icon="file"
          title="No leases found"
          message="Create a lease to connect tenants to units."
          action={canManage ? <Button title="Create Lease" onPress={openNew} /> : undefined}
        />
      ) : (
        leasesAsync.data.map((l) => (
          <Card key={l.id}>
            <CardContent>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-foreground">{l.tenantName}</Text>
                  <Text className="mt-0.5 text-sm text-muted-foreground">
                    {l.propertyName} / {l.unitName}
                  </Text>
                  <Text className="mt-0.5 text-xs text-muted-foreground">{l.seriesName}</Text>
                </View>
                <StatusBadge map={LEASE_STATUS} value={l.status} />
              </View>

              <View className="mt-3 flex-row flex-wrap gap-x-6 gap-y-1">
                <LeaseMetric label="Rent" value={formatCurrency(l.monthlyRent) + '/mo'} />
                <LeaseMetric
                  label="Period"
                  value={`${formatDate(l.startDate)} – ${l.endDate ? formatDate(l.endDate) : 'Month-to-month'}`}
                />
                {l.securityDepositAmount ? (
                  <LeaseMetric label="Deposit" value={formatCurrency(l.securityDepositAmount)} />
                ) : null}
              </View>

              {canManage ? (
                <View className="mt-3 flex-row gap-2">
                  <Button title="Edit" size="sm" variant="ghost" onPress={() => openEdit(l)} />
                </View>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}

      <FormSheet
        visible={open}
        title={editing ? 'Edit Lease' : 'New Lease'}
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitting={saving}
      >
        <Select
          label="Tenant"
          required
          options={tenantOptions}
          value={form.tenantId ?? null}
          onChange={(tenantId) => setForm((f) => ({ ...f, tenantId: tenantId ?? '' }))}
        />
        <Select
          label="Unit"
          required
          options={unitOptions}
          value={form.unitId ?? null}
          onChange={(unitId) => setForm((f) => ({ ...f, unitId: unitId ?? '' }))}
        />
        <Input
          label="Start Date"
          value={form.startDate ?? ''}
          onChangeText={(startDate) => setForm((f) => ({ ...f, startDate }))}
          placeholder="YYYY-MM-DD"
        />
        <Input
          label="End Date (leave blank for month-to-month)"
          value={form.endDate ?? ''}
          onChangeText={(endDate) => setForm((f) => ({ ...f, endDate: endDate || null }))}
          placeholder="YYYY-MM-DD"
        />
        <Input
          label="Monthly Rent"
          keyboardType="decimal-pad"
          value={form.monthlyRent ?? ''}
          onChangeText={(monthlyRent) => setForm((f) => ({ ...f, monthlyRent }))}
          placeholder="0.00"
        />
        <Input
          label="Security Deposit"
          keyboardType="decimal-pad"
          value={form.securityDepositAmount ?? ''}
          onChangeText={(securityDepositAmount) => setForm((f) => ({ ...f, securityDepositAmount }))}
          placeholder="0.00"
        />
        <Select
          label="Status"
          options={LEASE_STATUS_OPTIONS}
          value={form.status ?? null}
          onChange={(status) =>
            setForm((f) => ({ ...f, status: (status as Lease['status']) ?? 'active' }))
          }
        />
      </FormSheet>
    </AppScreen>
  );
}

function LeaseMetric({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}
