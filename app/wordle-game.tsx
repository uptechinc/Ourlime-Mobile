import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Delete, CircleHelp, RotateCcw, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { wordleService, type WordleGuess, type WordleLetterState } from '@/lib/services/WordleService';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import { ModalMotionSurface } from '@/components/ui/ModalMotion';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
const keyboardRows = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

export default function WordleGameScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [targetWord, setTargetWord] = useState(() => wordleService.createTargetWord());
  const [guesses, setGuesses] = useState<WordleGuess[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [letterStates, setLetterStates] = useState<Map<string, WordleLetterState>>(() => new Map());
  const [message, setMessage] = useState('');
  const [won, setWon] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
    if (resultTimer.current) clearTimeout(resultTimer.current);
  }, []);

  const showMessage = useCallback((nextMessage: string, durationMs = 2200) => {
    if (messageTimer.current) clearTimeout(messageTimer.current);
    setMessage(nextMessage);
    messageTimer.current = setTimeout(() => setMessage(''), durationMs);
  }, []);

  const handleSubmit = async () => {
    if (gameOver || submitting) return;
    if (currentGuess.length !== WORD_LENGTH) {
      showMessage('Not enough letters');
      return;
    }
    setSubmitting(true);
    try {
      if (!(await wordleService.isValidGuess(currentGuess))) {
        showMessage('Not in word list');
        return;
      }
      const checkedGuess = wordleService.checkGuess(currentGuess, targetWord);
      const nextGuesses = [...guesses, checkedGuess];
      const didWin = currentGuess === targetWord;
      const didEnd = didWin || nextGuesses.length >= MAX_GUESSES;
      setGuesses(nextGuesses);
      setCurrentGuess('');
      setLetterStates((currentStates) => wordleService.mergeKeyboardState(currentStates, checkedGuess));
      setWon(didWin);
      setGameOver(didEnd);
      if (didWin) showMessage('CONGRATULATIONS!', 3000);
      else if (didEnd) showMessage(`The word was ${targetWord}`, 5000);
      if (didEnd) resultTimer.current = setTimeout(() => setResultVisible(true), 700);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKey = (key: string) => {
    if (gameOver || submitting) return;
    if (key === 'ENTER') {
      void handleSubmit();
      return;
    }
    if (key === 'BACK') {
      setCurrentGuess((value) => value.slice(0, -1));
      return;
    }
    setCurrentGuess((value) => value.length < WORD_LENGTH ? `${value}${key}` : value);
  };

  const handleReset = () => {
    if (resultTimer.current) clearTimeout(resultTimer.current);
    setTargetWord(wordleService.createTargetWord());
    setGuesses([]);
    setCurrentGuess('');
    setLetterStates(new Map());
    setMessage('');
    setWon(false);
    setGameOver(false);
    setResultVisible(false);
  };

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.headerButton}><Text style={styles.backIcon}>‹</Text></TouchableOpacity><Text style={styles.headerTitle}>TRINI WORDLE</Text><TouchableOpacity onPress={() => setHelpVisible(true)} style={styles.headerButton}><CircleHelp size={23} color={colors.icon} /></TouchableOpacity></View>
    <ScrollView contentContainerStyle={styles.content} bounces={false}>
      <View style={styles.messageSpace}>{message ? <Text style={styles.message}>{message}</Text> : null}</View>
      <WordGrid guesses={guesses} currentGuess={currentGuess} />
      <View style={styles.keyboard}>{keyboardRows.map((row, rowIndex) => <View key={rowIndex} style={styles.keyboardRow}>{row.map((key) => <WordKey key={key} letter={key} state={letterStates.get(key)} disabled={gameOver || submitting} onPress={() => handleKey(key)} />)}</View>)}</View>
      {submitting ? <View style={styles.dictionaryLoading}><ActivityIndicator size="small" color="#10b981" /><Text style={styles.muted}>Checking word…</Text></View> : null}
    </ScrollView>
    <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />
    <ResultModal visible={resultVisible} won={won} targetWord={targetWord} guesses={guesses.length} onClose={() => setResultVisible(false)} onReset={handleReset} />
  </SafeAreaView>;
}

type WordGridProps = { guesses: WordleGuess[]; currentGuess: string };
function WordGrid({ guesses, currentGuess }: WordGridProps) {
  return <View style={stylesBase.grid}>{Array.from({ length: MAX_GUESSES }, (_, rowIndex) => {
    const submittedGuess = guesses[rowIndex];
    const rowWord = submittedGuess?.word ?? (rowIndex === guesses.length ? currentGuess : '');
    return <View key={rowIndex} style={stylesBase.gridRow}>{Array.from({ length: WORD_LENGTH }, (_, columnIndex) => <WordTile key={columnIndex} letter={rowWord[columnIndex] ?? ''} state={submittedGuess?.states[columnIndex]} />)}</View>;
  })}</View>;
}

type WordTileProps = { letter: string; state?: WordleLetterState };
function WordTile({ letter, state }: WordTileProps) {
  const { colors } = useAppTheme();
  return <View style={[stylesBase.tile, { borderColor: letter ? colors.secondaryText : colors.border }, state === 'correct' ? stylesBase.correct : state === 'present' ? stylesBase.present : state === 'absent' ? stylesBase.absent : null]}><Text style={[stylesBase.tileLetter, { color: state ? '#ffffff' : colors.text }]}>{letter}</Text></View>;
}

