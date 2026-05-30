import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { DrawerContent } from '@/components/DrawerContent';
import { useAuth } from '@/lib/auth';

export default function AppLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#0f766e" />
      </View>
    );
  }
  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (user.role === 'tenant') return <Redirect href="/tenant" />;

  return (
    <Drawer
      drawerContent={(props) => <DrawerContent navigation={props.navigation as never} />}
      screenOptions={{
        headerTintColor: '#0f172a',
        headerStyle: { backgroundColor: '#ffffff' },
        headerTitleStyle: { fontWeight: '700' },
        drawerType: 'front',
        swipeEdgeWidth: 60,
      }}
    >
      <Drawer.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Drawer.Screen name="parent-llc" options={{ title: 'Parent LLC' }} />
      <Drawer.Screen name="series" options={{ title: 'Child Series' }} />
      <Drawer.Screen name="properties" options={{ title: 'Properties' }} />
      <Drawer.Screen name="units" options={{ title: 'Units' }} />
      <Drawer.Screen name="tenants" options={{ title: 'Tenants' }} />
      <Drawer.Screen name="leases" options={{ title: 'Leases' }} />
      <Drawer.Screen name="rent" options={{ title: 'Rent' }} />
      <Drawer.Screen name="expenses" options={{ title: 'Expenses' }} />
      <Drawer.Screen name="maintenance" options={{ title: 'Maintenance' }} />
      <Drawer.Screen name="documents" options={{ title: 'Documents' }} />
      <Drawer.Screen name="reports" options={{ title: 'Reports' }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings' }} />
    </Drawer>
  );
}
