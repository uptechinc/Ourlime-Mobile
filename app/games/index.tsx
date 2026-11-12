import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { Play, TrendingUp } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import CachedImage from '@/components/ui/CachedImage';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { gamesService, type GameListItem } from '@/lib/services/GamesService';

const formatPlays = (game: GameListItem): string => {
  const noun = game.gameId === 'triniGeoGuesser' ? 'player' : 'play';
  return `${game.totalPlays.toLocaleString()}${game.isPlaysAtLeast ? '+' : ''} ${game.totalPlays === 1 ? noun : `${noun}s`}`;
};

/** Games hub (the website's /games): every built-in and active game with its type and play count. */
export default function GamesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [games, setGames] = useState<GameListItem[]>(() => gamesService.getBuiltInGames());
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const columns = width >= 900 ? 3 : width >= 560 ? 2 : 1;
  const contentWidth = Math.min(width, 1100);
  const cardWidth = (contentWidth - 32 - (columns - 1) * 14) / columns;

  const load = useCallback(async (isPullRefresh = false) => {
    if (isPullRefresh) setIsRefreshing(true);
    try {
      setGames(await gamesService.fetchGames());
    } catch (error: unknown) {
      console.error('[GamesScreen.load] Error:', error instanceof Error ? error.message : 'Unknown error');
      setGames(gamesService.getBuiltInGames());
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Games" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void load(true)} tintColor={colors.accent} />}>
        <View style={[styles.column, { width: contentWidth }]}>
          <Text style={styles.title}>Games</Text>
          <Text style={styles.muted}>Explore interactive games and challenges created for sweet Trinidad & Tobago!</Text>
          {isLoading ? (
            <View style={styles.grid} accessibilityLabel="Loading games">
              {[0, 1, 2].map((index) => (
                <View key={index} style={[styles.card, { width: cardWidth }]}>
                  <Skeleton height={150} borderRadius={0} />
                  <View style={styles.cardBody}><Skeleton width="60%" height={18} /><Skeleton width={90} height={20} borderRadius={999} /><Skeleton width={80} height={12} /></View>
                </View>
              ))}
            </View>
          ) : games.length === 0 ? (
            <Text style={styles.empty}>No games available</Text>
          ) : (
            <View style={styles.grid}>
              {games.map((game) => {
                const icon = gamesService.getTypeIcon(game.type);
                const content = (
                  <>
                    <View style={styles.thumbnail}>
                      {game.thumbnailUrl ? <CachedImage uri={game.thumbnailUrl} style={styles.thumbnailImage} contentFit="cover" /> : <Text style={styles.thumbnailIcon}>{icon}</Text>}
                      {game.route ? <View style={styles.playBadge}><Play size={18} color="#059669" fill="#059669" /></View> : null}
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.name}>{game.name}</Text>
                      <View style={styles.typeBadge}><Text style={styles.typeText}>{icon} {game.type}</Text></View>
                      <View style={styles.inline}>
                        <TrendingUp size={14} color="#10b981" />
                        <Text style={styles.plays}>{formatPlays(game)}</Text>
                      </View>
                      {!game.route ? <Text style={styles.muted}>Not playable in the app yet.</Text> : null}
                    </View>
                  </>
                );
                return game.route ? (
                  <TouchableOpacity key={game.gameId} accessibilityRole="button" accessibilityLabel={`Play ${game.name}`} activeOpacity={0.85} onPress={() => router.push(game.route as Href)} style={[styles.card, { width: cardWidth }]}>
                    {content}
                  </TouchableOpacity>
                ) : (
                  <View key={game.gameId} style={[styles.card, { width: cardWidth }]}>{content}</View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 6 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  empty: { color: colors.mutedText, fontSize: 16, textAlign: 'center', paddingVertical: 60 },
  grid: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  thumbnail: { height: 150, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface },
  thumbnailImage: { width: '100%', height: '100%' },
  thumbnailIcon: { fontSize: 56 },
  playBadge: { position: 'absolute', right: 12, bottom: 12, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.95)' },
  cardBody: { padding: 16, gap: 8 },
  name: { color: colors.text, fontSize: 17, fontWeight: '900' },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  typeText: { color: colors.secondaryText, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  plays: { color: colors.mutedText, fontSize: 12, fontWeight: '600' },
});
