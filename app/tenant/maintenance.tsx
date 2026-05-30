import { useState } from 'react';
import { Text, View } from 'react-native';
import {
  Screen,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  FormSheet,
  Input,
  Loading,
  Row,
  Select,
} from '@/components/ui';
import { StatusBadge } from '@/components/StatusBadge';
import { MAINTENANCE_PRIORITY, MAINTENANCE_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { repo } from '@/services/repo';

const PRIORITY_OPTIONS = Object.entries(MAINTENANCE_PRIORITY).map(([value, v]) => ({
  value,
  label: v.label,
}));

export default function TenantMaintenance() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;

  const maintenanceAsync = useAsync(
    () => (tenantId ? repo.listMaintenance({ tenantId }) : Promise.resolve([])),
    [tenantId],
  );
  const leasesAsync = useAsync(
    () => (tenantId ? repo.listLeases({ tenantId }) : Promise.resolve([])),
    [tenantId],
  );

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{
    title: string;
    description: string;
    priority: string;
  }>({ title: '', description: '', priority: 'medium' });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!form.title || !tenantId) return;
    const lease = leasesAsync.data?.[0] ?? null;
    setSaving(true);
    await repo.createMaintenance({
      tenantId,
      unitId: lease?.unitId ?? null,
      childSeriesId: lease?.childSeriesId ?? '',
      title: form.title,
      description: form.description || null,
      priority: form.priority as 'low' | 'medium' | 'high' | 'urgent',
    });
    setSaving(false);
    setOpen(false);
    setForm({ title: '', description: '', priority: 'medium' });
    maintenanceAsync.reload();
  }

  return (
    <Screen refreshing={maintenanceAsync.loading} onRefresh={maintenanceAsync.reload}>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">Maintenance</Text>
        <Button
          title="+ New Request"
          size="sm"
          onPress={() => {
            setForm({ title: '', description: '', priority: 'medium' });
            setOpen(true);
          }}
        />
      </View>
      <Text className="-mt-1 text-sm text-muted-foreground">Your maintenance requests</Text>

      <Card>
        <CardHeader>
          <CardTitle>Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {maintenanceAsync.loading ? (
            <View className="p-4">
              <Loading />
            </View>
          ) : (maintenanceAsync.data ?? []).length === 0 ? (
            <View className="p-4">
              <EmptyState
                icon="wrench"
                title="No requests yet"
                message="Submit a maintenance request and your property manager will be notified."
                action={
                  <Button
                    title="New Request"
                    size="sm"
                    onPress={() => {
                      setForm({ title: '', description: '', priority: 'medium' });
                      setOpen(true);
                    }}
                  />
                }
              />
            </View>
          ) : (
            (maintenanceAsync.data ?? []).map((m) => (
              <Row
                key={m.id}
                title={m.title}
                subtitle={m.description ?? undefined}
                meta={`Created ${formatDate(m.createdAt)}`}
                trailing={
                  <View className="items-end gap-1">
                    <StatusBadge map={MAINTENANCE_STATUS} value={m.status} />
                    <StatusBadge map={MAINTENANCE_PRIORITY} value={m.priority} />
                  </View>
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      <FormSheet
        visible={open}
        title="New Maintenance Request"
        onClose={() => setOpen(false)}
        onSubmit={submit}
        submitting={saving}
        submitLabel="Submit Request"
      >
        <Input
          label="Title"
          required
          value={form.title}
          onChangeText={(title) => setForm((f) => ({ ...f, title }))}
          placeholder="e.g. Leaky faucet in bathroom"
        />
        <Input
          label="Description"
          value={form.description}
          onChangeText={(description) => setForm((f) => ({ ...f, description }))}
          placeholder="Describe the issue in detail..."
          multiline
          numberOfLines={4}
        />
        <Select
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={form.priority}
          onChange={(priority) => setForm((f) => ({ ...f, priority: priority ?? 'medium' }))}
        />
      </FormSheet>
    </Screen>
  );
}
