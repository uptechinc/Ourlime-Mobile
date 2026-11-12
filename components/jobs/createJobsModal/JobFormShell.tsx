import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type JobFormShellProps = {
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
};

/** Full-screen form page for creating jobs and quick tasks (web ModalShell size="xl"), laid out for phones. */
export default function JobFormShell({ visible, title, description, onClose, footer, children }: JobFormShellProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{title}</Text>
            {description ? <Text style={styles.description}>{description}</Text> : null}
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={onClose} hitSlop={8} style={styles.close}>
            <X size={22} color={colors.icon} />
          </TouchableOpacity>
        </View>
        <KeyboardSafeView style={styles.body}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          <View style={styles.footer}>{footer}</View>
        </KeyboardSafeView>
      </SafeAreaView>
    </Modal>
  );
}

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 19, fontWeight: '900' },
  description: { color: colors.mutedText, fontSize: 12, marginTop: 3, lineHeight: 17 },
  close: { padding: 4 },
  body: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 30 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});

/** Footer buttons shared by the job forms. */
type FooterButtonProps = { label: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost'; disabled?: boolean; icon?: ReactNode };

export function FooterButton({ label, onPress, variant = 'primary', disabled = false, icon }: FooterButtonProps) {
  const { colors } = useAppTheme();
  const backgroundColor = variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.control : 'transparent';
  const color = variant === 'primary' ? colors.onAccent : variant === 'secondary' ? colors.text : colors.mutedText;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ flexGrow: 1, flexBasis: '30%', minHeight: 46, borderRadius: 12, backgroundColor, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: 10, opacity: disabled ? 0.5 : 1 }}
    >
      {icon}
      <Text style={{ color, fontWeight: '900', fontSize: 14 }} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}
