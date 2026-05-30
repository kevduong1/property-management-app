import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
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
  Select,
  StatCard,
} from '@/components/ui';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useSeries } from '@/lib/series-context';
import { can } from '@/lib/rbac';
import { formatCurrency, formatDate, todayISO, toNumber } from '@/lib/format';
import { repo } from '@/services/repo';
import type { Expense, ExpenseView } from '@/types';

export default function Expenses() {
  const { user } = useAuth();
  const { seriesList, selectedId } = useSeries();
  const canManage = can(user?.role, 'manage_finance');

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const expenses = useAsync(
    () => repo.listExpenses({ seriesId: selectedId, categoryId: categoryFilter }),
    [selectedId, categoryFilter],
  );
  const categories = useAsync(() => repo.listCategories(), []);
  const vendors = useAsync(() => repo.listVendors(), []);
  const properties = useAsync(() => repo.listProperties({ seriesId: selectedId }), [selectedId]);
  const byCat = useAsync(
    () => repo.expenseByCategory({ seriesId: selectedId }),
    [selectedId],
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseView | null>(null);
  const [form, setForm] = useState<Partial<Expense>>({});
  const [saving, setSaving] = useState(false);

  const categoryOptions = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [categories.data],
  );
  const vendorOptions = useMemo(
    () => (vendors.data ?? []).map((v) => ({ value: v.id, label: v.name })),
    [vendors.data],
  );
  const propertyOptions = useMemo(
    () => (properties.data ?? []).map((p) => ({ value: p.id, label: p.name })),
    [properties.data],
  );
  const seriesOptions = useMemo(
    () => seriesList.map((s) => ({ value: s.id, label: s.name })),
    [seriesList],
  );

  const total = useMemo(
    () => (expenses.data ?? []).reduce((sum, e) => sum + toNumber(e.amount), 0),
    [expenses.data],
  );

  function openNew() {
    setEditing(null);
    setForm({
      childSeriesId: selectedId ?? seriesList[0]?.id ?? '',
      expenseDate: todayISO(),
    });
    setOpen(true);
  }

  function openEdit(e: ExpenseView) {
    setEditing(e);
    setForm(e);
    setOpen(true);
  }

  async function save() {
    if (!form.childSeriesId || !form.categoryId || !form.amount) return;
    setSaving(true);
    if (editing) {
      await repo.updateExpense(editing.id, form);
    } else {
      await repo.createExpense(form);
    }
    setSaving(false);
    setOpen(false);
    expenses.reload();
    byCat.reload();
  }

  async function handleDelete(id: string) {
    await repo.deleteExpense(id);
    expenses.reload();
    byCat.reload();
  }

  return (
    <AppScreen refreshing={expenses.loading} onRefresh={() => { expenses.reload(); byCat.reload(); }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">Expenses</Text>
        {canManage ? <Button title="+ New" size="sm" onPress={openNew} /> : null}
      </View>

      {/* Total stat */}
      <View className="flex-row flex-wrap gap-3">
        <StatCard label="Total" value={formatCurrency(total)} />
      </View>

      {/* By category summary */}
      {byCat.data && byCat.data.length > 0 ? (
        <Card>
          <CardContent>
            <Text className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              By Category
            </Text>
            {byCat.data.map((row) => (
              <View key={row.name} className="flex-row items-center justify-between py-1">
                <Text className="text-sm text-foreground">{row.name}</Text>
                <Text className="text-sm font-semibold text-foreground">
                  {formatCurrency(row.total)}
                </Text>
              </View>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Category filter */}
      <Select
        label="Filter by Category"
        options={categoryOptions}
        value={categoryFilter}
        onChange={setCategoryFilter}
        allowEmpty
        emptyLabel="All Categories"
      />

      {expenses.loading ? (
        <Loading />
      ) : !expenses.data || expenses.data.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="No expenses yet"
          message="Track your property expenses here."
          action={canManage ? <Button title="Add Expense" onPress={openNew} /> : undefined}
        />
      ) : (
        expenses.data.map((e) => (
          <Card key={e.id}>
            <CardContent>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-xl font-bold text-foreground">
                    {formatCurrency(e.amount)}
                  </Text>
                  {e.description ? (
                    <Text className="mt-0.5 text-sm text-foreground">{e.description}</Text>
                  ) : null}
                  <Text className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(e.expenseDate)} · {e.seriesName}
                    {e.propertyName ? ` · ${e.propertyName}` : ''}
                  </Text>
                  {e.vendorName ? (
                    <Text className="mt-0.5 text-xs text-muted-foreground">
                      Vendor: {e.vendorName}
                    </Text>
                  ) : null}
                </View>
                <View className="items-end gap-1">
                  {e.categoryName ? (
                    <Badge label={e.categoryName} variant="muted" />
                  ) : null}
                </View>
              </View>

              {canManage ? (
                <View className="mt-3 flex-row gap-2 border-t border-border pt-2">
                  <Button
                    title="Edit"
                    size="sm"
                    variant="outline"
                    onPress={() => openEdit(e)}
                  />
                  <Button
                    title="Delete"
                    size="sm"
                    variant="ghost"
                    onPress={() => handleDelete(e.id)}
                  />
                </View>
              ) : null}
            </CardContent>
          </Card>
        ))
      )}

      <FormSheet
        visible={open}
        title={editing ? 'Edit Expense' : 'New Expense'}
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitting={saving}
      >
        <Select
          label="Series"
          required
          options={seriesOptions}
          value={form.childSeriesId}
          onChange={(v) => setForm((f) => ({ ...f, childSeriesId: v ?? '' }))}
        />
        <Select
          label="Category"
          required
          options={categoryOptions}
          value={form.categoryId}
          onChange={(v) => setForm((f) => ({ ...f, categoryId: v ?? undefined }))}
        />
        <Input
          label="Amount"
          required
          keyboardType="decimal-pad"
          value={form.amount ?? ''}
          onChangeText={(amount) => setForm((f) => ({ ...f, amount }))}
          placeholder="0.00"
        />
        <Input
          label="Expense Date (YYYY-MM-DD)"
          value={form.expenseDate ?? todayISO()}
          onChangeText={(expenseDate) => setForm((f) => ({ ...f, expenseDate }))}
          placeholder="YYYY-MM-DD"
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
          label="Vendor (optional)"
          options={vendorOptions}
          value={form.vendorId}
          onChange={(v) => setForm((f) => ({ ...f, vendorId: v ?? null }))}
          allowEmpty
          emptyLabel="None"
        />
        <Input
          label="Description"
          value={form.description ?? ''}
          onChangeText={(description) => setForm((f) => ({ ...f, description }))}
          placeholder="Brief description"
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
