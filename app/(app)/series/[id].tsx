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
  Loading,
  Row,
  StatCard,
} from '@/components/ui';
import { PROPERTY_STATUS, SERIES_STATUS } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { formatCurrency } from '@/lib/format';
import { repo } from '@/services/repo';

export default function SeriesDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const series = useAsync(() => repo.getSeries(id), [id]);
  const summary = useAsync(() => repo.summary({ seriesId: id }), [id]);
  const properties = useAsync(() => repo.listProperties({ seriesId: id }), [id]);
  const docs = useAsync(() => repo.listDocuments({ seriesId: id }), [id]);

  if (series.loading) return <AppScreen showSeriesBar={false}><Loading /></AppScreen>;
  if (!series.data)
    return (
      <AppScreen showSeriesBar={false}>
        <PageHeader title="Series" back />
        <EmptyState icon="layers" title="Series not found" />
      </AppScreen>
    );

  const s = series.data;
  const sum = summary.data;

  return (
    <AppScreen showSeriesBar={false} refreshing={summary.loading} onRefresh={() => { summary.reload(); properties.reload(); }}>
      <PageHeader title={s.name} subtitle="Child series" back />

      <View className="px-0">
        <StatusBadge map={SERIES_STATUS} value={s.status} />
      </View>

      {sum ? (
        <View className="flex-row flex-wrap gap-3">
          <StatCard label="Income" value={formatCurrency(sum.totalRentCollected)} tone="success" />
          <StatCard label="Expenses" value={formatCurrency(sum.totalExpenses)} />
          <StatCard label="Net" value={formatCurrency(sum.netIncome)} tone={sum.netIncome >= 0 ? 'success' : 'danger'} />
          <StatCard label="Outstanding" value={formatCurrency(sum.outstandingRent)} tone="warning" />
        </View>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Series Details</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <DetailRow label="EIN" value={s.ein ?? '—'} />
          <DetailRow label="Bank Account" value={s.bankAccountNickname ?? '—'} />
          <DetailRow label="Description" value={s.description ?? '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Properties</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {properties.data && properties.data.length > 0 ? (
            properties.data.map((p) => (
              <Row
                key={p.id}
                title={p.name}
                subtitle={[p.addressLine1, p.city].filter(Boolean).join(', ')}
                meta={`${p.occupiedUnits}/${p.unitCount} occupied · ${formatCurrency(p.monthlyRentRoll)}/mo`}
                onPress={() => router.push(`/properties/${p.id}`)}
                trailing={<StatusBadge map={PROPERTY_STATUS} value={p.status} />}
              />
            ))
          ) : (
            <View className="p-4">
              <Text className="text-sm text-muted-foreground">No properties in this series yet.</Text>
            </View>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {docs.data && docs.data.length > 0 ? (
            docs.data.map((d) => (
              <Row key={d.id} title={d.title} subtitle={d.documentType} onPress={() => router.push('/documents')} />
            ))
          ) : (
            <View className="p-4">
              <Text className="text-sm text-muted-foreground">No documents attached.</Text>
            </View>
          )}
        </CardContent>
      </Card>

      <NotesPanel entityType="child_series" entityId={s.id} childSeriesId={s.id} />

      <Button title="Manage Properties" variant="outline" onPress={() => router.push('/properties')} />
    </AppScreen>
  );
}
