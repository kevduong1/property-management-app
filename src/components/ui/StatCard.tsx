import { Text, View } from 'react-native';
import { Card } from './Card';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const TONE: Record<Tone, string> = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
};

/** Compact metric card used on the dashboard and report headers. */
export function StatCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  return (
    <Card className="flex-1 min-w-[150px]">
      <View className="p-3.5">
        <Text className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </Text>
        <Text className={`mt-1 text-xl font-bold ${TONE[tone]}`} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {sub ? <Text className="mt-0.5 text-xs text-muted-foreground">{sub}</Text> : null}
      </View>
    </Card>
  );
}
