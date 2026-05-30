import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/ui';

/** Screen title row with optional back button and trailing action (e.g. + Add). */
export function PageHeader({
  title,
  subtitle,
  back = false,
  action,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-2 px-4 pb-1 pt-3">
      {back ? (
        <Pressable onPress={() => router.back()} hitSlop={10} className="-ml-1 pr-1">
          <Icon name="back" size={26} className="text-foreground" />
        </Pressable>
      ) : null}
      <View className="flex-1">
        <Text className="text-2xl font-bold text-foreground">{title}</Text>
        {subtitle ? <Text className="text-sm text-muted-foreground">{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}
