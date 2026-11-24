import { StyleSheet, View } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { ELearningEmptyState } from '@/components/eLearning/ELearningParts';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type WorkspaceScreenStateProps = { message: string; actionLabel?: string; onAction?: () => void; title?: string };

/** Centered message (access denied, load error) for the course workspace screens, with an optional action. */
export default function WorkspaceScreenState({ message, actionLabel, onAction, title }: WorkspaceScreenStateProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.center}>
      <ELearningEmptyState icon={<BookOpen size={40} color={colors.mutedText} />} title={title ?? message} hint={title ? message : undefined} actionLabel={actionLabel} onAction={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', padding: 12 },
});
