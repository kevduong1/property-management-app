import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/AppScreen';
import { PageHeader } from '@/components/PageHeader';
import { NotesPanel } from '@/components/NotesPanel';
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
  Select,
} from '@/components/ui';
import { OCCUPANCY_STATUS, PROPERTY_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatCurrency } from '@/lib/format';
import { repo } from '@/services/repo';
import type { Unit } from '@/types';

const OCCUPANCY_OPTIONS = Object.entries(OCCUPANCY_STATUS).map(([value, v]) => ({
  value,
  label: v.label,
}));

export default function PropertyDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = can(user?.role, 'manage_ops');

  const property = useAsync(() => repo.getProperty(id), [id]);
  const units = useAsync(() => repo.listUnits({ propertyId: id }), [id]);

  const [unitOpen, setUnitOpen] = useState(false);
  const [unitForm, setUnitForm] = useState<Partial<Unit>>({});
  const [saving, setSaving] = useState(false);

  function openAddUnit() {
    setUnitForm({ propertyId: id, occupancyStatus: 'vacant', monthlyRent: '0' });
    setUnitOpen(true);
  }

  async function saveUnit() {
    if (!unitForm.name) return;
    setSaving(true);
    await repo.createUnit({ ...unitForm, propertyId: id });
    setSaving(false);
    setUnitOpen(false);
    units.reload();
  }

  if (property.loading) {
    return (
      <AppScreen showSeriesBar={false}>
        <Loading />
      </AppScreen>
    );
  }

  if (!property.data) {
    return (
      <AppScreen showSeriesBar={false}>
        <PageHeader title="Property" back />
        <EmptyState icon="home" title="Property not found" />
      </AppScreen>
    );
  }

  const p = property.data;
  const address = [p.addressLine1, p.addressLine2, p.city, p.state, p.postalCode]
    .filter(Boolean)
    .join(', ');

  return (
    <AppScreen
      showSeriesBar={false}
      refreshing={units.loading}
      onRefresh={() => {
        property.reload();
        units.reload();
      }}
    >
      <PageHeader title={p.name} subtitle="Property" back />

      <View>
        <StatusBadge map={PROPERTY_STATUS} value={p.status} />
      </View>

      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <DetailRow label="Address" value={address || '—'} />
          <DetailRow label="Status" value={p.status} />
          <DetailRow label="Notes" value={p.notes ?? '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Units</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {units.data && units.data.length > 0 ? (
            units.data.map((u) => (
              <Row
                key={u.id}
                title={u.name}
                subtitle={u.tenantName ?? 'Vacant'}
                meta={formatCurrency(u.monthlyRent) + '/mo'}
                trailing={<StatusBadge map={OCCUPANCY_STATUS} value={u.occupancyStatus} />}
                onPress={() => router.push('/units')}
              />
            ))
          ) : (
            <View className="p-4">
              <Text className="text-sm text-muted-foreground">No units added yet.</Text>
            </View>
          )}
          {canManage ? (
            <View className="p-3">
              <Button title="+ Add Unit" size="sm" variant="outline" onPress={openAddUnit} />
            </View>
          ) : null}
        </CardContent>
      </Card>

      <NotesPanel entityType="property" entityId={p.id} childSeriesId={p.childSeriesId} />

      <FormSheet
        visible={unitOpen}
        title="Add Unit"
        onClose={() => setUnitOpen(false)}
        onSubmit={saveUnit}
        submitting={saving}
        submitLabel="Add Unit"
      >
        <Input
          label="Unit Name / Number"
          required
          value={unitForm.name ?? ''}
          onChangeText={(name) => setUnitForm((f) => ({ ...f, name }))}
          placeholder="Unit 1A"
        />
        <Input
          label="Monthly Rent"
          keyboardType="decimal-pad"
          value={unitForm.monthlyRent ?? ''}
          onChangeText={(monthlyRent) => setUnitForm((f) => ({ ...f, monthlyRent }))}
          placeholder="0.00"
        />
        <Select
          label="Occupancy Status"
          options={OCCUPANCY_OPTIONS}
          value={unitForm.occupancyStatus ?? null}
          onChange={(v) =>
            setUnitForm((f) => ({
              ...f,
              occupancyStatus: (v as Unit['occupancyStatus']) ?? 'vacant',
            }))
          }
        />
        <Input
          label="Bedrooms"
          keyboardType="numeric"
          value={unitForm.bedrooms != null ? String(unitForm.bedrooms) : ''}
          onChangeText={(v) =>
            setUnitForm((f) => ({ ...f, bedrooms: v ? parseInt(v, 10) : null }))
          }
          placeholder="2"
        />
        <Input
          label="Bathrooms"
          keyboardType="decimal-pad"
          value={unitForm.bathrooms ?? ''}
          onChangeText={(bathrooms) => setUnitForm((f) => ({ ...f, bathrooms }))}
          placeholder="1.5"
        />
        <Input
          label="Sq Ft"
          keyboardType="numeric"
          value={unitForm.squareFeet != null ? String(unitForm.squareFeet) : ''}
          onChangeText={(v) =>
            setUnitForm((f) => ({ ...f, squareFeet: v ? parseInt(v, 10) : null }))
          }
          placeholder="850"
        />
        <Input
          label="Notes"
          value={unitForm.notes ?? ''}
          onChangeText={(notes) => setUnitForm((f) => ({ ...f, notes }))}
          placeholder="Optional notes"
          multiline
          numberOfLines={3}
        />
      </FormSheet>
    </AppScreen>
  );
}
