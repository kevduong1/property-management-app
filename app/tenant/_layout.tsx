import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { Icon } from '@/components/ui';

export default function TenantLayout() {
  const { user } = useAuth();

  if (!user) return <Redirect href="/(auth)/sign-in" />;
  if (user.role !== 'tenant') return <Redirect href="/dashboard" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: '#0f766e',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Home',
          tabBarIcon: ({ color, size }) => <Icon name="home" size={size} />,
        }}
      />
      <Tabs.Screen
        name="lease"
        options={{
          title: 'Lease',
          tabBarIcon: ({ color, size }) => <Icon name="file" size={size} />,
        }}
      />
      <Tabs.Screen
        name="maintenance"
        options={{
          title: 'Requests',
          tabBarIcon: ({ color, size }) => <Icon name="wrench" size={size} />,
        }}
      />
    </Tabs>
  );
}
