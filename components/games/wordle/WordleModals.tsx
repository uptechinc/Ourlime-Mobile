import { useMemo, useState, type ReactNode } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RotateCcw, Search, X } from 'lucide-react-native';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { ModalMotionSurface } from '@/components/ui/ModalMotion';
import { useAppTheme, type AppThemeColors } from '@/lib/contexts/ThemeContext';
import { wordleService, type WordleGuess, type WordleLetterState } from '@/lib/services/WordleService';
import { WordTile } from '@/components/games/wordle/WordleTiles';

type WordleDialogProps = { visible: boolean; title: string; onClose: () => void; children: ReactNode; titleColor?: string };

/** Shared centred dialog for the Wordle help, hint, dictionary and game-over panels. */
function WordleDialog({ visible, title, onClose, children, titleColor }: WordleDialogProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.backdrop}>
        <KeyboardSafeView style={styles.backdropInner}>
          <ModalMotionSurface variant="dialog" style={styles.card}>
            <View style={styles.header}>
              <Text style={[styles.title, titleColor ? { color: titleColor } : null]}>{title}</Text>
              <AnimatedActionButton onPress={onClose} accessibilityLabel="Close" style={styles.closeButton}><X size={22} color={colors.icon} /></AnimatedActionButton>
            </View>
            {children}
          </ModalMotionSurface>
        </KeyboardSafeView>
      </SafeAreaView>
    </Modal>
  );
}

type HelpModalProps = { visible: boolean; onClose: () => void };

export function WordleHelpModal({ visible, onClose }: HelpModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <WordleDialog visible={visible} title="How to Play Trini Wordle" onClose={onClose}>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.body}>Guess the <Text style={styles.strong}>TRINI WORD</Text> in 6 tries!</Text>
        <Text style={styles.body}>Each guess must be a valid 5-letter word. Press de enter button to submit yuh guess.</Text>
        <Text style={styles.body}>After each guess, the color of the tiles will change to show how close you were to the word.</Text>
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Examples</Text>
        <ExampleRow word="LIMBO" markedIndex={0} state="correct" label="The letter L is in the word and in the correct spot." />
        <ExampleRow word="CHUNE" markedIndex={1} state="present" label="The letter H is in the word but in the wrong spot." />
        <ExampleRow word="BREAD" markedIndex={3} state="absent" label="The letter A is not in the word at all." />
        <View style={styles.divider} />
        <Text style={styles.body}><Text style={styles.strong}>Note:</Text> The words include real Trini expressions and slang - so come play ah lil game nah!</Text>
      </ScrollView>
      <AnimatedActionButton onPress={onClose} style={styles.primaryButton} accessibilityLabel="Start playing"><Text style={styles.primaryButtonText}>Leh we play! 🎉</Text></AnimatedActionButton>
    </WordleDialog>
  );
}

type ExampleRowProps = { word: string; markedIndex: number; state: WordleLetterState; label: string };

