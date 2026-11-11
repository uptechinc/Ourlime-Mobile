import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type WorkspaceScreenStateProps = { message: string; actionLabel?: string; onAction?: () => void };

/** Centered message (access denied, load error) for the course workspace screens, with an optional action. */
export default function WorkspaceScreenState({ message, actionLabel, onAction }: WorkspaceScreenStateProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.text, { color: colors.text }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} style={[styles.button, { backgroundColor: colors.accent }]}>
          <Text style={[styles.buttonText, { color: colors.onAccent }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  text: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: { minHeight: 44, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  buttonText: { fontWeight: '800', fontSize: 14 },
});
