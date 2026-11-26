import { createContext, useContext, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, TextInput, type RefreshControlProps } from 'react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import type { KeyboardTypeOptions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const FormBusyContext = createContext(false);

type MarketFormModalProps = {
  visible: boolean; title: string; onClose: () => void; children: ReactNode; busy?: boolean;
  /** Pull-to-refresh for the form's scroll view (e.g. a status screen). */
  refreshControl?: ReactElement<RefreshControlProps>;
};
export default function MarketFormModal({ visible, title, onClose, children, busy = false, refreshControl }: MarketFormModalProps) {
  const { colors } = useAppTheme();
  return <FormBusyContext.Provider value={busy}><Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 }}>{title}</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Close" style={{ padding: 8 }}><X color={colors.text} size={24} /></TouchableOpacity>
      </View>
      <KeyboardSafeView style={{ flex: 1 }}>
        <ScrollView keyboardShouldPersistTaps="handled" refreshControl={refreshControl} contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>{children}</ScrollView>
      </KeyboardSafeView>
    </SafeAreaView>
  </Modal></FormBusyContext.Provider>;
}

type MarketFieldProps = { label: string; value: string; onChangeText: (value: string) => void; error?: string; keyboardType?: KeyboardTypeOptions; multiline?: boolean; placeholder?: string };
export function MarketField({ label, value, onChangeText, error, keyboardType, multiline, placeholder }: MarketFieldProps) {
  const { colors } = useAppTheme();
  // Inputs stay editable while the form is busy: switching them off makes Android move focus and jump the scroll.
  return <View style={{ gap: 6 }}>
    <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType} placeholder={placeholder} placeholderTextColor={colors.mutedText}
      autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'} multiline={multiline}
      style={{ padding: 14, color: colors.text, backgroundColor: colors.surface, borderWidth: 1, borderColor: error ? '#c64d53' : colors.border, borderRadius: 12, minHeight: multiline ? 90 : 48 }} />
    {error ? <Text style={{ color: '#c64d53' }}>{error}</Text> : null}
  </View>;
}

type MarketButtonProps = { label: string; onPress: () => void; disabled?: boolean };
export function MarketButton({ label, onPress, disabled }: MarketButtonProps) {
  const { colors } = useAppTheme();
  const formBusy = useContext(FormBusyContext);
  disabled = disabled || formBusy;
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} disabled={disabled}
    style={{ backgroundColor: colors.accent, borderRadius: 12, padding: 15, alignItems: 'center', opacity: disabled ? 0.5 : 1 }}>
    <Text style={{ color: colors.onAccent, fontWeight: '800', textAlign: 'center' }}>{label}</Text>
  </TouchableOpacity>;
}

// Keep separators while typing; normalized array values must not erase a trailing comma.
type MarketListFieldProps = { label: string; values: string[]; onChange: (values: string[]) => void; error?: string; placeholder?: string };
export function MarketListField({ label, values, onChange, error, placeholder }: MarketListFieldProps) {
  const [text, setText] = useState(values.join(', '));
  const lastEmitted = useRef(JSON.stringify(values));
  const serialized = JSON.stringify(values);
  useEffect(() => {
    if (serialized !== lastEmitted.current) { setText((JSON.parse(serialized) as string[]).join(', ')); lastEmitted.current = serialized; }
  }, [serialized]);
  return <MarketField label={label} value={text} error={error} placeholder={placeholder} onChangeText={(next) => {
    setText(next);
    const entries = next.split(',').map((entry) => entry.trim()).filter(Boolean);
    lastEmitted.current = JSON.stringify(entries);
    onChange(entries);
  }} />;
}
