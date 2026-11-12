import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ArrowLeft, Compass, Play, Trophy } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { GEO_DIFFICULTIES, geoGuesserService, type GeoDifficulty, type GeoLeaderboardEntry, type GeoPlayerCount } from '@/lib/services/GeoGuesserService';

// The website's "Did You Know?" facts (app/triniGeoGuesser/leaderboard/page.tsx).
const TRINI_FACTS = [
  'Trinidad and Tobago is the birthplace of the Steelpan — the only acoustic musical instrument invented in the 20th century.',
  'Pitch Lake in La Brea, Trinidad is the largest natural deposit of asphalt in the world, spanning over 100 acres.',
  'The world’s largest traffic roundabout is the Queen’s Park Savannah in Port of Spain, covering about 260 acres.',
  'Tobago’s Main Ridge Forest Reserve is the oldest legally protected rainforest reserve in the Western Hemisphere, established in 1776.',
  'The Moruga Scorpion pepper, native to the district of Moruga in Trinidad, was certified in 2012 as the hottest chili pepper in the world.',
  'Trinidad and Tobago has one of the highest concentrations of bird species per square mile in the world, with over 480 species recorded.',
];
const isDifficulty = (value: unknown): value is GeoDifficulty => value === 'easy' || value === 'medium' || value === 'hard';
const rankLabel = (rank: number): string => (rank === 1 ? '🥇 1' : rank === 2 ? '🥈 2' : rank === 3 ? '🥉 3' : `#${rank}`);

