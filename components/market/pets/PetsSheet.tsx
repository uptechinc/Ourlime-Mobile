import { useMemo, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, type KeyboardTypeOptions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

type PetsSheetProps = {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  /** While true the sheet cannot be dismissed (website ModalShell preventClose). */
  busy?: boolean;
  footer?: ReactNode;
  children: ReactNode;
};

/** Bottom-sheet version of the website's ModalShell used by every Pets dialog. */
export default function PetsSheet({ visible, title, description, onClose, busy = false, footer, children }: PetsSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const handleClose = () => { if (!busy) onClose(); };
  return <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={handleClose}>
    <KeyboardSafeView style={styles.root}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={handleClose} style={styles.scrim} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} disabled={busy} onPress={handleClose} style={styles.close}><X color={colors.text} size={20} /></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>{children}</ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </KeyboardSafeView>
  </Modal>;
}

type PetsButtonProps = { label: string; onPress: () => void; variant?: 'primary' | 'secondary'; disabled?: boolean; busy?: boolean; icon?: ReactNode };
export function PetsButton({ label, onPress, variant = 'primary', disabled = false, busy = false, icon }: PetsButtonProps) {
  const { colors } = useAppTheme();
  const primary = variant === 'primary';
  return <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress} activeOpacity={0.8}
    style={{ flex: 1, minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, overflow: 'hidden', backgroundColor: primary ? '#173f35' : colors.control, opacity: disabled ? 0.5 : 1 }}>
    {busy ? <ActivityIndicator color={primary ? '#ffffff' : colors.text} size="small" /> : icon}
    <Text style={{ color: primary ? '#ffffff' : colors.text, fontSize: 14, fontWeight: '800' }}>{label}</Text>
  </TouchableOpacity>;
}

type PetsFieldProps = { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean; editable?: boolean; keyboardType?: KeyboardTypeOptions; maxLength?: number };
export function PetsField({ label, value, onChangeText, placeholder, multiline = false, editable = true, keyboardType, maxLength }: PetsFieldProps) {
  const { colors } = useAppTheme();
  return <View style={{ gap: 6 }}>
    <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{label} <Text style={{ color: colors.destructiveText }}>*</Text></Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedText}
      multiline={multiline} editable={editable} keyboardType={keyboardType} maxLength={maxLength} textAlignVertical={multiline ? 'top' : 'center'}
      style={{ minHeight: multiline ? 104 : 48, paddingHorizontal: 14, paddingVertical: multiline ? 12 : 0, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, color: colors.text, fontSize: 15 }} />
  </View>;
}

type PetsToggleRowProps = { label: string; value: boolean; onValueChange: (value: boolean) => void };
export function PetsToggleRow({ label, value, onValueChange }: PetsToggleRowProps) {
  const { colors } = useAppTheme();
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => onValueChange(!value)}
    style={{ minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
    <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
    <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.accent, false: colors.disabled }} thumbColor="#ffffff" />
  </Pressable>;
}

export function PetsErrorText({ message }: { message: string }) {
  const { colors } = useAppTheme();
  return <Text accessibilityRole="alert" style={{ padding: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.destructiveSurface, color: colors.destructiveText, fontSize: 13, lineHeight: 18 }}>{message}</Text>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.modalScrim },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 26, borderTopRightRadius: 26, backgroundColor: colors.canvas },
  handle: { alignSelf: 'center', width: 42, height: 5, marginTop: 8, borderRadius: 3, backgroundColor: colors.border },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  description: { marginTop: 3, color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.control },
  body: { paddingHorizontal: 18, paddingBottom: 16, gap: 12 },
  footer: { paddingHorizontal: 18, paddingTop: 12, flexDirection: 'row', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
