import { Text, View } from 'react-native';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted'
  | 'primary';

const STYLES: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: 'bg-success-bg', text: 'text-success' },
  warning: { bg: 'bg-warning-bg', text: 'text-warning' },
  danger: { bg: 'bg-danger-bg', text: 'text-danger' },
  info: { bg: 'bg-info-bg', text: 'text-info' },
  muted: { bg: 'bg-muted', text: 'text-muted-foreground' },
  primary: { bg: 'bg-primary/10', text: 'text-primary' },
};

export function Badge({
  label,
  variant = 'muted',
}: {
  label: string;
  variant?: BadgeVariant;
}) {
  const s = STYLES[variant];
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${s.bg}`}>
      <Text className={`text-xs font-semibold ${s.text}`}>{label}</Text>
    </View>
  );
}