type WordKeyProps = { letter: string; state?: WordleLetterState; disabled: boolean; onPress: () => void };
function WordKey({ letter, state, disabled, onPress }: WordKeyProps) {
  const isWide = letter === 'ENTER' || letter === 'BACK';
  return <AnimatedActionButton disabled={disabled} onPress={onPress} accessibilityLabel={letter === 'BACK' ? 'Delete letter' : letter} pressScale={0.86} style={[stylesBase.key, isWide && stylesBase.wideKey, state === 'correct' ? stylesBase.correct : state === 'present' ? stylesBase.present : state === 'absent' ? stylesBase.absent : null, disabled && stylesBase.keyDisabled]}>{letter === 'BACK' ? <Delete size={19} color="#ffffff" /> : <Text style={stylesBase.keyText}>{letter}</Text>}</AnimatedActionButton>;
}

type HelpModalProps = { visible: boolean; onClose: () => void };
function HelpModal({ visible, onClose }: HelpModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose}><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.modalBackdrop}><ModalMotionSurface variant="dialog" style={styles.modalCard}><View style={styles.modalHeader}><Text style={styles.modalTitle}>How to play</Text><AnimatedActionButton onPress={onClose} accessibilityLabel="Close instructions"><X size={23} color={colors.icon} /></AnimatedActionButton></View><Text style={styles.modalBody}>Guess the five-letter Trini word in six tries. Each guess must be a valid word.</Text><ExampleRow word="TRINI" states={['correct', 'absent', 'absent', 'absent', 'absent']} label="T is in the word and in the correct spot." /><ExampleRow word="SWEET" states={['absent', 'present', 'absent', 'absent', 'absent']} label="W is in the word but in another spot." /><ExampleRow word="MOUTH" states={['absent', 'absent', 'absent', 'absent', 'absent']} label="These letters are not in the word." /><AnimatedActionButton onPress={onClose} style={styles.primaryButton} accessibilityLabel="Play Wordle"><Text style={styles.primaryButtonText}>Play</Text></AnimatedActionButton></ModalMotionSurface></SafeAreaView></Modal>;
}

type ExampleRowProps = { word: string; states: WordleLetterState[]; label: string };
function ExampleRow({ word, states, label }: ExampleRowProps) {
  const { colors } = useAppTheme();
  return <View style={{ marginTop: 16 }}><View style={stylesBase.exampleRow}>{word.split('').map((letter, index) => <WordTile key={index} letter={letter} state={states[index]} />)}</View><Text style={{ color: colors.secondaryText, fontSize: 12, marginTop: 7 }}>{label}</Text></View>;
}

type ResultModalProps = { visible: boolean; won: boolean; targetWord: string; guesses: number; onClose: () => void; onReset: () => void };
function ResultModal({ visible, won, targetWord, guesses, onClose, onReset }: ResultModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose}><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.modalBackdrop}><ModalMotionSurface variant="dialog" style={styles.modalCard}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{won ? 'Sweet hand!' : 'Good try'}</Text><AnimatedActionButton onPress={onClose} accessibilityLabel="Close game result"><X size={23} color={colors.icon} /></AnimatedActionButton></View><Text style={styles.resultWord}>{targetWord}</Text><Text style={styles.modalBody}>{won ? `Solved in ${guesses} ${guesses === 1 ? 'guess' : 'guesses'}.` : 'That was the Trini word this round.'}</Text><AnimatedActionButton onPress={onReset} feedback="success" accessibilityLabel="Start a new game" style={styles.primaryButton}><RotateCcw size={17} color="#ffffff" /><Text style={styles.primaryButtonText}>New Game</Text></AnimatedActionButton></ModalMotionSurface></SafeAreaView></Modal>;
}

const stylesBase = StyleSheet.create({
  grid: { alignSelf: 'center', gap: 5 },
  gridRow: { flexDirection: 'row', gap: 5 },
  tile: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#94a3b8', borderRadius: 5, backgroundColor: 'transparent' },
  tileLetter: { fontSize: 26, fontWeight: '900' },
  correct: { backgroundColor: '#10b981', borderColor: '#10b981' },
  present: { backgroundColor: '#d6a514', borderColor: '#d6a514' },
  absent: { backgroundColor: '#64748b', borderColor: '#64748b' },
  key: { flex: 1, minWidth: 27, height: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: '#94a3b8', paddingHorizontal: 2 },
  wideKey: { flex: 1.45 },
  keyDisabled: { opacity: 0.7 },
  keyText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
  exampleRow: { flexDirection: 'row', gap: 4 },
});

type ThemeColors = ReturnType<typeof useAppTheme>['colors'];
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { height: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12 },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: colors.icon, fontSize: 35, lineHeight: 36 },
  headerTitle: { flex: 1, color: colors.text, textAlign: 'center', fontSize: 20, fontWeight: '900', letterSpacing: 1.5 },
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 12 },
  messageSpace: { height: 43, alignItems: 'center', justifyContent: 'center' },
  message: { color: '#ffffff', backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 13, paddingVertical: 7, fontSize: 12, fontWeight: '900' },
  keyboard: { gap: 6, marginTop: 18 },
  keyboardRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  dictionaryLoading: { height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 7 },
  muted: { color: colors.mutedText, fontSize: 11 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(15,23,42,0.64)' },
  modalCard: { borderRadius: 22, backgroundColor: colors.surface, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  modalTitle: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '900' },
  modalBody: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  resultWord: { color: '#10b981', textAlign: 'center', fontSize: 36, fontWeight: '900', letterSpacing: 6, marginVertical: 15 },
  primaryButton: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 22, borderRadius: 14, backgroundColor: '#10b981' },
  primaryButtonText: { color: '#ffffff', fontWeight: '900' },
});
