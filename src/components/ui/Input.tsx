import { useState } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label?: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-3">
      {label ? (
        <Text className="mb-1 text-sm font-medium text-foreground">
          {label}
          {required ? <Text className="text-danger"> *</Text> : null}
        </Text>
      ) : null}
      {children}
      {hint ? <Text className="mt-1 text-xs text-muted-foreground">{hint}</Text> : null}
    </View>
  );
}

export function Input({
  label,
  required,
  hint,
  className = '',
  ...props
}: TextInputProps & { label?: string; required?: boolean; hint?: string; className?: string }) {
  const [focused, setFocused] = useState(false);
  const input = (
    <TextInput
      placeholderTextColor="#94a3b8"
      className={`rounded-lg border bg-surface px-3 py-2.5 text-base text-foreground ${
        focused ? 'border-primary' : 'border-border'
      } ${className}`}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...props}
    />
  );
  if (!label && !hint) return input;
  return (
    <Field label={label} required={required} hint={hint}>
      {input}
    </Field>
  );
}
