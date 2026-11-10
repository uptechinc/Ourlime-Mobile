import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import PageHeader from '@/components/ui/PageHeader';
import AppUpdateSettingsRow from '@/components/settings/AppUpdateSettingsRow';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppUpdate } from '@/lib/hooks/useAppUpdate';
import { releaseHistoryService } from '@/lib/services/ReleaseHistoryService';

/** Settings → Release notes: every app release and quick (OTA) update, newest first, with the one running now marked. */
export default function ReleaseNotesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { installedVersion } = useAppUpdate();
  const gutter = width >= 768 ? 24 : 16;
  const styles = useMemo(() => createStyles(colors, gutter), [colors, gutter]);
  const releases = releaseHistoryService.getAll();
  const runningId = installedVersion ? releaseHistoryService.getLatestFor(installedVersion)?.id ?? null : null;

  return (
    <View style={styles.screen}>
      <PageHeader title="Release notes" onBackPress={() => router.back()} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.body, { width: Math.min(width, 760) }]}>
          <Text style={styles.intro}>What changed in each Ourlime update. Quick updates download when you tap Update now; app updates come from Google Play.</Text>
          <AppUpdateSettingsRow />
          {releases.length === 0 ? <Text style={styles.empty}>No release notes yet.</Text> : releases.map((release) => {
            const isRunning = release.id === runningId;
            return <View key={release.id} style={[styles.card, isRunning ? styles.cardRunning : null]}>
              <View style={styles.cardTop}>
                <View style={styles.flex}>
                  <Text style={styles.version}>Version {release.version}</Text>
                  <Text style={styles.meta}>{releaseHistoryService.kindLabel(release.kind)} · {releaseHistoryService.formatDate(release.date)}</Text>
                </View>
                {isRunning ? <Text style={styles.badge}>On this phone</Text> : null}
              </View>
              <View style={styles.notes}>
                {release.notes.map((note) => <View key={note} style={styles.noteRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.noteText}>{note}</Text>
                </View>)}
              </View>
            </View>;
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: AppThemeColors, gutter: number) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1, minWidth: 0 },
  scrollContent: { paddingBottom: 48, alignItems: 'center' },
  body: { alignSelf: 'center', paddingHorizontal: gutter, paddingTop: 16, gap: 14 },
  intro: { color: colors.mutedText, fontSize: 14, lineHeight: 20 },
  empty: { padding: 24, color: colors.mutedText, fontSize: 14, textAlign: 'center' },
  card: { padding: 16, gap: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardRunning: { borderColor: colors.accent },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  version: { color: colors.text, fontSize: 18, fontWeight: '900' },
  meta: { marginTop: 2, color: colors.mutedText, fontSize: 13 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.successSurface, color: colors.successText, fontSize: 12, fontWeight: '800' },
  notes: { gap: 8 },
  noteRow: { flexDirection: 'row', gap: 8 },
  bullet: { color: colors.accentText, fontSize: 15, lineHeight: 21, fontWeight: '900' },
  noteText: { flex: 1, color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
});
