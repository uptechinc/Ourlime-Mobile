import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { ChevronRight, Grid3x3, Map } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';

// The website's built-in games (app/games/page.tsx).
const GAMES: { id: string; name: string; detail: string; route: string; color: string; icon: 'grid' | 'map' }[] = [
  { id: 'wordle', name: 'Trini Wordle', detail: 'Guess the five-letter word in six tries.', route: '/wordle-game', color: '#7c3aed', icon: 'grid' },
  { id: 'triniGeoGuesser', name: 'Trini GeoGuesser', detail: 'Find places across Trinidad and Tobago on the map.', route: '/triniGeoGuesser', color: '#047857', icon: 'map' },
];

/** Games hub: the same games the website lists. */
export default function GamesScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isWide = width >= 640;

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
      <PageHeader title="Games" onBackPress={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.column, { width: Math.min(width, 900) }]}>
          <Text style={styles.title}>Play on Ourlime</Text>
          <Text style={styles.muted}>Quick games with a Trini twist.</Text>
          <View style={[styles.grid, isWide && styles.gridWide]}>
            {GAMES.map((game) => (
              <Pressable key={game.id} accessibilityRole="button" onPress={() => router.push(game.route as Href)} style={[styles.card, isWide && styles.cardWide]}>
                <View style={[styles.icon, { backgroundColor: game.color }]}>
                  {game.icon === 'map' ? <Map size={26} color="#ffffff" /> : <Grid3x3 size={26} color="#ffffff" />}
                </View>
                <View style={styles.flex}>
                  <Text style={styles.name}>{game.name}</Text>
                  <Text style={styles.muted}>{game.detail}</Text>
                </View>
                <ChevronRight size={20} color={colors.mutedText} />
              </Pressable>
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
  scroll: { alignItems: 'center', paddingBottom: 40 },
  column: { padding: 16, gap: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' },
  muted: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  grid: { marginTop: 10, gap: 12 },
  gridWide: { flexDirection: 'row' },
  card: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  cardWide: { flex: 1 },
  icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 17, fontWeight: '900' },
});
