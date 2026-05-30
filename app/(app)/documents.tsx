import { useMemo, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { AppScreen } from '@/components/AppScreen';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  FormSheet,
  Input,
  Loading,
  SegmentedFilter,
  Select,
} from '@/components/ui';
import { DOCUMENT_TYPES, ENTITY_TYPES } from '@/constants';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { useSeries } from '@/lib/series-context';
import { can } from '@/lib/rbac';
import { repo } from '@/services/repo';
import type { Document, DocumentView } from '@/types';

const DOC_TYPE_FILTER = [
  { value: null, label: 'All' },
  ...DOCUMENT_TYPES.map((d) => ({ value: d.value, label: d.label })),
];

const DOCUMENT_TYPE_OPTIONS = DOCUMENT_TYPES.map((d) => ({ value: d.value, label: d.label }));
const ENTITY_TYPE_OPTIONS = ENTITY_TYPES.map((e) => ({ value: e.value, label: e.label }));

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return '—';
  const kb = bytes / 1024;
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  }
  return `${Math.round(kb)} KB`;
}

function getEntityTypeLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return ENTITY_TYPES.find((e) => e.value === value)?.label ?? value;
}

function getDocTypeLabel(value: string | null | undefined): string {
  if (!value) return '—';
  return DOCUMENT_TYPES.find((d) => d.value === value)?.label ?? value;
}

export default function Documents() {
  const { user } = useAuth();
  const { seriesList, selectedId } = useSeries();
  const canManage = can(user?.role, 'manage_ops');

  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const documents = useAsync(
    () => repo.listDocuments({ seriesId: selectedId }),
    [selectedId],
  );

  const filtered = useMemo(() => {
    if (!documents.data) return [];
    if (!typeFilter) return documents.data;
    return documents.data.filter((d) => d.documentType === typeFilter);
  }, [documents.data, typeFilter]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Document>>({
    sharedWithTenant: false,
  });
  const [saving, setSaving] = useState(false);

  const seriesOptions = useMemo(
    () => seriesList.map((s) => ({ value: s.id, label: s.name })),
    [seriesList],
  );

  function openNew() {
    setForm({
      childSeriesId: selectedId ?? null,
      sharedWithTenant: false,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.title || !form.documentType || !form.entityType) return;
    setSaving(true);
    await repo.createDocument({ ...form, storageBucket: 'documents' });
    setSaving(false);
    setOpen(false);
    documents.reload();
  }

  async function handleDelete(id: string) {
    await repo.deleteDocument(id);
    documents.reload();
  }

  return (
    <AppScreen refreshing={documents.loading} onRefresh={documents.reload}>
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-bold text-foreground">Documents</Text>
        {canManage ? <Button title="+ Add" size="sm" onPress={openNew} /> : null}
      </View>

      <SegmentedFilter
        options={DOC_TYPE_FILTER}
        value={typeFilter}
        onChange={setTypeFilter}
      />

      {documents.loading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="folder"
          title="No documents yet"
          message="Store leases, receipts, contracts, and more here."
          action={canManage ? <Button title="Add Document" onPress={openNew} /> : undefined}
        />
      ) : (
        filtered.map((d) => (
          <DocumentCard
            key={d.id}
            item={d}
            canManage={canManage}
            onDelete={handleDelete}
          />
        ))
      )}

      <FormSheet
        visible={open}
        title="Add Document"
        onClose={() => setOpen(false)}
        onSubmit={save}
        submitting={saving}
        submitLabel="Save"
      >
        <View className="mb-3 rounded-lg bg-muted p-3">
          <Text className="text-sm text-muted-foreground">
            File upload via expo-document-picker will be wired in a future step. Fill in the metadata below to create a document record.
          </Text>
        </View>

        <Input
          label="Title"
          required
          value={form.title ?? ''}
          onChangeText={(title) => setForm((f) => ({ ...f, title }))}
          placeholder="Document title"
        />
        <Select
          label="Document Type"
          required
          options={DOCUMENT_TYPE_OPTIONS}
          value={form.documentType}
          onChange={(v) =>
            setForm((f) => ({ ...f, documentType: (v ?? undefined) as Document['documentType'] | undefined }))
          }
        />
        <Select
          label="Entity Type"
          required
          options={ENTITY_TYPE_OPTIONS}
          value={form.entityType}
          onChange={(v) =>
            setForm((f) => ({ ...f, entityType: (v ?? undefined) as Document['entityType'] | undefined }))
          }
        />
        <Select
          label="Series (optional)"
          options={seriesOptions}
          value={form.childSeriesId}
          onChange={(v) => setForm((f) => ({ ...f, childSeriesId: v ?? null }))}
          allowEmpty
          emptyLabel="None"
        />
        <Field label="Shared with Tenant">
          <View className="flex-row items-center gap-3">
            <Switch
              value={form.sharedWithTenant ?? false}
              onValueChange={(val) => setForm((f) => ({ ...f, sharedWithTenant: val }))}
            />
            <Text className="text-sm text-muted-foreground">
              {form.sharedWithTenant ? 'Yes — visible to tenant' : 'No — staff only'}
            </Text>
          </View>
        </Field>
      </FormSheet>
    </AppScreen>
  );
}

function DocumentCard({
  item,
  canManage,
  onDelete,
}: {
  item: DocumentView;
  canManage: boolean;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent>
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text className="text-base font-bold text-foreground">{item.title}</Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">
              {getEntityTypeLabel(item.entityType)}
              {item.seriesName ? ` · ${item.seriesName}` : ''}
            </Text>
            {item.fileSize ? (
              <Text className="mt-0.5 text-xs text-muted-foreground">
                {formatFileSize(item.fileSize)}
              </Text>
            ) : null}
          </View>
          <View className="items-end gap-1">
            <Badge
              label={getDocTypeLabel(item.documentType)}
              variant="info"
            />
            {item.sharedWithTenant ? (
              <Badge label="Shared with tenant" variant="success" />
            ) : null}
          </View>
        </View>

        {canManage ? (
          <View className="mt-3 flex-row gap-2 border-t border-border pt-2">
            <Button
              title="Delete"
              size="sm"
              variant="ghost"
              onPress={() => onDelete(item.id)}
            />
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}
