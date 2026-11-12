import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ArrowLeft, Compass, Flame, MapPin, Play, Trophy } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { useProfileResource } from '@/lib/hooks/useProfileResource';
import { GEO_DIFFICULTIES, type GeoDifficulty } from '@/lib/services/GeoGuesserService';

// The website's DIFFICULTY_CONFIG (app/triniGeoGuesser/page.tsx).
const DIFFICULTY_CONFIG: Record<GeoDifficulty, { title: string; description: string; time: string; icon: string; badgeColor: string; details: string[] }> = {
  easy: { title: 'Easy Mode', description: 'Relaxed timer with helpful hints for each famous local spot.', time: '5 mins', icon: '🌴', badgeColor: '#059669', details: ['10 Rounds', 'Hints enabled', 'Friendly scoring (< 5km)'] },
  medium: { title: 'Medium Mode', description: 'Faster pace and no hints. Test your genuine island knowledge.', time: '3 mins', icon: '⚡', badgeColor: '#d97706', details: ['10 Rounds', 'No hints', 'Balanced scoring (< 2.5km)'] },
  hard: { title: 'Hard Mode', description: 'Brisk countdown and razor-sharp distance tolerances.', time: '2 mins', icon: '🔥', badgeColor: '#e11d48', details: ['10 Rounds', 'Strict timer', 'Pinpoint scoring (< 1km)'] },
};

const HOW_TO_PLAY = [
  { title: '1. Drop Your Pin', text: 'Study the photo clue and tap anywhere on the Trinidad & Tobago map to drop your marker.', icon: MapPin, color: '#059669' },
  { title: '2. Score Distance Points', text: 'The closer your guess to the target, the more points you earn. Stack 3 in a row for a streak bonus!', icon: Flame, color: '#d97706' },
  { title: '3. Climb The Leaderboard', text: 'Compete across 10 rounds to lock in your personal best and top the national leaderboard.', icon: Trophy, color: '#0d9488' },
] as const;

/** Trini GeoGuesser hub (the website's /triniGeoGuesser): choose a difficulty and start, or open the leaderboard. */
export default function GeoGuesserHomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; mode?: string }>();
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();
  const { resource } = useProfileResource({ kind: 'own', userId: activeUserId ?? '' });
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedMode, setSelectedMode] = useState<GeoDifficulty>('easy');
  const isWide = width >= 640;

  // Older links opened the leaderboard as a tab of this screen.
  if (params.tab === 'leaderboard') {
    return <Redirect href={`/triniGeoGuesser/leaderboard${params.mode ? `?mode=${params.mode}` : ''}` as Href} />;
  }

  const profile = activeUserId ? resource.data?.profile ?? null : null;
  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');
  const playerName = fullName || profile?.firstName || profile?.userName || (activeUserId ? 'Explorer' : 'Guest Explorer');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.back()} style={styles.topButton}>
          <ArrowLeft size={16} color="#059669" />
          <Text style={styles.topButtonText}>All Games</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/triniGeoGuesser/leaderboard' as Href)} style={styles.topButton}>
          <Trophy size={16} color="#f59e0b" />
          <Text style={[styles.topButtonText, styles.accentText]}>Leaderboard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.heroCard}>
            <View style={styles.pill}>
              <Compass size={13} color={colors.successText} />
              <Text style={styles.pillText}>Interactive Geography Game</Text>
            </View>
            <Text style={styles.heroTitle}>Trini <Text style={styles.heroAccent}>GeoGuesser</Text> 🇹🇹</Text>
            <Text style={styles.heroText}>Think you know Trinidad & Tobago? Inspect iconic clues, drop your pin on the map, and see how close your guess is to the actual landmark!</Text>

            <View style={styles.playerChip}>
              <UserAvatar profileImage={profile?.profilePicture ?? null} firstName={playerName} size={28} />
              <View>
                <Text style={styles.playerLabel}>Playing as</Text>
                <Text style={styles.playerName} numberOfLines={1}>{playerName}</Text>
              </View>
              {!activeUserId ? <View style={styles.guestBadge}><Text style={styles.guestText}>Guest</Text></View> : null}
            </View>

            <Text style={styles.sectionLabel}>SELECT DIFFICULTY</Text>
            <View style={[styles.levels, isWide && styles.levelsWide]}>
              {GEO_DIFFICULTIES.map((mode) => {
                const config = DIFFICULTY_CONFIG[mode];
                const isSelected = selectedMode === mode;
                return (
                  <TouchableOpacity key={mode} accessibilityRole="radio" accessibilityState={{ selected: isSelected }} onPress={() => setSelectedMode(mode)} style={[styles.levelCard, isWide && styles.flex, isSelected && styles.levelCardSelected]}>
                    <View style={styles.levelTop}>
                      <Text style={styles.levelIcon}>{config.icon}</Text>
                      <View style={[styles.timeBadge, { backgroundColor: config.badgeColor }]}><Text style={styles.timeBadgeText}>{config.time}</Text></View>
                    </View>
                    <Text style={styles.levelTitle}>{config.title}</Text>
                    <Text style={styles.muted}>{config.description}</Text>
                    {config.details.map((detail) => (
                      <View key={detail} style={styles.detailRow}><View style={styles.detailDot} /><Text style={styles.detailText}>{detail}</Text></View>
                    ))}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity accessibilityRole="button" onPress={() => router.push(`/triniGeoGuesser/game?mode=${selectedMode}` as Href)} style={styles.playButton}>
              <Play size={18} color="#ffffff" fill="#ffffff" />
              <Text style={styles.playButtonText}>Play {selectedMode.toUpperCase()} Mode</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.howTo, isWide && styles.levelsWide]}>
            {HOW_TO_PLAY.map(({ title, text, icon: Icon, color }) => (
              <View key={title} style={[styles.howToCard, isWide && styles.flex]}>
                <View style={[styles.howToIcon, { backgroundColor: `${color}22` }]}><Icon size={20} color={color} /></View>
                <Text style={styles.howToTitle}>{title}</Text>
                <Text style={styles.muted}>{text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  topButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  topButtonText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  accentText: { color: colors.accentText },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { width: '100%', maxWidth: 900, padding: 16, gap: 16 },
  heroCard: { padding: 20, gap: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.successSurface },
  pillText: { color: colors.successText, fontSize: 11, fontWeight: '800' },
  heroTitle: { color: colors.text, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  heroAccent: { color: '#10b981' },
  heroText: { color: colors.secondaryText, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  playerChip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control, maxWidth: '100%' },
  playerLabel: { color: colors.mutedText, fontSize: 11 },
  playerName: { color: colors.text, fontSize: 13, fontWeight: '800', maxWidth: 200 },
  guestBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.warningSurface },
  guestText: { color: colors.warningText, fontSize: 10, fontWeight: '800' },
  sectionLabel: { marginTop: 8, color: colors.mutedText, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  levels: { alignSelf: 'stretch', gap: 12 },
  levelsWide: { flexDirection: 'row' },
  levelCard: { padding: 16, gap: 6, borderRadius: 18, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  levelCardSelected: { borderColor: '#10b981', backgroundColor: colors.successSurface },
  levelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelIcon: { fontSize: 24 },
  timeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  timeBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  levelTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  detailText: { color: colors.secondaryText, fontSize: 12 },
  playButton: { alignSelf: 'stretch', minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 6, borderRadius: 18, backgroundColor: '#059669' },
  playButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  howTo: { gap: 12 },
  howToCard: { padding: 16, gap: 6, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  howToIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  howToTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
});
