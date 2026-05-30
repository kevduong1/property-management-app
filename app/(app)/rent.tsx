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
  StatCard,
} from '@/components/ui';
import { PAYMENT_METHODS, RENT_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useSeries } from '@/lib/series-context';
import { can } from '@/lib/rbac';
import { formatCurrency, formatDate, todayISO } from '@/lib/format';
import { repo } from '@/services/repo';
import type { RentChargeView } from '@/types';

const STATUS_FILTERS = [
  { value: null, label: 'All' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partially_paid', label: 'Partial' },
  { value: 'late', label: 'Late' },
  { value: 'paid', label: 'Paid' },
];

export default function Rent() {
  const { user } = useAuth();
  const { selectedId } = useSeries();
  const canManage = can(user?.role, 'manage_finance');
  const [status, setStatus] = useState<string | null>(null);

  const charges = useAsync(
    () => repo.listRentCharges({ seriesId: selectedId, status }),
    [selectedId, status],
  );
  const summary = useAsync(() => repo.summary({ seriesId: selectedId }), [selectedId]);
  const leases = useAsync(() => repo.listLeases({ seriesId: selectedId }), [selectedId]);

  // Payment modal
  const [payOpen, setPayOpen] = useState(false);
  const [payCharge, setPayCharge] = useState<RentChargeView | null>(null);
  const [payForm, setPayForm] = useState<{ amount: string; receivedDate: string; method: string; notes: string }>({
    amount: '',
    receivedDate: todayISO(),
    method: 'check',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // New charge modal
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeForm, setChargeForm] = useState<{ leaseId: string; dueDate: string; rentAmount: string; lateFeeAmount: string }>({
    leaseId: '',
    dueDate: todayISO(),
    rentAmount: '',
    lateFeeAmount: '0',
  });

  const leaseOptions = useMemo(
    () =>
      (leases.data ?? []).map((l) => ({
        value: l.id,
        label: `${l.tenantName} · ${l.propertyName}/${l.unitName}`,
      })),
    [leases.data],
  );

  function openPayment(c: RentChargeView) {
    setPayCharge(c);
    setPayForm({ amount: String(c.balance || ''), receivedDate: todayISO(), method: 'check', notes: '' });
    setPayOpen(true);
  }
  async function savePayment() {
    if (!payCharge || !payForm.amount) return;
    setSaving(true);
    await repo.recordPayment({
      rentChargeId: payCharge.id,
      tenantId: payCharge.tenantId,
      amount: payForm.amount,
      receivedDate: payForm.receivedDate,
      method: payForm.method as never,
      notes: payForm.notes || null,
    });
    setSaving(false);
    setPayOpen(false);
    charges.reload();
    summary.reload();
  }

  function openCharge() {
    setChargeForm({ leaseId: '', dueDate: todayISO(), rentAmount: '', lateFeeAmount: '0' });
    setChargeOpen(true);
  }
  async function saveCharge() {
    const lease = leases.data?.find((l) => l.id === chargeForm.leaseId);
    if (!lease) return;
    setSaving(true);
    await repo.createRentCharge({
      leaseId: lease.id,
      tenantId: lease.tenantId,
      unitId: lease.unitId,
      childSeriesId: lease.childSeriesId,
      dueDate: chargeForm.dueDate,
      rentAmount: chargeForm.rentAmount || lease.monthlyRent,
      lateFeeAmount: chargeForm.lateFeeAmount || '0',
    });
    setSaving(false);
    setChargeOpen(false);
    charges.reload();
    summary.reload();
  }

  const s = summary.data;

  return (
    <AppScreen refreshing={charges.loading} onRefresh={() => { charges.reload(); summary.reload(); }}>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">Rent Roll</Text>
        {canManage ? <Button title="+ Charge" size="sm" onPress={openCharge} /> : null}
      </View>

      {s ? (
        <View className="flex-row flex-wrap gap-3">
          <StatCard label="Due" value={formatCurrency(s.totalRentDue)} />
          <StatCard label="Collected" value={formatCurrency(s.totalRentCollected)} tone="success" />
          <StatCard label="Outstanding" value={formatCurrency(s.outstandingRent)} tone="warning" />
          <StatCard label="Late" value={formatCurrency(s.lateRent)} tone="danger" />
        </View>
      ) : null}

      <SegmentedFilter options={STATUS_FILTERS} value={status} onChange={setStatus} />

      {charges.loading ? (
        <Loading />
      ) : !charges.data || charges.data.length === 0 ? (
        <EmptyState icon="dollar" title="No rent charges" message="Create a rent charge to start tracking." />
      ) : (
        charges.data.map((c) => (
          <Card key={c.id}>
            <CardContent>
              <View className="flex-row items-start justify-between">
                <View className="flex-1 pr-2">
                  <Text className="text-base font-bold text-foreground">{c.tenantName}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {c.propertyName} · {c.unitName}
                  </Text>
                  <Text className="mt-0.5 text-xs text-muted-foreground">Due {formatDate(c.dueDate)} · {c.seriesName}</Text>
                </View>
                <StatusBadge map={RENT_STATUS} value={c.computedStatus} />
              </View>

              <View className="mt-2 flex-row justify-between border-t border-border pt-2">
                <Text className="text-sm text-muted-foreground">
                  Charge {formatCurrency(c.rentAmount)}
                  {Number(c.lateFeeAmount) > 0 ? ` + ${formatCurrency(c.lateFeeAmount)} late` : ''}
                </Text>
                <Text className="text-sm font-semibold text-foreground">
                  Paid {formatCurrency(c.paidAmount)}
                </Text>
              </View>
              <View className="mt-1 flex-row items-center justify-between">
                <Text className={`text-base font-bold ${c.balance > 0 ? 'text-danger' : 'text-success'}`}>
                  Balance {formatCurrency(c.balance)}
                </Text>
                {canManage && c.balance > 0 ? (
                  <Button title="Record Payment" size="sm" onPress={() => openPayment(c)} />
                ) : null}
              </View>
            </CardContent>
          </Card>
        ))
      )}

      {/* Record payment */}
      <FormSheet
        visible={payOpen}
        title="Record Payment"
        onClose={() => setPayOpen(false)}
        onSubmit={savePayment}
        submitting={saving}
        submitLabel="Save Payment"
      >
        {payCharge ? (
          <View className="mb-3 rounded-lg bg-muted p-3">
            <Text className="text-sm font-semibold text-foreground">{payCharge.tenantName}</Text>
            <Text className="text-xs text-muted-foreground">
              {payCharge.propertyName} · {payCharge.unitName} · Balance {formatCurrency(payCharge.balance)}
            </Text>
          </View>
        ) : null}
        <Input
          label="Amount"
          required
          keyboardType="decimal-pad"
          value={payForm.amount}
          onChangeText={(amount) => setPayForm((f) => ({ ...f, amount }))}
          placeholder="0.00"
        />
        <Input
          label="Date Received"
          value={payForm.receivedDate}
          onChangeText={(receivedDate) => setPayForm((f) => ({ ...f, receivedDate }))}
          placeholder="YYYY-MM-DD"
        />
        <Select
          label="Payment Method"
          options={PAYMENT_METHODS}
          value={payForm.method}
          onChange={(method) => setPayForm((f) => ({ ...f, method: method ?? 'check' }))}
        />
        <Input
          label="Notes"
          value={payForm.notes}
          onChangeText={(notes) => setPayForm((f) => ({ ...f, notes }))}
          placeholder="Optional"
          multiline
        />
      </FormSheet>

      {/* New charge */}
      <FormSheet
        visible={chargeOpen}
        title="New Rent Charge"
        onClose={() => setChargeOpen(false)}
        onSubmit={saveCharge}
        submitting={saving}
        submitLabel="Create Charge"
      >
        <Select
          label="Lease (tenant · unit)"
          required
          options={leaseOptions}
          value={chargeForm.leaseId}
          onChange={(leaseId) => {
            const lease = leases.data?.find((l) => l.id === leaseId);
            setChargeForm((f) => ({ ...f, leaseId: leaseId ?? '', rentAmount: lease?.monthlyRent ?? f.rentAmount }));
          }}
        />
        <Input
          label="Due Date"
          value={chargeForm.dueDate}
          onChangeText={(dueDate) => setChargeForm((f) => ({ ...f, dueDate }))}
          placeholder="YYYY-MM-DD"
        />
        <Input
          label="Rent Amount"
          required
          keyboardType="decimal-pad"
          value={chargeForm.rentAmount}
          onChangeText={(rentAmount) => setChargeForm((f) => ({ ...f, rentAmount }))}
          placeholder="0.00"
        />
        <Input
          label="Late Fee"
          keyboardType="decimal-pad"
          value={chargeForm.lateFeeAmount}
          onChangeText={(lateFeeAmount) => setChargeForm((f) => ({ ...f, lateFeeAmount }))}
          placeholder="0.00"
        />
      </FormSheet>
    </AppScreen>
  );
}