/** Island Leaderboard (the website's /triniGeoGuesser/leaderboard): podium, full ranking and a T&T fact per level. */
export default function GeoGuesserLeaderboardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedMode, setSelectedMode] = useState<GeoDifficulty>(isDifficulty(params.mode) ? params.mode : 'easy');
  const [leaders, setLeaders] = useState<GeoLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<GeoPlayerCount | null>(null);
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * TRINI_FACTS.length));
  const isWide = width >= 640;

  const load = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) setIsRefreshing(true); else setIsLoading(true);
    setError(null);
    try {
      setLeaders(await geoGuesserService.getLeaderboard(selectedMode));
    } catch (loadError: unknown) {
      console.error('[GeoGuesserLeaderboardScreen.load] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setLeaders([]);
      setError('The leaderboard could not be loaded. Pull down to try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedMode]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setFactIndex(Math.floor(Math.random() * TRINI_FACTS.length)); }, [selectedMode]);
  useEffect(() => {
    void geoGuesserService.getLeaderboardPlayerCount().then(setPlayers).catch((countError: unknown) => {
      console.warn('[GeoGuesserLeaderboardScreen.playerCount] Error:', countError instanceof Error ? countError.message : 'Unknown error');
    });
  }, []);

  const playHref = `/triniGeoGuesser/game?mode=${selectedMode}` as Href;
  const [first, second, third] = leaders;
  const podium = [
    { entry: second, medal: '🥈', isFirst: false },
    { entry: first, medal: '👑', isFirst: true },
    { entry: third, medal: '🥉', isFirst: false },
  ].filter((slot): slot is { entry: GeoLeaderboardEntry; medal: string; isFirst: boolean } => Boolean(slot.entry));
  // On phones the winner goes on top, like the website's small-screen order.
  const orderedPodium = isWide ? podium : [...podium].sort((left, right) => left.entry.rank - right.entry.rank);
  const subtitle = players && players.count > 0
    ? `${players.count.toLocaleString()}${players.isAtLeast ? '+' : ''} ${players.count === 1 ? 'explorer' : 'explorers'} ranked across Trinidad & Tobago.`
    : 'The highest scores recorded by explorers across Trinidad & Tobago.';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace('/triniGeoGuesser' as Href))} style={styles.topButton}>
          <ArrowLeft size={16} color="#059669" />
          <Text style={styles.topButtonText}>Game Hub</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push(playHref)} style={styles.playChip}>
          <Play size={14} color="#ffffff" fill="#ffffff" />
          <Text style={styles.playChipText}>Play {selectedMode.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}>
        <View style={styles.column}>
          <View style={styles.card}>
            <View style={styles.trophyBox}><Trophy size={24} color="#d97706" /></View>
            <Text style={styles.title}>Island Leaderboard 🏆</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <View style={styles.tabs} accessibilityRole="tablist">
              {GEO_DIFFICULTIES.map((mode) => (
                <TouchableOpacity key={mode} accessibilityRole="tab" accessibilityState={{ selected: selectedMode === mode }} onPress={() => setSelectedMode(mode)} style={[styles.tab, selectedMode === mode && styles.tabActive]}>
                  <Text style={[styles.tabText, selectedMode === mode && styles.tabTextActive]}>{mode}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {isLoading ? (
              <View style={styles.list} accessibilityLabel="Loading high scores">
                <View style={[styles.podium, isWide && styles.podiumWide]}>
                  {[0, 1, 2].map((index) => (
                    <View key={index} style={[styles.podiumCard, isWide && styles.flex]}>
                      <SkeletonCircle size={48} />
                      <Skeleton width={110} height={14} />
                      <Skeleton width={60} height={18} />
                    </View>
                  ))}
                </View>
                {[0, 1, 2, 3].map((index) => (
                  <View key={index} style={styles.row}><Skeleton width={34} height={14} /><SkeletonCircle size={26} /><View style={styles.flex}><Skeleton width="60%" height={14} /></View><Skeleton width={50} height={14} /></View>
                ))}
              </View>
            ) : error ? (
              <Text style={styles.error}>{error}</Text>
            ) : leaders.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><Compass size={28} color={colors.mutedText} /></View>
                <Text style={styles.emptyTitle}>No Scores Yet</Text>
                <Text style={styles.emptyText}>Be the first player to complete a 10-round game on {selectedMode} mode and claim the top of the podium!</Text>
                <TouchableOpacity accessibilityRole="button" onPress={() => router.push(playHref)} style={styles.playChip}>
                  <Play size={14} color="#ffffff" fill="#ffffff" />
                  <Text style={styles.playChipText}>Play Now</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.list}>
                <View style={[styles.podium, isWide && styles.podiumWide]}>
                  {orderedPodium.map(({ entry, medal, isFirst }) => (
                    <View key={entry.rank} style={[styles.podiumCard, isWide && styles.flex, isFirst && styles.podiumFirst]}>
                      <Text style={isFirst ? styles.crown : styles.medal}>{medal}</Text>
                      <UserAvatar profileImage={entry.avatarUrl} firstName={entry.username} size={isFirst ? 56 : 48} />
                      <Text style={[styles.podiumName, isFirst && styles.podiumNameFirst]} numberOfLines={1}>{entry.username}{entry.userId && entry.userId === activeUserId ? ' (you)' : ''}</Text>
                      <Text style={isFirst ? styles.podiumScoreFirst : styles.podiumScore}>{entry.score} pts</Text>
                      {isFirst ? <Text style={styles.firstPlace}>1ST PLACE</Text> : null}
                    </View>
                  ))}
                </View>

                <View style={styles.table}>
                  <View style={styles.tableHead}>
                    <Text style={[styles.headText, styles.rankColumn]}>RANK</Text>
                    <Text style={[styles.headText, styles.flex]}>PLAYER</Text>
                    <Text style={styles.headText}>SCORE</Text>
                  </View>
                  {leaders.map((entry) => {
                    const isMine = Boolean(entry.userId && entry.userId === activeUserId);
                    return (
                      <View key={entry.rank} style={[styles.row, isMine && styles.rowMine]}>
                        <Text style={[styles.rankText, styles.rankColumn]}>{rankLabel(entry.rank)}</Text>
                        <UserAvatar profileImage={entry.avatarUrl} firstName={entry.username} size={26} />
                        <Text style={[styles.rowName, styles.flex]} numberOfLines={1}>{entry.username}{isMine ? ' (you)' : ''}</Text>
                        <Text style={styles.rowScore}>{entry.score} pts</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          <View style={styles.factCard}>
            <Text style={styles.factText}><Text style={styles.factLabel}>🇹🇹 Did You Know? </Text>{TRINI_FACTS[factIndex]}</Text>
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
  playChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: '#059669' },
  playChipText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { width: '100%', maxWidth: 860, padding: 16, gap: 16 },
  card: { padding: 18, gap: 10, borderRadius: 24, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center' },
  trophyBox: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.warningSurface },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.mutedText, fontSize: 13, textAlign: 'center' },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, marginTop: 6, borderRadius: 16, backgroundColor: colors.control },
  tab: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 12 },
  tabActive: { backgroundColor: '#059669' },
  tabText: { color: colors.secondaryText, fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  tabTextActive: { color: '#ffffff' },
  list: { alignSelf: 'stretch', gap: 16, marginTop: 8 },
  podium: { gap: 10 },
  podiumWide: { flexDirection: 'row', alignItems: 'flex-end' },
  podiumCard: { alignItems: 'center', gap: 4, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  podiumFirst: { borderWidth: 2, borderColor: '#fbbf24', backgroundColor: colors.warningSurface },
  medal: { fontSize: 22 },
  crown: { fontSize: 28 },
  podiumName: { color: colors.text, fontSize: 14, fontWeight: '800', maxWidth: 180 },
  podiumNameFirst: { fontSize: 16, fontWeight: '900' },
  podiumScore: { color: '#10b981', fontSize: 18, fontWeight: '900' },
  podiumScoreFirst: { color: '#d97706', fontSize: 24, fontWeight: '900' },
  firstPlace: { color: colors.warningText, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  table: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tableHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.control },
  headText: { color: colors.mutedText, fontSize: 10, fontWeight: '900' },
  rankColumn: { width: 46 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border },
  rowMine: { backgroundColor: colors.successSurface },
  rankText: { color: colors.mutedText, fontSize: 12, fontWeight: '800' },
  rowName: { color: colors.text, fontSize: 13, fontWeight: '600' },
  rowScore: { color: '#10b981', fontSize: 13, fontWeight: '900' },
  error: { color: colors.destructiveText, fontSize: 13, paddingVertical: 24, textAlign: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  emptyText: { color: colors.mutedText, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 320, marginBottom: 8 },
  factCard: { padding: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  factText: { color: colors.secondaryText, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  factLabel: { color: colors.accentText, fontWeight: '900' },
});
