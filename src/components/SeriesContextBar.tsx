import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon, Select } from '@/components/ui';
import { useSeries } from '@/lib/series-context';

/**
 * The persistent "which child series am I viewing?" control. Sits under the
 * header on every staff screen so series context is always obvious. Selecting
 * "All Series" shows the parent-LLC-wide view.
 */
export function SeriesContextBar() {
  const { seriesList, selectedId, selected, setSelectedId } = useSeries();
  const [open, setOpen] = useState(false);

  const options = seriesList.map((s) => ({ value: s.id, label: s.name }));

  return (
    <View className="border-b border-border bg-surface px-4 py-2">
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-2"
        accessibilityLabel="Switch child series"
      >
        <Icon name="layers" size={16} />
        <View className="flex-1">
          <Text className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Viewing series
          </Text>
          <Text className="text-sm font-bold text-primary" numberOfLines={1}>
            {selected ? selected.name : 'All Series (Parent LLC)'}
          </Text>
        </View>
        <Icon name="chevron" size={18} className="text-muted-foreground" />
      </Pressable>

      {open ? (
        <View className="mt-2">
          <Select
            options={options}
            value={selectedId}
            allowEmpty
            emptyLabel="All Series (Parent LLC)"
            onChange={(v) => {
              setSelectedId(v);
              setOpen(false);
            }}
            label="Select child series"
          />
        </View>
      ) : null}
    </View>
  );
}
