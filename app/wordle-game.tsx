import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookOpen, ChevronLeft, CircleHelp, Leaf, Lightbulb, RotateCcw } from 'lucide-react-native';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { WORDLE_MAX_GUESSES, WORDLE_MAX_HINTS, WORDLE_WORD_LENGTH, wordleService, type WordleGuess, type WordleLetterState } from '@/lib/services/WordleService';
import { WordGrid, WordKeyboard } from '@/components/games/wordle/WordleTiles';
import { WordleDictionaryModal, WordleGameOverModal, WordleHelpModal, WordleHintModal } from '@/components/games/wordle/WordleModals';

const LIMEY_THINKING = require('@/assets/images/stickers/thinking/Thinking.png');
const WORDMARK = ['O', 'U', 'R', 'L', 'I', 'M', 'E'];

/** Trini Wordle: the website's /wordle-game (GameBoard) laid out for phones. */
export default function WordleGameScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [targetWord, setTargetWord] = useState(() => wordleService.createTargetWord());
  const [guesses, setGuesses] = useState<WordleGuess[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [letterStates, setLetterStates] = useState<Map<string, WordleLetterState>>(() => new Map());
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(false);
  const [won, setWon] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [hintsRemaining, setHintsRemaining] = useState<number>(WORDLE_MAX_HINTS);
  const [revealedLetterIndices, setRevealedLetterIndices] = useState<number[]>([]);
  const [helpVisible, setHelpVisible] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const [dictionaryVisible, setDictionaryVisible] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStartedRef = useRef(false);
  hasStartedRef.current = guesses.length > 0 || currentGuess.length > 0;

  useEffect(() => () => {
    [messageTimer, shakeTimer, resultTimer].forEach((timer) => { if (timer.current) clearTimeout(timer.current); });
  }, []);

  // The admin-managed word list, like the website: pick from it if the player hasn't started yet.
  useEffect(() => {
    let isActive = true;
    void wordleService.loadWords().then(() => {
      if (isActive && !hasStartedRef.current) setTargetWord(wordleService.createTargetWord());
    });
    return () => { isActive = false; };
  }, []);

  const showMessage = useCallback((nextMessage: string, durationMs = 2000) => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
    setMessage(nextMessage);
    messageTimer.current = setTimeout(() => setMessage(''), durationMs);
  }, []);

  const triggerShake = useCallback(() => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShake(true);
    shakeTimer.current = setTimeout(() => setShake(false), 600);
  }, []);

  const handleSubmit = async () => {
    if (gameOver || submitting) return;
    if (currentGuess.length !== WORDLE_WORD_LENGTH) {
      showMessage('Not enough letters');
      triggerShake();
      return;
    }
    setSubmitting(true);
    try {
      if (!(await wordleService.isValidGuess(currentGuess))) {
        showMessage('Not in word list');
        triggerShake();
        return;
      }
      const checkedGuess = wordleService.checkGuess(currentGuess, targetWord);
      const nextGuesses = [...guesses, checkedGuess];
      const didWin = currentGuess === targetWord;
      const didEnd = didWin || nextGuesses.length >= WORDLE_MAX_GUESSES;
      setGuesses(nextGuesses);
      setCurrentGuess('');
      setLetterStates((currentStates) => wordleService.mergeKeyboardState(currentStates, checkedGuess));
      setWon(didWin);
      setGameOver(didEnd);
      if (didWin) showMessage('CONGRATULATIONS!', 3000);
      else if (didEnd) showMessage(`The word was ${targetWord}`, 5000);
      if (didEnd) resultTimer.current = setTimeout(() => setResultVisible(true), 1500);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKey = (key: string) => {
    if (gameOver || submitting) return;
    if (key === 'ENTER') { void handleSubmit(); return; }
    if (key === 'BACK') { setCurrentGuess((value) => value.slice(0, -1)); return; }
    setCurrentGuess((value) => (value.length < WORDLE_WORD_LENGTH ? `${value}${key}` : value));
  };

  const handleRevealHint = () => {
    if (gameOver) return;
    if (hintsRemaining <= 0) { showMessage('No more hints left. Yuh on yuh own now!'); return; }
    const nextIndex = Array.from({ length: WORDLE_WORD_LENGTH }, (_, index) => index).find((index) => !revealedLetterIndices.includes(index));
    if (nextIndex === undefined) return;
    setRevealedLetterIndices((current) => [...current, nextIndex]);
    setHintsRemaining((current) => current - 1);
  };

  const handleNewGame = () => {
    if (resultTimer.current) clearTimeout(resultTimer.current);
    setTargetWord(wordleService.createTargetWord());
    setGuesses([]);
    setCurrentGuess('');
    setLetterStates(new Map());
    setMessage('');
    setShake(false);
    setWon(false);
    setGameOver(false);
    setHintsRemaining(WORDLE_MAX_HINTS);
    setRevealedLetterIndices([]);
    setResultVisible(false);
    setHintVisible(false);
    setDictionaryVisible(false);
  };

  const tileSize = Math.min(54, Math.floor((Math.min(width, 520) - 72) / WORDLE_WORD_LENGTH));
  const actions = [
    { label: 'Start a new word', icon: RotateCcw, onPress: handleNewGame },
    { label: 'How to play', icon: CircleHelp, onPress: () => setHelpVisible(true) },
    { label: 'Get a hint', icon: Lightbulb, onPress: () => setHintVisible(true) },
    { label: 'Word dictionary', icon: BookOpen, onPress: () => setDictionaryVisible(true) },
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink} accessibilityRole="button" accessibilityLabel="All games">
          <ChevronLeft size={20} color={colors.icon} />
          <Text style={styles.backText}>All games</Text>
        </TouchableOpacity>
        <View style={styles.brandMark}><Leaf size={16} color="#10b981" /><Text style={styles.brandText}>Trini Wordle</Text></View>
        <View style={styles.actions}>
          {actions.map(({ label, icon: Icon, onPress }) => (
            <TouchableOpacity key={label} onPress={onPress} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={label}>
              <Icon size={20} color={colors.icon} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} bounces={false}>
        <View style={styles.column}>
          <View style={styles.header}>
            <View style={styles.wordmark} accessibilityLabel="Ourlime Trini Wordle">
              {WORDMARK.map((letter, index) => (
                <View key={index} style={[styles.wordmarkTile, letter === 'L' && styles.wordmarkTileLime]}><Text style={[styles.wordmarkText, letter === 'L' && styles.wordmarkTextLime]}>{letter}</Text></View>
              ))}
            </View>
            <Text style={styles.roundLabel}>Daily lime · Trini edition</Text>
            <Text style={styles.title}>Crack de lime</Text>
            <Text style={styles.subtitle}>Five letters. Six chances. Pure Trini flavour.</Text>
            <View style={styles.progress} accessibilityLabel={`${guesses.length} of ${WORDLE_MAX_GUESSES} guesses used`}>
              {Array.from({ length: WORDLE_MAX_GUESSES }, (_, index) => <View key={index} style={[styles.progressDot, index < guesses.length && styles.progressDotUsed]} />)}
            </View>
          </View>

          <View style={styles.messageSpace}>{message ? <Text style={styles.message}>{message}</Text> : null}</View>
          <WordGrid guesses={guesses} currentGuess={currentGuess} shake={shake} tileSize={tileSize} />

          <View style={styles.limey} accessibilityLabel="Limey is thinking about the word">
            <Image source={LIMEY_THINKING} style={styles.limeyImage} contentFit="contain" />
            <View style={styles.limeyBubble}>
              <Text style={styles.limeyLabel}>Limey says</Text>
              <Text style={styles.limeyText}>{currentGuess ? 'Dat looking promising…' : 'Take yuh time. Think it through!'}</Text>
            </View>
          </View>

          <WordKeyboard letterStates={letterStates} disabled={gameOver || submitting} onKeyPress={handleKey} />
          {submitting ? <View style={styles.checking}><ActivityIndicator size="small" color="#10b981" /><Text style={styles.muted}>Checking word…</Text></View> : null}
        </View>
      </ScrollView>

      <WordleHelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />
      <WordleHintModal visible={hintVisible} onClose={() => setHintVisible(false)} targetWord={targetWord} revealedLetterIndices={revealedLetterIndices} hintsRemaining={hintsRemaining} onRevealLetter={handleRevealHint} />
      <WordleDictionaryModal visible={dictionaryVisible} onClose={() => setDictionaryVisible(false)} guesses={guesses} />
      <WordleGameOverModal visible={resultVisible} won={won} word={targetWord} guesses={guesses.length} onClose={() => setResultVisible(false)} onNewGame={handleNewGame} />
    </SafeAreaView>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  topBar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  backLink: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingRight: 4 },
  backText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  brandMark: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  brandText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  actions: { flexDirection: 'row' },
  iconButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 8, paddingBottom: 12 },
  column: { width: '100%', maxWidth: 520, gap: 10 },
  header: { alignItems: 'center', gap: 4, paddingTop: 12 },
  wordmark: { flexDirection: 'row', gap: 3, marginBottom: 4 },
  wordmarkTile: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  wordmarkTileLime: { borderColor: '#10b981', backgroundColor: '#10b981' },
  wordmarkText: { color: colors.text, fontSize: 11, fontWeight: '900' },
  wordmarkTextLime: { color: '#ffffff' },
  roundLabel: { color: colors.accentText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: colors.text, fontSize: 24, fontWeight: '900' },
  subtitle: { color: colors.mutedText, fontSize: 13, textAlign: 'center' },
  progress: { flexDirection: 'row', gap: 5, marginTop: 6 },
  progressDot: { width: 18, height: 5, borderRadius: 3, backgroundColor: colors.border },
  progressDotUsed: { backgroundColor: '#10b981' },
  messageSpace: { height: 36, alignItems: 'center', justifyContent: 'center' },
  message: { color: '#ffffff', backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 13, paddingVertical: 7, fontSize: 12, fontWeight: '900', overflow: 'hidden' },
  limey: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4, paddingHorizontal: 8 },
  limeyImage: { width: 56, height: 56 },
  limeyBubble: { flex: 1, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  limeyLabel: { color: colors.mutedText, fontSize: 11, fontWeight: '700' },
  limeyText: { color: colors.text, fontSize: 13, fontWeight: '800' },
  checking: { height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  muted: { color: colors.mutedText, fontSize: 11 },
});
