import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';
import { Field } from './Input';

export interface Option {
  value: string;
  label: string;
}

/**
 * Modal-based select (React Native has no native <select>). Supports an
 * optional "All / none" entry via `allowEmpty` + `emptyLabel`.
 */
export function Select({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  label,
  required,
  allowEmpty = false,
  emptyLabel = 'All',
  className = '',
}: {
  options: Option[];
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const data: Option[] = allowEmpty ? [{ value: '', label: emptyLabel }, ...options] : options;

  const control = (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className={`flex-row items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 ${className}`}
      >
        <Text className={selected ? 'text-base text-foreground' : 'text-base text-muted-foreground'}>
          {selected ? selected.label : value === null || value === undefined ? (allowEmpty ? emptyLabel : placeholder) : placeholder}
        </Text>
        <Icon name="chevron" size={18} className="text-muted-foreground" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable className="max-h-[70%] rounded-t-2xl bg-surface pb-6 pt-2" onPress={() => {}}>
            <View className="mb-2 items-center pt-1">
              <View className="h-1 w-10 rounded-full bg-border" />
            </View>
            {label ? (
              <Text className="px-4 pb-2 text-sm font-semibold text-muted-foreground">{label}</Text>
            ) : null}
            <FlatList
              data={data}
              keyExtractor={(o) => o.value || '__empty'}
              renderItem={({ item }) => {
                const isSel = (item.value || null) === (value ?? null);
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value ? item.value : null);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between px-4 py-3"
                  >
                    <Text className={`text-base ${isSel ? 'font-semibold text-primary' : 'text-foreground'}`}>
                      {item.label}
                    </Text>
                    {isSel ? <Icon name="check" size={16} className="text-primary" /> : null}
                  </Pressable>
                );
              }}
              ItemSeparatorComponent={() => <View className="h-px bg-border" />}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );

  if (!label) return control;
  return (
    <Field label={label} required={required}>
      {control}
    </Field>
  );
}
