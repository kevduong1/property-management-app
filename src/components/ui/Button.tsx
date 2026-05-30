import { ActivityIndicator, Pressable, Text, View } from 'react-native';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANT: Record<Variant, { container: string; text: string }> = {
  primary: { container: 'bg-primary', text: 'text-primary-foreground' },
  outline: { container: 'bg-surface border border-border', text: 'text-foreground' },
  ghost: { container: 'bg-transparent', text: 'text-primary' },
  danger: { container: 'bg-danger', text: 'text-white' },
};

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2.5',
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  className = '',
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  const v = VARIANT[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`flex-row items-center justify-center gap-1.5 rounded-lg ${SIZE[size]} ${v.container} ${
        disabled || loading ? 'opacity-50' : ''
      } ${className}`}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'danger' ? '#fff' : '#0f766e'} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text className={`font-semibold ${v.text} ${size === 'sm' ? 'text-sm' : 'text-base'}`}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}
