export type WordleLetterState = 'correct' | 'present' | 'absent';
export type WordleGuess = { word: string; states: WordleLetterState[] };

const ANSWER_WORDS = [
  'MAMAG', 'LICKS', 'FELLA', 'CHUPS', 'SWEET', 'MOUTH', 'BUNJI', 'JAMET', 'ZESSY', 'BLIGH',
  'GYALZ', 'NANNY', 'CHUNE', 'WASSI', 'FRAID', 'BOKEY', 'DUNCE', 'DOUEN', 'JORTS', 'KUYOH',
  'LIPAY', 'MACCO', 'MALJO', 'RINGS', 'SHIMS', 'PEONG', 'ALYUH', 'TRINI', 'TOTIN', 'FADDA',
  'BREDS', 'BRACE', 'ACCRA', 'PADNA', 'FLAMZ', 'CHOOK', 'SOUSE', 'BRONG', 'QUENK', 'DROPS',
  'TANTY', 'OBEAH',
] as const;

const TRINI_GUESSES = new Set<string>([...ANSWER_WORDS, 'LIMIN']);

export class WordleService {
  private static instance: WordleService;
  private validWordsPromise: Promise<Set<string>> | null = null;

  private constructor() {}

  public static getInstance(): WordleService {
    if (!WordleService.instance) WordleService.instance = new WordleService();
    return WordleService.instance;
  }

  public createTargetWord(): string {
    return ANSWER_WORDS[Math.floor(Math.random() * ANSWER_WORDS.length)];
  }

  public async isValidGuess(word: string): Promise<boolean> {
    const normalizedWord = word.toUpperCase();
    if (!/^[A-Z]{5}$/.test(normalizedWord)) return false;
    if (TRINI_GUESSES.has(normalizedWord)) return true;
    const validWords = await this.getValidWords();
    return validWords.has(normalizedWord);
  }

  public checkGuess(guess: string, targetWord: string): WordleGuess {
    const normalizedGuess = guess.toUpperCase();
    const normalizedTarget = targetWord.toUpperCase();
    const states: WordleLetterState[] = Array.from({ length: normalizedGuess.length }, () => 'absent');
    const remainingLetterCounts = new Map<string, number>();

    normalizedTarget.split('').forEach((letter) => {
      remainingLetterCounts.set(letter, (remainingLetterCounts.get(letter) ?? 0) + 1);
    });
    normalizedGuess.split('').forEach((letter, index) => {
      if (letter !== normalizedTarget[index]) return;
      states[index] = 'correct';
      remainingLetterCounts.set(letter, (remainingLetterCounts.get(letter) ?? 1) - 1);
    });
    normalizedGuess.split('').forEach((letter, index) => {
      if (states[index] === 'correct') return;
      const remainingCount = remainingLetterCounts.get(letter) ?? 0;
      if (remainingCount <= 0) return;
      states[index] = 'present';
      remainingLetterCounts.set(letter, remainingCount - 1);
    });
    return { word: normalizedGuess, states };
  }

  public mergeKeyboardState(currentStates: Map<string, WordleLetterState>, guess: WordleGuess): Map<string, WordleLetterState> {
    const nextStates = new Map(currentStates);
    guess.word.split('').forEach((letter, index) => {
      const nextState = guess.states[index];
      const currentState = nextStates.get(letter);
      if (nextState === 'correct' || (nextState === 'present' && currentState !== 'correct') || !currentState) {
        nextStates.set(letter, nextState);
      }
    });
    return nextStates;
  }

  private getValidWords(): Promise<Set<string>> {
    if (!this.validWordsPromise) {
      this.validWordsPromise = import('an-array-of-english-words').then(({ default: words }) => {
        const fiveLetterWords = new Set<string>(TRINI_GUESSES);
        words.forEach((word) => {
          if (word.length === 5 && /^[a-zA-Z]+$/.test(word)) fiveLetterWords.add(word.toUpperCase());
        });
        return fiveLetterWords;
      });
    }
    return this.validWordsPromise;
  }
}

export const wordleService = WordleService.getInstance();
