import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, CardContent, CardHeader, CardTitle, Icon, Input } from '@/components/ui';
import { useAsync } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { formatDate } from '@/lib/format';
import { repo } from '@/services/repo';

/** Notes thread attachable to any entity (series, property, tenant, …). */
export function NotesPanel({
  entityType,
  entityId,
  childSeriesId,
}: {
  entityType: string;
  entityId: string;
  childSeriesId?: string | null;
}) {
  const { user } = useAuth();
  const canManage = can(user?.role, 'manage_ops');
  const { data, reload } = useAsync(() => repo.listNotes(entityType, entityId), [entityType, entityId]);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!body.trim()) return;
    setBusy(true);
    await repo.createNote({ entityType: entityType as never, entityId, childSeriesId, body: body.trim() });
    setBody('');
    setBusy(false);
    reload();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="gap-2 pt-0">
        {data && data.length > 0 ? (
          data.map((n) => (
            <View key={n.id} className="flex-row items-start gap-2 border-b border-border py-2">
              <View className="flex-1">
                <Text className="text-sm text-foreground">{n.body}</Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">{formatDate(n.createdAt)}</Text>
              </View>
              {canManage ? (
                <Pressable
                  onPress={async () => {
                    await repo.deleteNote(n.id);
                    reload();
                  }}
                  hitSlop={8}
                >
                  <Icon name="trash" size={14} className="text-muted-foreground" />
                </Pressable>
              ) : null}
            </View>
          ))
        ) : (
          <Text className="py-2 text-sm text-muted-foreground">No notes yet.</Text>
        )}

        {canManage ? (
          <View className="mt-1 flex-row items-end gap-2">
            <View className="flex-1">
              <Input value={body} onChangeText={setBody} placeholder="Add a note…" multiline />
            </View>
            <Button title="Add" size="sm" onPress={add} loading={busy} />
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}