function ExampleRow({ word, markedIndex, state, label }: ExampleRowProps) {
  const { colors } = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {word.split('').map((letter, index) => <WordTile key={index} letter={letter} state={index === markedIndex ? state : undefined} size={38} />)}
      </View>
      <Text style={{ color: colors.secondaryText, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

type DefinitionBoxProps = { definition: string };

function DefinitionBox({ definition }: DefinitionBoxProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.definitionBox}>
      <Text style={styles.definitionLabel}>What it mean:</Text>
      <Text style={styles.definitionText}>{definition}</Text>
    </View>
  );
}

type HintModalProps = { visible: boolean; onClose: () => void; targetWord: string; revealedLetterIndices: number[]; hintsRemaining: number; onRevealLetter: () => void };

export function WordleHintModal({ visible, onClose, targetWord, revealedLetterIndices, hintsRemaining, onRevealLetter }: HintModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const definition = wordleService.getDefinition(targetWord);
  return (
    <WordleDialog visible={visible} title="Yuh dey need a hint?" onClose={onClose}>
      <Text style={styles.body}>Let Limey help yuh out, nah.</Text>
      {definition ? <DefinitionBox definition={definition} /> : null}
      <View style={styles.hintTiles}>
        {targetWord.split('').map((letter, index) => {
          const isRevealed = revealedLetterIndices.includes(index);
          return (
            <View key={index} style={[styles.hintTile, isRevealed && styles.hintTileRevealed]}>
              <Text style={[styles.hintTileText, isRevealed && styles.hintTileTextRevealed]}>{isRevealed ? letter : '?'}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.body, styles.centered]}>Hints remaining: <Text style={styles.strong}>{hintsRemaining}</Text></Text>
      <AnimatedActionButton onPress={onRevealLetter} disabled={hintsRemaining <= 0} style={[styles.primaryButton, hintsRemaining <= 0 && styles.disabled]} accessibilityLabel="Reveal a letter">
        <Text style={styles.primaryButtonText}>Reveal a Letter</Text>
      </AnimatedActionButton>
    </WordleDialog>
  );
}

type DictionaryModalProps = { visible: boolean; onClose: () => void; guesses: WordleGuess[] };

export function WordleDictionaryModal({ visible, onClose, guesses }: DictionaryModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [searchQuery, setSearchQuery] = useState('');
  const possibleAnswers = useMemo(() => wordleService.filterPossibleAnswers(guesses), [guesses]);
  const possibleSet = useMemo(() => new Set(possibleAnswers), [possibleAnswers]);
  const normalizedQuery = searchQuery.trim().toUpperCase();
  const matchesQuery = (word: string): boolean => normalizedQuery.length === 0 || word.includes(normalizedQuery);
  const filteredPossible = possibleAnswers.filter(matchesQuery);
  const filteredAll = [...wordleService.getAnswerWords()].sort().filter(matchesQuery);

  const renderWords = (words: string[]) => words.length === 0
    ? <Text style={styles.emptyNote}>Nuh words match de search, chile. Try something else.</Text>
    : (
      <View style={styles.wordGrid}>
        {words.map((word) => {
          const definition = wordleService.getDefinition(word);
          return (
            <View key={word} style={[styles.wordCard, possibleSet.has(word) && styles.wordCardPossible]}>
              <Text style={styles.wordText}>{word}</Text>
              <Text style={[styles.wordDefinition, !definition && styles.noDefinition]}>{definition ?? 'No definition yet'}</Text>
            </View>
          );
        })}
      </View>
    );

  return (
    <WordleDialog visible={visible} title="De Dictionary" onClose={onClose}>
      <Text style={styles.body}>Possible answers remaining: <Text style={styles.strong}>{possibleAnswers.length}</Text></Text>
      <View style={styles.searchBox}>
        <Search size={16} color={colors.mutedText} />
        <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Search de words..." placeholderTextColor={colors.mutedText} autoCapitalize="characters" autoCorrect={false} style={styles.searchInput} accessibilityLabel="Search dictionary" />
      </View>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Still possible</Text>
        {renderWords(filteredPossible)}
        <Text style={styles.sectionTitle}>Full dictionary of possible answers</Text>
        {renderWords(filteredAll)}
      </ScrollView>
    </WordleDialog>
  );
}

type GameOverModalProps = { visible: boolean; won: boolean; word: string; guesses: number; onClose: () => void; onNewGame: () => void };

export function WordleGameOverModal({ visible, won, word, guesses, onClose, onNewGame }: GameOverModalProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const definition = wordleService.getDefinition(word);
  return (
    <WordleDialog visible={visible} title={won ? 'Congratulations!' : 'Game Over!'} titleColor={won ? '#10b981' : colors.destructiveText} onClose={onClose}>
      {won ? (
        <>
          <Text style={styles.celebration}>{wordleService.getWinMessage(guesses)}</Text>
          <Text style={[styles.body, styles.centered]}>You guessed the word in <Text style={styles.strong}>{guesses}</Text> {guesses === 1 ? 'try' : 'tries'}!</Text>
        </>
      ) : (
        <>
          <Text style={styles.celebration}>No worries nah! Try again tomorrow - yuh go get it! 💪</Text>
          <Text style={[styles.body, styles.centered]}>De word was:</Text>
          <View style={styles.hintTiles}>
            {word.split('').map((letter, index) => <WordTile key={index} letter={letter} state="correct" size={44} />)}
          </View>
        </>
      )}
      {definition ? <DefinitionBox definition={definition} /> : null}
      <View style={styles.divider} />
      <AnimatedActionButton onPress={onNewGame} feedback="success" accessibilityLabel="Play again" style={styles.primaryButton}>
        <RotateCcw size={17} color="#ffffff" />
        <Text style={styles.primaryButtonText}>Play Again</Text>
      </AnimatedActionButton>
    </WordleDialog>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.64)' },
  backdropInner: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { maxHeight: '100%', width: '100%', maxWidth: 520, alignSelf: 'center', borderRadius: 22, backgroundColor: colors.surface, padding: 20, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: colors.text, fontSize: 21, fontWeight: '900' },
  closeButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scrollArea: { flexGrow: 0, flexShrink: 1 },
  scrollContent: { gap: 12, paddingBottom: 4 },
  body: { color: colors.secondaryText, fontSize: 14, lineHeight: 21 },
  strong: { color: colors.text, fontWeight: '900' },
  centered: { textAlign: 'center' },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '900', marginTop: 4 },
  divider: { height: 1, backgroundColor: colors.border },
  celebration: { color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center', lineHeight: 23 },
  definitionBox: { padding: 12, gap: 4, borderRadius: 14, backgroundColor: colors.successSurface },
  definitionLabel: { color: colors.successText, fontSize: 12, fontWeight: '900' },
  definitionText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  hintTiles: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  hintTile: { width: 44, height: 44, borderRadius: 8, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  hintTileRevealed: { borderColor: '#10b981', backgroundColor: '#10b981' },
  hintTileText: { color: colors.mutedText, fontSize: 20, fontWeight: '900' },
  hintTileTextRevealed: { color: '#ffffff' },
  searchBox: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.control },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 8 },
  wordGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  wordCard: { width: '48%', flexGrow: 1, padding: 10, gap: 3, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  wordCardPossible: { borderColor: '#10b981', backgroundColor: colors.successSurface },
  wordText: { color: colors.text, fontSize: 15, fontWeight: '900', letterSpacing: 1.5 },
  wordDefinition: { color: colors.secondaryText, fontSize: 12, lineHeight: 17 },
  noDefinition: { fontStyle: 'italic', color: colors.mutedText },
  emptyNote: { color: colors.mutedText, fontSize: 13, fontStyle: 'italic' },
  primaryButton: { minHeight: 47, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, backgroundColor: '#10b981' },
  primaryButtonText: { color: '#ffffff', fontWeight: '900' },
  disabled: { opacity: 0.5 },
});
