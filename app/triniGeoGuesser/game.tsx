import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { ArrowLeft, CircleHelp, Clock, Compass, FastForward, Flame, Trophy } from 'lucide-react-native';
import GuessMap from '@/components/games/GuessMap';
import { Skeleton } from '@/components/ui/Skeleton';
import { ModalMotionSurface } from '@/components/ui/ModalMotion';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { useAppData } from '@/lib/contexts/AppDataContext';
import {
  GEO_PENALTY_POINTS, GEO_TIMER_SECONDS, GEO_TOTAL_ROUNDS, geoGuesserService,
  type GeoCoordinates, type GeoDifficulty, type GeoLocation,
} from '@/lib/services/GeoGuesserService';

const isDifficulty = (value: unknown): value is GeoDifficulty => value === 'easy' || value === 'medium' || value === 'hard';
const formatClock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type RoundResult = { distanceKm: number; points: number };
type GameStats = { correct: number; wrong: number; skipped: number };
type ScoreDelta = { id: number; value: number };
type SaveState = 'idle' | 'saving' | 'saved' | 'guest' | 'failed';

const EMPTY_STATS: GameStats = { correct: 0, wrong: 0, skipped: 0 };

/** Trini GeoGuesser round play (the website's /triniGeoGuesser/game): ten photo clues against one game clock. */
export default function GeoGuesserGameScreen() {
  const router = useRouter();
  const navigation = useNavigation();
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
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [isStreakBonus, setIsStreakBonus] = useState(false);
  const [stats, setStats] = useState<GameStats>(EMPTY_STATS);
  const [deltas, setDeltas] = useState<ScoreDelta[]>([]);
  const [timeLeft, setTimeLeft] = useState(GEO_TIMER_SECONDS[mode]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [bestScore, setBestScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [isExitVisible, setIsExitVisible] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const finishedRef = useRef(false);
  const deltaIdRef = useRef(0);
  const allowLeaveRef = useRef(false);
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);
  useEffect(() => { void geoGuesserService.getBestScore(mode).then(setBestScore); }, [mode]);

  const later = useCallback((callback: () => void, delayMs: number) => {
    timersRef.current.push(setTimeout(callback, delayMs));
  }, []);

  const spawnDelta = useCallback((value: number) => {
    const id = ++deltaIdRef.current;
    setDeltas((current) => [...current, { id, value }]);
    later(() => setDeltas((current) => current.filter((delta) => delta.id !== id)), 900);
  }, [later]);

  const start = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const picked = geoGuesserService.pickRounds(await geoGuesserService.getLocations(mode));
      if (picked.length === 0) { setError('No locations available for this difficulty.'); return; }
      setRounds(picked);
      setRoundIndex(0); setGuess(null); setResult(null); setShowHint(false);
      setScore(0); setStreak(0); setStats(EMPTY_STATS); setTimeLeft(GEO_TIMER_SECONDS[mode]);
      setIsOver(false); setIsNewBest(false); setSaveState('idle'); finishedRef.current = false;
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

  const finishGame = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsOver(true);
    if (score > bestScore) {
      setIsNewBest(true);
      setBestScore(score);
      void geoGuesserService.setBestScore(mode, score);
    }
    // Guests keep their best on this device only; the leaderboard needs a signed-in account (like the website).
    if (score <= 0) return;
    if (!activeUserId) { setSaveState('guest'); return; }
    setSaveState('saving');
    geoGuesserService.saveScore(mode, score).then(() => setSaveState('saved')).catch((saveError: unknown) => {
      console.error('[GeoGuesserGameScreen.finishGame] Error:', saveError instanceof Error ? saveError.message : 'Unknown error');
      setSaveState('failed');
    });
  }, [activeUserId, bestScore, mode, score]);

  useEffect(() => { if (timeLeft === 0 && rounds.length > 0) finishGame(); }, [finishGame, rounds.length, timeLeft]);

  // Leaving mid-game (back button, swipe or the header arrow) asks first, like the website's exit dialog.
  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (allowLeaveRef.current || finishedRef.current || rounds.length === 0) return;
    event.preventDefault();
    pendingLeaveRef.current = () => navigation.dispatch(event.data.action);
    setIsExitVisible(true);
  }), [navigation, rounds.length]);

  const location = rounds[roundIndex];

  const changeScore = (value: number) => {
    setScore((current) => Math.max(0, current + value));
    spawnDelta(value);
  };

  const handleConfirm = () => {
    if (!guess || !location || result) return;
    const distanceKm = geoGuesserService.distanceKm(guess, location.coordinates);
    const points = geoGuesserService.points(distanceKm, mode);
    const round = geoGuesserService.scoreRound(points, streak);
    setResult({ distanceKm, points });
    setStreak(round.nextStreak);
    if (round.earned > 0) {
      changeScore(round.earned);
      setStats((current) => ({ ...current, correct: current.correct + 1 }));
    } else {
      setStats((current) => ({ ...current, wrong: current.wrong + 1 }));
    }
    if (round.isStreakBonus) {
      setIsStreakBonus(true);
      later(() => setIsStreakBonus(false), 1500);
    }
  };

  const handleNext = () => {
    if (roundIndex + 1 >= rounds.length) { finishGame(); return; }
    setRoundIndex((current) => current + 1);
    setGuess(null);
    setResult(null);
    setShowHint(false);
  };

  const handleSkip = () => {
    if (result) return;
    if (score > 0) changeScore(-GEO_PENALTY_POINTS);
    setStreak(0);
    setStats((current) => ({ ...current, skipped: current.skipped + 1 }));
    handleNext();
  };

  const handleShowHint = () => {
    if (showHint) return;
    if (score > 0) changeScore(-GEO_PENALTY_POINTS);
    setShowHint(true);
  };

  const handleExit = () => {
    setIsExitVisible(false);
    allowLeaveRef.current = true;
    const pendingLeave = pendingLeaveRef.current;
    pendingLeaveRef.current = null;
    if (pendingLeave) pendingLeave();
    else router.back();
  };

  const isWide = width >= 768;
  const mapHeight = isWide ? Math.max(380, height - 300) : Math.max(300, Math.round(height * 0.45));
  const progressPercent = rounds.length ? Math.min(100, Math.round(((roundIndex + 1) / GEO_TOTAL_ROUNDS) * 100)) : 0;
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);

  const header = (
    <View style={styles.topBar}>
      <View style={styles.topRow}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Exit game" onPress={() => (rounds.length && !isOver ? setIsExitVisible(true) : router.back())} style={styles.iconButton}>
          <ArrowLeft size={21} color={colors.icon} />
        </TouchableOpacity>
        <View style={styles.flex}>
          <View style={styles.inline}>
            <Text style={styles.brand}>TriniGeo</Text>
            <View style={styles.modeBadge}><Text style={styles.modeBadgeText}>{mode}</Text></View>
          </View>
          <Text style={styles.roundText}>Round {Math.min(roundIndex + 1, GEO_TOTAL_ROUNDS)} of {GEO_TOTAL_ROUNDS}</Text>
        </View>
        <View style={[styles.timer, timeLeft < 60 && styles.timerUrgent]}>
          <Clock size={14} color={timeLeft < 60 ? colors.destructiveText : colors.text} />
          <Text style={[styles.timerText, timeLeft < 60 && styles.timerTextUrgent]}>{formatClock(timeLeft)}</Text>
        </View>
        <View style={styles.scorePill}>
          <Trophy size={14} color="#fcd34d" />
          <Text style={styles.scorePillText}>{score} pts</Text>
          {deltas.map((delta) => (
            <Animated.Text key={delta.id} entering={FadeInDown.duration(200)} exiting={FadeOutUp.duration(300)} style={[styles.delta, { color: delta.value > 0 ? '#10b981' : '#e11d48' }]}>
              {delta.value > 0 ? `+${delta.value}` : delta.value}
            </Animated.Text>
          ))}
        </View>
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progressPercent}%` }]} /></View>
      {streak >= 2 ? (
        <View style={[styles.streakBadge, isStreakBonus && styles.streakBadgeBonus]}>
          <Flame size={14} color="#f59e0b" />
          <Text style={styles.streakText}>{streak} streak!{isStreakBonus ? ' +2 bonus' : ''}</Text>
        </View>
      ) : null}
    </View>
  );

  if (isLoading || error || !location) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
        {header}
        {error ? (
          <View style={styles.center}>
            <Compass size={36} color={colors.mutedText} />
            <Text style={styles.centerText}>{error}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => void start()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Try again</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={styles.body} accessibilityLabel="Loading next landmark clue">
            <Skeleton height={220} borderRadius={16} />
            <Skeleton height={mapHeight} borderRadius={16} />
            <View style={styles.actionBar}><Skeleton width={110} height={36} borderRadius={12} /><Skeleton width={150} height={40} borderRadius={12} /></View>
          </View>
        )}
      </SafeAreaView>
    );
  }

  const photo = (
    <View style={styles.photoCard}>
      <View>
        <Image source={{ uri: location.imageUrl }} contentFit="cover" style={[styles.photo, isWide && styles.photoWide]} recyclingKey={`geo-${location.id}-${roundIndex}`} accessibilityLabel="Landmark clue" />
        <View style={styles.clueBadge}><Compass size={12} color="#34d399" /><Text style={styles.clueBadgeText}>Clue #{roundIndex + 1}</Text></View>
      </View>
      {mode === 'easy' && location.hint && !result ? (
        <View style={styles.hintBar}>
          {showHint ? (
            <Text style={styles.hintText}>💡 Hint: {location.hint}</Text>
          ) : (
            <TouchableOpacity accessibilityRole="button" onPress={handleShowHint} style={styles.inline}>
              <CircleHelp size={15} color={colors.warningText} />
              <Text style={styles.hintButtonText}>Unlock Hint (-1 pt)</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );

  const revealCard = result ? (
    <View style={styles.revealCard}>
      <View style={styles.revealHeader}>
        <View style={styles.flex}>
          <Text style={styles.revealLabel}>ACTUAL LANDMARK</Text>
          <Text style={styles.revealTitle}>{location.name}</Text>
        </View>
        <View style={[styles.pointsBadge, result.points > 0 ? styles.pointsBadgeHit : styles.pointsBadgeMiss]}>
          <Text style={[styles.pointsBadgeText, { color: result.points > 0 ? colors.successText : colors.destructiveText }]}>{result.points > 0 ? `+${result.points} pts` : 'Missed (0 pts)'}</Text>
        </View>
      </View>
      {location.info ? <Text style={styles.info}>{location.info}</Text> : null}
      <View style={styles.distanceRow}>
        <Text style={styles.muted}>Distance from guess:</Text>
        <Text style={styles.distanceValue}>{result.distanceKm.toFixed(2)} km</Text>
      </View>
    </View>
  ) : null;

  const actionBar = (
    <View style={styles.actionBar}>
      <TouchableOpacity accessibilityRole="button" disabled={Boolean(result)} onPress={handleSkip} style={[styles.skipButton, result && styles.disabled]}>
        <FastForward size={15} color={colors.secondaryText} />
        <Text style={styles.skipText}>Skip (-1 pt)</Text>
      </TouchableOpacity>
      {result ? (
        <TouchableOpacity accessibilityRole="button" onPress={handleNext} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{roundIndex + 1 >= rounds.length ? 'View Results' : 'Next Round'}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity accessibilityRole="button" disabled={!guess} onPress={handleConfirm} style={[styles.primaryButton, !guess && styles.disabled]}>
          <Text style={styles.primaryButtonText}>{guess ? 'Confirm Guess' : 'Tap the map'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
      {header}
      <ScrollView contentContainerStyle={[styles.body, isWide && styles.bodyWide]}>
        <View style={isWide ? styles.side : undefined}>
          {photo}
          {isWide ? revealCard : null}
        </View>
        <View style={[styles.mapColumn, isWide && styles.flex]}>
          {!isWide ? revealCard : null}
          <View style={{ height: mapHeight }}>
            <GuessMap guess={guess} actual={result ? location.coordinates : null} locked={Boolean(result)} onGuess={setGuess} />
          </View>
          {actionBar}
        </View>
      </ScrollView>

      <Modal visible={isOver} transparent animationType="none" statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" onRequestClose={() => router.back()}>
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.modalBackdrop}>
          <ModalMotionSurface variant="dialog" style={styles.modalCard}>
            <View style={styles.trophyCircle}><Trophy size={32} color="#f59e0b" /></View>
            <Text style={styles.modalTitle}>Game Complete!</Text>
            <Text style={[styles.muted, styles.centerAlign]}>{timeLeft === 0 ? 'Time ran out! ' : ''}Great run exploring sweet Trinidad & Tobago!</Text>
            <View style={styles.finalBox}>
              <Text style={styles.finalLabel}>FINAL SCORE</Text>
              <Text style={styles.finalScore}>{score} <Text style={styles.finalUnit}>pts</Text></Text>
              {isNewBest ? <Text style={styles.newBest}>🎉 New Personal Best!</Text> : <Text style={styles.muted}>Best on this device: {bestScore} pts ({modeLabel})</Text>}
            </View>
            <View style={styles.statsRow}>
              <StatTile value={stats.correct} label="Correct" color="#10b981" styles={styles} />
              <StatTile value={stats.wrong} label="Missed" color="#e11d48" styles={styles} />
              <StatTile value={stats.skipped} label="Skipped" color={colors.secondaryText} styles={styles} />
            </View>
            {saveState !== 'idle' ? (
              <Text style={[styles.muted, styles.centerAlign]}>
                {saveState === 'saving' ? 'Saving your score…' : saveState === 'saved' ? 'Saved to the leaderboard (your best counts).' : saveState === 'guest' ? 'Sign in to put your score on the leaderboard.' : 'Your score could not be saved to the leaderboard.'}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <TouchableOpacity accessibilityRole="button" onPress={() => void start()} style={[styles.primaryButton, styles.flex]}><Text style={styles.primaryButtonText}>Play Again</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={() => router.replace(`/triniGeoGuesser/leaderboard?mode=${mode}` as Href)} style={[styles.secondaryButton, styles.flex]}><Text style={styles.secondaryButtonText}>Leaderboard</Text></TouchableOpacity>
            </View>
          </ModalMotionSurface>
        </SafeAreaView>
      </Modal>

      <Modal visible={isExitVisible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" onRequestClose={() => setIsExitVisible(false)}>
        <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.modalBackdrop}>
          <ModalMotionSurface variant="dialog" style={styles.modalCard}>
            <Text style={styles.modalTitle}>Leave Current Game?</Text>
            <Text style={[styles.muted, styles.centerAlign]}>
              You currently have <Text style={styles.scoreInline}>{score} points</Text>. Progress for incomplete games is not recorded to the leaderboard.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity accessibilityRole="button" onPress={() => { pendingLeaveRef.current = null; setIsExitVisible(false); }} style={[styles.secondaryButton, styles.flex]}><Text style={styles.secondaryButtonText}>Keep Playing</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" onPress={handleExit} style={[styles.dangerButton, styles.flex]}><Text style={styles.primaryButtonText}>Exit Game</Text></TouchableOpacity>
            </View>
          </ModalMotionSurface>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

type StatTileProps = { value: number; label: string; color: string; styles: ReturnType<typeof createStyles> };

function StatTile({ value, label, color, styles }: StatTileProps) {
  return (
    <View style={styles.statTile}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28 },
  centerText: { color: colors.text, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  centerAlign: { textAlign: 'center' },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 18 },
  topBar: { paddingHorizontal: 12, paddingTop: 6, paddingBottom: 8, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  brand: { color: colors.text, fontSize: 14, fontWeight: '900' },
  modeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.successSurface },
  modeBadgeText: { color: colors.successText, fontSize: 10, fontWeight: '800', textTransform: 'capitalize' },
  roundText: { color: colors.mutedText, fontSize: 11 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  timerUrgent: { borderColor: colors.destructive, backgroundColor: colors.destructiveSurface },
  timerText: { color: colors.text, fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerTextUrgent: { color: colors.destructiveText },
  scorePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#059669' },
  scorePillText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  delta: { position: 'absolute', right: 4, top: -18, fontSize: 16, fontWeight: '900' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.control },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#10b981' },
  streakBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#f59e0b', backgroundColor: colors.warningSurface },
  streakBadgeBonus: { borderWidth: 2, transform: [{ scale: 1.06 }] },
  streakText: { color: colors.warningText, fontSize: 12, fontWeight: '800' },
  body: { padding: 14, gap: 12 },
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start' },
  side: { width: 380, gap: 12 },
  mapColumn: { gap: 12 },
  photoCard: { borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  photo: { width: '100%', height: 220 },
  photoWide: { height: 300 },
  clueBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(15,23,42,0.72)' },
  clueBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  hintBar: { padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.control },
  hintText: { color: colors.successText, fontSize: 13, fontStyle: 'italic' },
  hintButtonText: { color: colors.warningText, fontSize: 13, fontWeight: '800' },
  revealCard: { padding: 16, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: '#10b981', backgroundColor: colors.surface },
  revealHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  revealLabel: { color: colors.accentText, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  revealTitle: { color: colors.text, fontSize: 19, fontWeight: '900' },
  pointsBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  pointsBadgeHit: { backgroundColor: colors.successSurface },
  pointsBadgeMiss: { backgroundColor: colors.destructiveSurface },
  pointsBadgeText: { fontSize: 12, fontWeight: '900' },
  info: { color: colors.secondaryText, fontSize: 13, lineHeight: 19 },
  distanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  distanceValue: { color: colors.text, fontSize: 13, fontWeight: '800' },
  actionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  skipButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  skipText: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
  primaryButton: { minHeight: 46, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#059669' },
  primaryButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  secondaryButton: { minHeight: 46, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.control },
  secondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  dangerButton: { minHeight: 46, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#e11d48' },
  disabled: { opacity: 0.45 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15,23,42,0.8)' },
  modalCard: { width: '100%', maxWidth: 440, alignSelf: 'center', alignItems: 'stretch', gap: 12, padding: 22, borderRadius: 24, backgroundColor: colors.surface },
  trophyCircle: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface },
  modalTitle: { color: colors.text, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  finalBox: { alignItems: 'center', gap: 2, padding: 14, borderRadius: 16, backgroundColor: colors.control },
  finalLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  finalScore: { color: '#10b981', fontSize: 40, fontWeight: '900' },
  finalUnit: { fontSize: 14, fontWeight: '700' },
  newBest: { color: colors.warningText, fontSize: 12, fontWeight: '900' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statTile: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.canvas },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { color: colors.mutedText, fontSize: 10, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: 10 },
  scoreInline: { color: '#10b981', fontWeight: '900' },
});
