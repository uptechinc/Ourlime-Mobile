import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Delete } from 'lucide-react-native';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { WORDLE_MAX_GUESSES, WORDLE_WORD_LENGTH, type WordleGuess, type WordleLetterState } from '@/lib/services/WordleService';

export const WORDLE_KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACK'],
];

export const WORDLE_COLORS = { correct: '#10b981', present: '#d6a514', absent: '#64748b' } as const;

type WordGridProps = { guesses: WordleGuess[]; currentGuess: string; shake: boolean; tileSize: number };

/** Six rows of five tiles; the row being typed shakes when a guess is rejected. */
export function WordGrid({ guesses, currentGuess, shake, tileSize }: WordGridProps) {
  const shakeOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!shake) return;
    Animated.sequence([10, -10, 8, -8, 4, 0].map((toValue) => Animated.timing(shakeOffset, { toValue, duration: 60, useNativeDriver: true }))).start();
  }, [shake, shakeOffset]);

  return (
    <View style={styles.grid}>
      {Array.from({ length: WORDLE_MAX_GUESSES }, (_, rowIndex) => {
        const submittedGuess = guesses[rowIndex];
        const isCurrentRow = rowIndex === guesses.length;
        const rowWord = submittedGuess?.word ?? (isCurrentRow ? currentGuess : '');
        return (
          <Animated.View key={rowIndex} style={[styles.gridRow, isCurrentRow && { transform: [{ translateX: shakeOffset }] }]}>
            {Array.from({ length: WORDLE_WORD_LENGTH }, (_, columnIndex) => (
              <WordTile key={columnIndex} letter={rowWord[columnIndex] ?? ''} state={submittedGuess?.states[columnIndex]} size={tileSize} />
            ))}
          </Animated.View>
        );
      })}
    </View>
  );
}

type WordTileProps = { letter: string; state?: WordleLetterState; size?: number };

export function WordTile({ letter, state, size = 50 }: WordTileProps) {
  const { colors } = useAppTheme();
  const filledColor = state ? WORDLE_COLORS[state] : null;
  return (
    <View style={[styles.tile, { width: size, height: size, borderColor: filledColor ?? (letter ? colors.secondaryText : colors.border) }, filledColor ? { backgroundColor: filledColor } : null]}>
      <Text style={[styles.tileLetter, { fontSize: Math.round(size * 0.5), color: state ? '#ffffff' : colors.text }]}>{letter}</Text>
    </View>
  );
}

type WordKeyboardProps = { letterStates: Map<string, WordleLetterState>; disabled: boolean; onKeyPress: (key: string) => void };

export function WordKeyboard({ letterStates, disabled, onKeyPress }: WordKeyboardProps) {
  return (
    <View style={styles.keyboard}>
      {WORDLE_KEYBOARD_ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.keyboardRow}>
          {row.map((key) => <WordKey key={key} letter={key} state={letterStates.get(key)} disabled={disabled} onPress={() => onKeyPress(key)} />)}
        </View>
      ))}
    </View>
  );
}

type WordKeyProps = { letter: string; state?: WordleLetterState; disabled: boolean; onPress: () => void };

function WordKey({ letter, state, disabled, onPress }: WordKeyProps) {
  const isWide = letter === 'ENTER' || letter === 'BACK';
  return (
    <AnimatedActionButton
      disabled={disabled}
      onPress={onPress}
      accessibilityLabel={letter === 'BACK' ? 'Delete letter' : letter}
      pressScale={0.86}
      style={[styles.key, isWide && styles.wideKey, state ? { backgroundColor: WORDLE_COLORS[state] } : null, disabled && styles.keyDisabled]}
    >
      {letter === 'BACK' ? <Delete size={19} color="#ffffff" /> : <Text style={styles.keyText}>{letter}</Text>}
    </AnimatedActionButton>
  );
}

const styles = StyleSheet.create({
  grid: { alignSelf: 'center', gap: 5 },
  gridRow: { flexDirection: 'row', gap: 5 },
  tile: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: 6, backgroundColor: 'transparent' },
  tileLetter: { fontWeight: '900' },
  keyboard: { gap: 6 },
  keyboardRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  key: { flex: 1, minWidth: 27, height: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: '#94a3b8', paddingHorizontal: 2 },
  wideKey: { flex: 1.45 },
  keyDisabled: { opacity: 0.7 },
  keyText: { color: '#ffffff', fontSize: 12, fontWeight: '900' },
});
