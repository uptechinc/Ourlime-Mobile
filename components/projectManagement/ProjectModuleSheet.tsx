import type { ReactNode } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { PROJECT_GUTTER, ProjectIconButton, ProjectScreenHeader } from '@/components/projectManagement/ProjectUiParts';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type ProjectModuleSheetProps = {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * A full-screen page for an optional project module (files, timeline, workload, timesheets), opened from the
 * project's ⋯ menu so the main screen stays focused on overview, tasks, milestones and team.
 */
export default function ProjectModuleSheet({ visible, title, subtitle, onClose, children }: ProjectModuleSheetProps) {
  const { colors } = useAppTheme();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.canvas }}>
        <ProjectScreenHeader title={title} subtitle={subtitle} onBack={onClose} right={<ProjectIconButton accessibilityLabel="Close" onPress={onClose}><X size={22} color={colors.icon} /></ProjectIconButton>} />
        <SafeAreaView /* discipline-exempt safe-area-edges: the header above applies the top inset */ edges={['left', 'right', 'bottom']} style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: PROJECT_GUTTER, gap: 12, paddingBottom: 40 }}>
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
