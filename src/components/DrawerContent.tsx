import { Pressable, Text, View } from 'react-native';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { Icon } from '@/components/ui';
import { MAIN_NAV } from '@/constants';
import { ROLE_LABELS } from '@/constants';
import { useAuth } from '@/lib/auth';
import { useSeries } from '@/lib/series-context';
import { initials } from '@/lib/format';

/** Custom sidebar: brand, current series, primary nav, and user/sign-out. */
export function DrawerContent({ navigation }: { navigation: { closeDrawer: () => void } }) {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { selected } = useSeries();

  function go(href: string) {
    navigation.closeDrawer();
    router.push(href as never);
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top', 'bottom']}>
      {/* Brand */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-4">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <Icon name="bank" size={20} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-foreground">Series Ledger</Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {selected ? selected.name : 'All Series'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
        {MAIN_NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Pressable
              key={item.href}
              onPress={() => go(item.href)}
              className={`mx-2 mb-0.5 flex-row items-center gap-3 rounded-lg px-3 py-2.5 ${
                active ? 'bg-primary/10' : ''
              }`}
            >
              <Icon name={item.icon} size={18} />
              <Text className={`text-[15px] ${active ? 'font-bold text-primary' : 'font-medium text-foreground'}`}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* User footer */}
      <View className="border-t border-border px-4 py-3">
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
            <Text className="text-sm font-bold text-foreground">{initials(user?.fullName)}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
              {user?.fullName}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {user ? ROLE_LABELS[user.role] : ''}
            </Text>
          </View>
          <Pressable
            onPress={async () => {
              navigation.closeDrawer();
              await signOut();
              router.replace('/(auth)/sign-in');
            }}
            hitSlop={10}
            className="p-1"
          >
            <Icon name="logout" size={18} className="text-muted-foreground" />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
