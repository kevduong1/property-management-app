import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';
import { Button, Card, Icon, Input } from '@/components/ui';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from '@/constants';
import { useAuth } from '@/lib/auth';

const DEMO_ROLES: Role[] = ['owner_admin', 'manager', 'bookkeeper', 'tenant'];

export default function SignIn() {
  const { demoMode, signInDemo, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  function chooseDemo(role: Role) {
    signInDemo(role);
    router.replace(role === 'tenant' ? '/tenant' : '/dashboard');
  }

  async function submit() {
    setBusy(true);
    setError(undefined);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
    else router.replace('/');
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 48 }}>
        <View className="mt-6 items-center">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Icon name="bank" size={30} />
          </View>
          <Text className="mt-3 text-2xl font-bold text-foreground">Series Ledger</Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">
            Bookkeeping-first property management for Series LLCs
          </Text>
        </View>

        {demoMode ? (
          <Card>
            <View className="p-4">
              <Text className="text-base font-semibold text-foreground">Explore the demo</Text>
              <Text className="mt-1 text-sm text-muted-foreground">
                Pick a role to sign in with sample data. Each role has different permissions.
              </Text>
              <View className="mt-3 gap-2">
                {DEMO_ROLES.map((role) => (
                  <Pressable
                    key={role}
                    onPress={() => chooseDemo(role)}
                    className="flex-row items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3 active:bg-muted"
                  >
                    <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                      <Icon name={role === 'tenant' ? 'key' : 'users'} size={16} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">
                        {ROLE_LABELS[role]}
                      </Text>
                      <Text className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</Text>
                    </View>
                    <Icon name="chevron" size={18} className="text-muted-foreground" />
                  </Pressable>
                ))}
              </View>
            </View>
          </Card>
        ) : (
          <Card>
            <View className="p-4">
              <Text className="mb-3 text-base font-semibold text-foreground">Sign in</Text>
              <Input
                label="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
              />
              <Input
                label="Password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
              />
              {error ? <Text className="mb-2 text-sm text-danger">{error}</Text> : null}
              <Button title="Sign In" onPress={submit} loading={busy} />
            </View>
          </Card>
        )}

        <Text className="px-2 text-center text-xs text-muted-foreground">
          {demoMode
            ? 'Running in demo mode with an in-memory dataset. Configure Supabase in .env to use real data.'
            : 'Powered by Supabase Auth.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
