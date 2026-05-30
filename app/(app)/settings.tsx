import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/AppScreen';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormSheet,
  Input,
  Loading,
  Row,
} from '@/components/ui';
import { ROLE_LABELS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { ENV } from '@/lib/env';
import { repo } from '@/services/repo';
import { useState } from 'react';
import type { Vendor } from '@/types';

export default function Settings() {
  const { user, signOut } = useAuth();
  const canManageFinance = can(user?.role, 'manage_finance');

  const categoriesAsync = useAsync(() => repo.listCategories(), []);
  const vendorsAsync = useAsync(() => repo.listVendors(), []);

  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState<Partial<Vendor>>({});
  const [saving, setSaving] = useState(false);

  async function saveVendor() {
    if (!vendorForm.name) return;
    setSaving(true);
    await repo.createVendor(vendorForm);
    setSaving(false);
    setVendorOpen(false);
    setVendorForm({});
    vendorsAsync.reload();
  }

  async function handleSignOut() {
    await signOut();
    router.replace('/(auth)/sign-in');
  }

  return (
    <AppScreen showSeriesBar={false}>
      <Text className="text-2xl font-bold text-foreground">Settings</Text>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <View className="gap-1">
            <Text className="text-base font-semibold text-foreground">{user?.fullName ?? '—'}</Text>
            <Text className="text-sm text-muted-foreground">{user?.email ?? '—'}</Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Role:{' '}
              <Text className="font-medium text-foreground">
                {user?.role ? ROLE_LABELS[user.role] : '—'}
              </Text>
            </Text>
          </View>
        </CardContent>
      </Card>

      {/* Demo Mode Info */}
      <Card>
        <CardHeader>
          <CardTitle>App Mode</CardTitle>
        </CardHeader>
        <CardContent>
          {ENV.demoMode ? (
            <View className="gap-1">
              <Text className="text-sm font-semibold text-warning">Demo Mode Active</Text>
              <Text className="text-sm text-muted-foreground">
                The app is running with an in-memory data store. All changes are local and will reset
                on reload. To go live, configure a Supabase backend by setting{' '}
                <Text className="font-mono text-foreground">EXPO_PUBLIC_SUPABASE_URL</Text> and{' '}
                <Text className="font-mono text-foreground">EXPO_PUBLIC_SUPABASE_ANON_KEY</Text> in
                your environment.
              </Text>
            </View>
          ) : (
            <View className="gap-1">
              <Text className="text-sm font-semibold text-success">Live Mode</Text>
              <Text className="text-sm text-muted-foreground">
                Connected to Supabase. Data is persisted to your database.
              </Text>
            </View>
          )}
        </CardContent>
      </Card>

      {/* Expense Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Categories</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {categoriesAsync.loading ? (
            <View className="p-4">
              <Loading />
            </View>
          ) : (categoriesAsync.data ?? []).length === 0 ? (
            <View className="p-4">
              <Text className="text-sm text-muted-foreground">No categories configured.</Text>
            </View>
          ) : (
            (categoriesAsync.data ?? []).map((cat) => (
              <Row key={cat.id} title={cat.name} subtitle={cat.taxLine ?? undefined} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Vendors */}
      <Card>
        <CardHeader>
          <View className="flex-row items-center justify-between">
            <CardTitle>Vendors</CardTitle>
            {canManageFinance ? (
              <Button
                title="+ Add Vendor"
                size="sm"
                variant="outline"
                onPress={() => {
                  setVendorForm({});
                  setVendorOpen(true);
                }}
              />
            ) : null}
          </View>
        </CardHeader>
        <CardContent className="p-0">
          {vendorsAsync.loading ? (
            <View className="p-4">
              <Loading />
            </View>
          ) : (vendorsAsync.data ?? []).length === 0 ? (
            <View className="p-4">
              <Text className="text-sm text-muted-foreground">No vendors yet.</Text>
            </View>
          ) : (
            (vendorsAsync.data ?? []).map((v) => (
              <Row
                key={v.id}
                title={v.name}
                subtitle={[v.contactName, v.email, v.phone].filter(Boolean).join(' · ') || undefined}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* App Info */}
      <Card>
        <CardHeader>
          <CardTitle>App Info</CardTitle>
        </CardHeader>
        <CardContent>
          <Text className="text-sm text-muted-foreground">Version 1.0.0 (MVP)</Text>
          <Text className="mt-2 text-sm text-muted-foreground">
            Planned features: Stripe payments, bank sync, QuickBooks export, e-signature for leases.
          </Text>
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Button title="Sign Out" variant="danger" onPress={handleSignOut} />

      {/* Add Vendor FormSheet */}
      <FormSheet
        visible={vendorOpen}
        title="Add Vendor"
        onClose={() => setVendorOpen(false)}
        onSubmit={saveVendor}
        submitting={saving}
        submitLabel="Add Vendor"
      >
        <Input
          label="Vendor Name"
          required
          value={vendorForm.name ?? ''}
          onChangeText={(name) => setVendorForm((f) => ({ ...f, name }))}
          placeholder="ABC Plumbing"
        />
        <Input
          label="Contact Name"
          value={vendorForm.contactName ?? ''}
          onChangeText={(contactName) => setVendorForm((f) => ({ ...f, contactName }))}
          placeholder="John Smith"
        />
        <Input
          label="Email"
          value={vendorForm.email ?? ''}
          onChangeText={(email) => setVendorForm((f) => ({ ...f, email }))}
          placeholder="contact@vendor.com"
          keyboardType="email-address"
        />
        <Input
          label="Phone"
          value={vendorForm.phone ?? ''}
          onChangeText={(phone) => setVendorForm((f) => ({ ...f, phone }))}
          placeholder="(555) 123-4567"
          keyboardType="phone-pad"
        />
      </FormSheet>
    </AppScreen>
  );
}
