import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const FormBusyContext = createContext(false);

type MarketFormModalProps = { visible: boolean; title: string; onClose: () => void; children: ReactNode; busy?: boolean };
export default function MarketFormModal({ visible, title, onClose, children, busy = false }: MarketFormModalProps) {
  const { colors } = useAppTheme();
  return <FormBusyContext.Provider value={busy}><Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 }}>{title}</Text>
        <TouchableOpacity onPress={onClose} accessibilityLabel="Close" style={{ padding: 8 }}><X color={colors.text} size={24} /></TouchableOpacity>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>{children}</ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal></FormBusyContext.Provider>;
}

type MarketFieldProps = { label: string; value: string; onChangeText: (value: string) => void; error?: string; keyboardType?: KeyboardTypeOptions; multiline?: boolean };
export function MarketField({ label, value, onChangeText, error, keyboardType, multiline }: MarketFieldProps) {
  const { colors } = useAppTheme();
  const busy = useContext(FormBusyContext);
  return <View style={{ gap: 6 }}>
    <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
    <TextInput editable={!busy} accessibilityLabel={label} value={value} onChangeText={onChangeText} keyboardType={keyboardType}
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
    <Text style={{ color: colors.onAccent, fontWeight: '800' }}>{label}</Text>
  </TouchableOpacity>;
}

// Keep separators while typing; normalized array values must not erase a trailing comma.
type MarketListFieldProps = { label: string; values: string[]; onChange: (values: string[]) => void };
export function MarketListField({ label, values, onChange }: MarketListFieldProps) {
  const [text, setText] = useState(values.join(', '));
  const lastEmitted = useRef(JSON.stringify(values));
  const serialized = JSON.stringify(values);
  useEffect(() => {
    if (serialized !== lastEmitted.current) { setText((JSON.parse(serialized) as string[]).join(', ')); lastEmitted.current = serialized; }
  }, [serialized]);
  return <MarketField label={label} value={text} onChangeText={(next) => {
    setText(next);
    const entries = next.split(',').map((entry) => entry.trim()).filter(Boolean);
    lastEmitted.current = JSON.stringify(entries);
    onChange(entries);
  }} />;
}
