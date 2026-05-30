import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/AppScreen';
import { StatusBadge } from '@/components/StatusBadge';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  FormSheet,
  Input,
  Loading,
} from '@/components/ui';
import { LEASE_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useSeries } from '@/lib/series-context';
import { can } from '@/lib/rbac';
import { formatCurrency } from '@/lib/format';
import { repo } from '@/services/repo';
import type { Tenant } from '@/types';

export default function TenantsList() {
  const { user } = useAuth();
  const { selectedId } = useSeries();
  const canManage = can(user?.role, 'manage_ops');

  const { data, loading, reload } = useAsync(
    () => repo.listTenants({ seriesId: selectedId }),
    [selectedId],
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState<Partial<Tenant>>({});
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditing(null);
    setForm({});
    setOpen(true);
  }

  function openEdit(t: Tenant) {
    setEditing(t);
    setForm(t);
    setOpen(true);
  }

  async function save() {
    if (!form.fullName) return;
    setSaving(true);
    if (editing) {
      await repo.updateTenant(editing.id, form);
    } else {
      await repo.createTenant(form);
    }
    setSaving(false);
    setOpen(false);
    reload();
  }

  return (
    <AppScreen refreshing={loading} onRefresh={reload}>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">Tenants</Text>
        {canManage ? <Button title="+ New" size="sm" onPress={openNew} /> : null}
      </View>

      {loading ? (
        <Loading />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon="users"
          title="No tenants yet"
          message="Add your first tenant to start managing leases and rent."
          action={canManage ? <Button title="Add Tenant" onPress={openNew} /> : undefined}
        />
      ) : (
        data.map((t) => (
          <Card key={t.id}>
            <CardContent>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-foreground">{t.fullName}</Text>
                    {t.hasPortalAccess ? (
                      <Badge label="Portal" variant="info" />
                    ) : null}
                  </View>
                  {t.email ? (
                    <Text className="mt-0.5 text-sm text-muted-foreground">{t.email}</Text>
                  ) : null}
                  {t.phone ? (
                    <Text className="mt-0.5 text-sm text-muted-foreground">{t.phone}</Text>
                  ) : null}
                  {t.unitName || t.propertyName ? (
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      {[t.propertyName, t.unitName].filter(Boolean).join(' / ')}
                    </Text>
                  ) : null}
                </View>
                <View className="items-end gap-1">
                  <StatusBadge map={LEASE_STATUS} value={t.leaseStatus} />
                  {t.balance > 0 ? (
                    <Text className="text-sm font-semibold text-danger">
                      {formatCurrency(t.balance)}
                    </Text>
                  ) : (
                    <Text className="text-sm font-semibold text-success">
                      {formatCurrency(t.balance)}
                    </Text>
                  )}
                </View>
              </View>

              <View className="mt-3 flex-row gap-2">
                <Button
                  title="Open"
                  size="sm"
                  variant="outline"
                  onPress={() => router.push(`/tenants/${t.id}`)}
                />
                {canManage ? (
                  <Button title="Edit" size="sm" variant="ghost" onPress={() => openEdit(t)} />
                ) : null}
              </View>
            </CardContent>
          </Card>
        ))
      )}

      <FormSheet
        visible={open}
        title={editing ? 'Edit Tenant' : 'New Tenant'}
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitting={saving}
      >
        <Input
          label="Full Name"
          required
          value={form.fullName ?? ''}
          onChangeText={(fullName) => setForm((f) => ({ ...f, fullName }))}
          placeholder="Jane Smith"
        />
        <Input
          label="Email"
          value={form.email ?? ''}
          onChangeText={(email) => setForm((f) => ({ ...f, email }))}
          placeholder="jane@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Phone"
          value={form.phone ?? ''}
          onChangeText={(phone) => setForm((f) => ({ ...f, phone }))}
          placeholder="(555) 000-0000"
        />
        <Input
          label="Emergency Contact Name"
          value={form.emergencyContactName ?? ''}
          onChangeText={(emergencyContactName) => setForm((f) => ({ ...f, emergencyContactName }))}
          placeholder="John Smith"
        />
        <Input
          label="Emergency Contact Phone"
          value={form.emergencyContactPhone ?? ''}
          onChangeText={(emergencyContactPhone) =>
            setForm((f) => ({ ...f, emergencyContactPhone }))
          }
          placeholder="(555) 000-0001"
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
