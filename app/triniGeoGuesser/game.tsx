import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Clock, Lightbulb, MapPin, Trophy } from 'lucide-react-native';
import PageHeader from '@/components/ui/PageHeader';
import GuessMap from '@/components/games/GuessMap';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import { GEO_TIMER_SECONDS, GEO_TOTAL_ROUNDS, geoGuesserService, type GeoCoordinates, type GeoDifficulty, type GeoLocation } from '@/lib/services/GeoGuesserService';

const isDifficulty = (value: unknown): value is GeoDifficulty => value === 'easy' || value === 'medium' || value === 'hard';
const formatClock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type RoundResult = { distanceKm: number; points: number };

/** Ten rounds: look at the photo, tap where it is on the map, score by distance before the game clock runs out. */
export default function GeoGuesserGameScreen() {
  const router = useRouter();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();
  const mode: GeoDifficulty = isDifficulty(modeParam) ? modeParam : 'easy';
  const { colors } = useAppTheme();
  const { activeUserId } = useAppData();
  const { width, height } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rounds, setRounds] = useState<GeoLocation[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [guess, setGuess] = useState<GeoCoordinates | null>(null);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GEO_TIMER_SECONDS[mode]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'guest' | 'failed'>('idle');
  const savedRef = useRef(false);

  const start = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const picked = geoGuesserService.pickRounds(await geoGuesserService.getLocations(mode));
      if (picked.length === 0) { setError('No places are available for this level yet.'); return; }
      setRounds(picked);
      setRoundIndex(0); setGuess(null); setResult(null); setScore(0); setTimeLeft(GEO_TIMER_SECONDS[mode]);
      setIsOver(false); setSaveState('idle'); savedRef.current = false;
    } catch (loadError: unknown) {
      console.error('[GeoGuesserGameScreen.start] Error:', loadError instanceof Error ? loadError.message : 'Unknown error');
      setError('The game could not be loaded. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => { void start(); }, [start]);

  useEffect(() => {
    if (isLoading || isOver || rounds.length === 0) return;
    const timer = setInterval(() => setTimeLeft((current) => (current <= 1 ? 0 : current - 1)), 1000);
    return () => clearInterval(timer);
  }, [isLoading, isOver, rounds.length]);

  useEffect(() => { if (timeLeft === 0 && !isOver && rounds.length > 0) setIsOver(true); }, [isOver, rounds.length, timeLeft]);

  // Save once per game; guests keep the result on screen only, like the website.
  useEffect(() => {
    if (!isOver || savedRef.current || score <= 0) return;
    savedRef.current = true;
    if (!activeUserId) { setSaveState('guest'); return; }
    setSaveState('saving');
    geoGuesserService.saveScore(mode, score).then(() => setSaveState('saved')).catch((saveError: unknown) => {
      console.error('[GeoGuesserGameScreen.saveScore] Error:', saveError instanceof Error ? saveError.message : 'Unknown error');
      setSaveState('failed');
    });
  }, [activeUserId, isOver, mode, score]);

  const location = rounds[roundIndex];

  const handleConfirm = () => {
    if (!guess || !location || result) return;
    const distanceKm = geoGuesserService.distanceKm(guess, location.coordinates);
    const points = geoGuesserService.points(distanceKm, mode);
    setResult({ distanceKm, points });
    setScore((current) => current + points);
  };

  const handleNext = () => {
    if (roundIndex + 1 >= rounds.length) { setIsOver(true); return; }
    setRoundIndex((current) => current + 1);
    setGuess(null);
    setResult(null);
  };

  const isWide = width >= 768;
  const mapHeight = isWide ? Math.max(360, height - 260) : Math.round(height * 0.42);

  if (isLoading || error || !location) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <PageHeader title="Trini GeoGuesser" onBackPress={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.centerText}>{error ?? 'Loading places…'}</Text>
          {error ? <Pressable accessibilityRole="button" onPress={() => void start()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Try again</Text></Pressable> : null}
        </View>
      </SafeAreaView>
    );
  }

  if (isOver) {
    return (
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <PageHeader title="Game over" onBackPress={() => router.back()} />
        <View style={styles.center}>
          <Trophy size={48} color="#f59e0b" />
          <Text style={styles.finalScore}>{score} <Text style={styles.finalUnit}>pts</Text></Text>
          <Text style={styles.centerText}>{timeLeft === 0 ? 'Time ran out.' : `You finished all ${GEO_TOTAL_ROUNDS} rounds.`} {mode.charAt(0).toUpperCase() + mode.slice(1)} level.</Text>
          <Text style={styles.muted}>
            {saveState === 'saving' ? 'Saving your score…' : saveState === 'saved' ? 'Saved to the leaderboard (your best counts).' : saveState === 'guest' ? 'Sign in to put your score on the leaderboard.' : saveState === 'failed' ? 'Your score could not be saved.' : ''}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => void start()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Play again</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace(`/triniGeoGuesser?tab=leaderboard&mode=${mode}` as Href)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>View leaderboard</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const photo = (
    <View style={styles.photoCard}>
      <Image source={{ uri: location.imageUrl }} contentFit="cover" style={[styles.photo, isWide && styles.photoWide]} recyclingKey={`geo-${location.id}-${roundIndex}`} />
      {mode === 'easy' && location.hint && !result ? (
        <View style={styles.hint}><Lightbulb size={14} color="#92400e" /><Text style={styles.hintText}>{location.hint}</Text></View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <PageHeader title="Trini GeoGuesser" onBackPress={() => router.back()} />
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>Round {roundIndex + 1}/{rounds.length}</Text>
        <View style={styles.inline}><Clock size={15} color={timeLeft <= 30 ? colors.destructiveText : colors.text} /><Text style={[styles.statusText, timeLeft <= 30 && styles.urgent]}>{formatClock(timeLeft)}</Text></View>
        <Text style={styles.statusText}>{score} pts</Text>
      </View>
      <ScrollView scrollEnabled={!isWide} contentContainerStyle={[styles.body, isWide && styles.bodyWide]}>
        {isWide ? <View style={styles.side}>{photo}</View> : photo}
        <View style={[styles.mapColumn, isWide && styles.flex]}>
          <View style={{ height: mapHeight }}>
            <GuessMap guess={guess} actual={result ? location.coordinates : null} locked={Boolean(result)} onGuess={setGuess} />
          </View>
          {result ? (
            <View style={styles.resultCard}>
              <View style={styles.inline}><MapPin size={16} color="#10b981" /><Text style={styles.resultTitle}>{location.name}</Text></View>
              <Text style={styles.resultDetail}>{result.distanceKm.toFixed(2)} km away · +{result.points} {result.points === 1 ? 'point' : 'points'}</Text>
              {location.info ? <Text style={styles.info} numberOfLines={4}>{location.info}</Text> : null}
              <Pressable accessibilityRole="button" onPress={handleNext} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{roundIndex + 1 >= rounds.length ? 'See results' : 'Next round'}</Text></Pressable>
            </View>
          ) : (
            <Pressable accessibilityRole="button" disabled={!guess} onPress={handleConfirm} style={[styles.primaryButton, !guess && styles.disabled]}>
              <Text style={styles.primaryButtonText}>{guess ? 'Confirm guess' : 'Tap the map to guess'}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  centerText: { color: colors.text, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  muted: { color: colors.mutedText, fontSize: 13, textAlign: 'center' },
  finalScore: { color: colors.text, fontSize: 52, fontWeight: '900' },
  finalUnit: { fontSize: 20, color: colors.mutedText },
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  statusText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  urgent: { color: colors.destructiveText },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  body: { padding: 14, gap: 12 },
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start' },
  side: { width: 360 },
  mapColumn: { gap: 12 },
  photoCard: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.control },
  photo: { width: '100%', aspectRatio: 16 / 10 },
  photoWide: { aspectRatio: 4 / 3 },
  hint: { position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 10, backgroundColor: '#fef3c7' },
  hintText: { flex: 1, color: '#92400e', fontSize: 13, fontWeight: '600' },
  resultCard: { padding: 14, gap: 6, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  resultTitle: { color: colors.text, fontSize: 16, fontWeight: '900' },
  resultDetail: { color: colors.mutedText, fontSize: 13 },
  info: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  primaryButton: { minHeight: 50, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.accent },
  primaryButtonText: { color: colors.onAccent, fontSize: 15, fontWeight: '800' },
  secondaryButton: { minHeight: 46, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
