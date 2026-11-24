import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { PROJECT_RIPPLE } from '@/components/projectManagement/ProjectUiParts';

type ProjectActionSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

/** A bottom sheet of actions with a title and a Cancel button (tap outside or Back also closes it). */
export default function ProjectActionSheet({ visible, title, subtitle, onClose, children }: ProjectActionSheetProps) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.modalScrim }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={{ maxHeight: '85%', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingHorizontal: 12, paddingBottom: Math.max(16, insets.bottom + 8), borderTopWidth: isDark ? 1 : 0, borderColor: colors.border }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 10 }} />
          <View style={{ paddingHorizontal: 8, paddingBottom: 8 }}>
            <Text accessibilityRole="header" numberOfLines={2} style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{title}</Text>
            {subtitle ? <Text numberOfLines={2} style={{ color: colors.mutedText, fontSize: 13, marginTop: 2 }}>{subtitle}</Text> : null}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 2 }}>
            {children}
          </ScrollView>
          <Pressable onPress={onClose} android_ripple={PROJECT_RIPPLE} accessibilityRole="button" accessibilityLabel="Cancel" style={{ marginTop: 8, minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control, overflow: 'hidden' }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
