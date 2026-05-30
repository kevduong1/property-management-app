import { Text, View, type ViewProps } from 'react-native';

export function Card({ className = '', children, ...rest }: ViewProps & { className?: string }) {
  return (
    <View
      className={`rounded-xl border border-border bg-surface ${className}`}
      style={{
        shadowColor: '#0f172a',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }}
      {...rest}
    >
      {children}
    </View>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <View className={`px-4 pt-4 ${className}`}>{children}</View>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <Text className={`text-base font-semibold text-foreground ${className}`}>{children}</Text>;
}

export function CardDescription({ children }: { children: React.ReactNode }) {
  return <Text className="mt-0.5 text-sm text-muted-foreground">{children}</Text>;
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <View className={`p-4 ${className}`}>{children}</View>;
}
