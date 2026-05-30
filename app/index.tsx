import { View } from 'react-native';
import { ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

/** Entry router: send users to the right area based on auth + role. */
export default function Index() {
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
  return <Redirect href="/dashboard" />;
}
