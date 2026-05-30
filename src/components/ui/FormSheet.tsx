import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { Icon } from './Icon';

/**
 * Bottom-sheet style modal that hosts create/edit forms. Provides a sticky
 * header (title + close) and footer (cancel / submit).
 */
export function FormSheet({
  visible,
  title,
  onClose,
  onSubmit,
  submitLabel = 'Save',
  submitting = false,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  submitting?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <SafeAreaView edges={['bottom']} className="max-h-[92%] rounded-t-2xl bg-background">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
              <Text className="text-lg font-bold text-foreground">{title}</Text>
              <Pressable onPress={onClose} hitSlop={10} className="p-1">
                <Icon name="close" size={18} className="text-muted-foreground" />
              </Pressable>
            </View>
            <ScrollView
              className="px-4"
              contentContainerStyle={{ paddingVertical: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
            {onSubmit ? (
              <View className="flex-row gap-3 border-t border-border px-4 py-3">
                <Button title="Cancel" variant="outline" onPress={onClose} className="flex-1" />
                <Button
                  title={submitLabel}
                  onPress={onSubmit}
                  loading={submitting}
                  className="flex-1"
                />
              </View>
            ) : null}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
