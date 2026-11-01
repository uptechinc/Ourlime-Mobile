import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Clock, Map, Medal, Trophy } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import UserAvatar from '@/components/ui/UserAvatar';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { GEO_TIMER_SECONDS, GEO_TOTAL_ROUNDS, geoGuesserService, type GeoDifficulty, type GeoLeaderboardEntry } from '@/lib/services/GeoGuesserService';

const LEVELS: { mode: GeoDifficulty; title: string; detail: string; color: string }[] = [
  { mode: 'easy', title: 'Easy', detail: 'Well-known landmarks, with a hint. Within 1 km for full points.', color: '#16a34a' },
  { mode: 'medium', title: 'Medium', detail: 'Familiar places, no hints. Within 0.5 km for full points.', color: '#d97706' },
  { mode: 'hard', title: 'Hard', detail: 'Hidden corners of T&T. Within 0.2 km for full points.', color: '#dc2626' },
];
const CONTENT_MAX_WIDTH = 760;
const isDifficulty = (value: unknown): value is GeoDifficulty => value === 'easy' || value === 'medium' || value === 'hard';

/** Trini GeoGuesser start page: choose a level, or read the leaderboard (website /triniGeoGuesser and /leaderboard). */
export default function GeoGuesserHomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; mode?: string }>();
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState<'play' | 'leaderboard'>(params.tab === 'leaderboard' ? 'leaderboard' : 'play');
  const [boardMode, setBoardMode] = useState<GeoDifficulty>(isDifficulty(params.mode) ? params.mode : 'easy');
  const [leaders, setLeaders] = useState<GeoLeaderboardEntry[]>([]);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setIsLoadingBoard(true);
    setBoardError(null);
    try {
      setLeaders(await geoGuesserService.getLeaderboard(boardMode));
    } catch (error: unknown) {
      console.error('[GeoGuesserHomeScreen.loadBoard] Error:', error instanceof Error ? error.message : 'Unknown error');
      setBoardError('The leaderboard could not be loaded. Pull down to try again.');
    } finally {
      setIsLoadingBoard(false);
    }
  }, [boardMode]);

  useEffect(() => { if (tab === 'leaderboard') void loadBoard(); }, [loadBoard, tab]);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Trini GeoGuesser" onBackPress={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={tab === 'leaderboard' ? <RefreshControl refreshing={isLoadingBoard} onRefresh={() => void loadBoard()} tintColor={colors.accent} /> : undefined}
      >
        <View style={[styles.column, { width: Math.min(width, CONTENT_MAX_WIDTH) }]}>
          <View style={styles.hero}>
            <Map size={30} color="#ffffff" />
            <Text style={styles.heroTitle}>How well do you know T&T?</Text>
            <Text style={styles.heroText}>Look at the photo, tap where it is on the map. {GEO_TOTAL_ROUNDS} rounds against the clock; closer guesses score more.</Text>
          </View>

          <View style={styles.tabs} accessibilityRole="tablist">
            {(['play', 'leaderboard'] as const).map((option) => (
              <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: tab === option }} onPress={() => setTab(option)} style={[styles.tab, tab === option && styles.tabActive]}>
                <Text style={[styles.tabText, tab === option && styles.tabTextActive]}>{option === 'play' ? 'Play' : 'Leaderboard'}</Text>
              </Pressable>
            ))}
          </View>

          {tab === 'play' ? LEVELS.map((level) => (
            <Pressable key={level.mode} accessibilityRole="button" onPress={() => router.push(`/triniGeoGuesser/game?mode=${level.mode}` as Href)} style={styles.levelCard}>
              <View style={[styles.levelBadge, { backgroundColor: level.color }]}><Text style={styles.levelBadgeText}>{level.title.charAt(0)}</Text></View>
              <View style={styles.flex}>
                <Text style={styles.levelTitle}>{level.title}</Text>
                <Text style={styles.muted}>{level.detail}</Text>
                <View style={styles.inline}><Clock size={13} color={colors.mutedText} /><Text style={styles.muted}>{GEO_TIMER_SECONDS[level.mode] / 60} minutes</Text></View>
              </View>
            </Pressable>
          )) : (
            <>
              <View style={styles.modeRow}>
                {LEVELS.map((level) => (
                  <Pressable key={level.mode} accessibilityRole="button" accessibilityState={{ selected: boardMode === level.mode }} onPress={() => setBoardMode(level.mode)} style={[styles.modeChip, boardMode === level.mode && styles.modeChipActive]}>
                    <Text style={[styles.modeChipText, boardMode === level.mode && styles.modeChipTextActive]}>{level.title}</Text>
                  </Pressable>
                ))}
              </View>
              {boardError ? <Text style={styles.error}>{boardError}</Text> : null}
              {!isLoadingBoard && !boardError && leaders.length === 0 ? <Text style={styles.empty}>No scores yet on this level. Be the first!</Text> : null}
              {leaders.map((leader) => (
                <View key={`${leader.rank}-${leader.userId ?? leader.username}`} style={[styles.leaderRow, leader.userId === activeUserId && styles.leaderRowMine]}>
                  {leader.rank <= 3 ? <Medal size={22} color={['#f59e0b', '#94a3b8', '#b45309'][leader.rank - 1]} /> : <Text style={styles.rank}>{leader.rank}</Text>}
                  <UserAvatar profileImage={leader.avatarUrl} firstName={leader.username} size={36} />
                  <Text style={styles.leaderName} numberOfLines={1}>{leader.username}{leader.userId === activeUserId ? ' (you)' : ''}</Text>
                  <View style={styles.inline}><Trophy size={14} color="#f59e0b" /><Text style={styles.leaderScore}>{leader.score}</Text></View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 12 },
  hero: { padding: 20, gap: 8, borderRadius: 20, backgroundColor: '#047857' },
  heroTitle: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  heroText: { color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, backgroundColor: colors.control },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: colors.surface },
  tabText: { color: colors.mutedText, fontSize: 14, fontWeight: '800' },
  tabTextActive: { color: colors.text },
  levelCard: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  levelBadge: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  levelBadgeText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
  levelTitle: { color: colors.text, fontSize: 17, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  inline: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeChip: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  modeChipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  modeChipText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  modeChipTextActive: { color: colors.onAccent },
  error: { color: colors.destructiveText, fontSize: 13 },
  empty: { color: colors.mutedText, fontSize: 14, textAlign: 'center', paddingVertical: 24 },
  leaderRow: { minHeight: 58, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  leaderRowMine: { borderColor: colors.accent },
  rank: { width: 22, textAlign: 'center', color: colors.mutedText, fontSize: 14, fontWeight: '800' },
  leaderName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  leaderScore: { color: colors.text, fontSize: 15, fontWeight: '900' },
});
