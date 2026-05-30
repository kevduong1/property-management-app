import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Icon } from './Icon';

/** Empty / zero-state placeholder. */
export function EmptyState({
  icon = 'folder',
  title,
  message,
  action,
}: {
  icon?: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-12">
      <Icon name={icon} size={32} />
      <Text className="mt-3 text-base font-semibold text-foreground">{title}</Text>
      {message ? (
        <Text className="mt-1 text-center text-sm text-muted-foreground">{message}</Text>
      ) : null}
      {action ? <View className="mt-4">{action}</View> : null}
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View className="items-center justify-center py-12">
      <ActivityIndicator color="#0f766e" />
      {label ? <Text className="mt-2 text-sm text-muted-foreground">{label}</Text> : null}
    </View>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View className="mb-1 mt-2 flex-row items-center justify-between">
      <Text className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      {action}
    </View>
  );
}

/** Horizontal scrollable pill filter (status, occupancy, etc.). */
export function SegmentedFilter({
  options,
  value,
  onChange,
}: {
  options: { value: string | null; label: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => {
        const active = (o.value ?? null) === (value ?? null);
        return (
          <Pressable
            key={o.label}
            onPress={() => onChange(o.value)}
            className={`rounded-full border px-3 py-1.5 ${
              active ? 'border-primary bg-primary' : 'border-border bg-surface'
            }`}
          >
            <Text className={`text-sm font-medium ${active ? 'text-primary-foreground' : 'text-foreground'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Generic pressable list row: title + subtitle on the left, trailing content. */
export function Row({
  title,
  subtitle,
  meta,
  trailing,
  onPress,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-border bg-surface px-4 py-3 active:bg-muted"
    >
      <View className="flex-1">
        <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? (
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? <View className="items-end">{trailing}</View> : null}
      {onPress ? <Icon name="chevron" size={18} className="text-muted-foreground" /> : null}
    </Pressable>
  );
}

/** A labeled key/value row used in detail views. */
export function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View className="flex-row items-start justify-between border-b border-border py-2.5">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <View className="ml-4 flex-1 items-end">
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text className="text-right text-sm font-medium text-foreground">{value}</Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}
