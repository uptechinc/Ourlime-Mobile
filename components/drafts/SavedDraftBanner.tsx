import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

type SavedDraftBannerProps = {
  title?: string;
  savedAt?: string | null;
  onRestore: () => void;
  onDiscard: () => void;
};

function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  return Number.isNaN(date.getTime()) ? '' : `Saved ${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

/** "You have a saved draft" bar with Restore / Discard (same as the website's draft banners). */
export default function SavedDraftBanner({ title = 'You have a saved draft', savedAt, onRestore, onDiscard }: SavedDraftBannerProps) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.banner}>
      <Icon name="file-text" size={18} color="#d97706" />
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {savedAt ? <Text style={[styles.meta, { color: colors.mutedText }]}>{formatSavedAt(savedAt)}</Text> : null}
      </View>
      <TouchableOpacity onPress={onDiscard} style={styles.discardButton} accessibilityRole="button" accessibilityLabel="Discard saved draft">
        <Text style={{ color: colors.destructiveText, fontWeight: '800' }}>Discard</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onRestore} style={[styles.restoreButton, { backgroundColor: colors.accent }]} accessibilityRole="button" accessibilityLabel="Restore saved draft">
        <Text style={{ color: colors.onAccent, fontWeight: '800' }}>Restore</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginBottom: 14, borderRadius: 14, borderWidth: 1, borderColor: '#f59e0b55', backgroundColor: '#f59e0b1a' },
  textColumn: { flex: 1 },
  title: { fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 2 },
  discardButton: { paddingHorizontal: 8, paddingVertical: 7 },
  restoreButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12 },
});
