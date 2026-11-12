import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { DEFAULT_WORDLE_DEFINITIONS } from '@/lib/games/wordleWords';

export type WordleLetterState = 'correct' | 'present' | 'absent';
export type WordleGuess = { word: string; states: WordleLetterState[] };
export type WordleWord = { word: string; definition: string };

// Same limits and messages as the website (utils/constants.ts).
export const WORDLE_WORD_LENGTH = 5;
export const WORDLE_MAX_GUESSES = 6;
export const WORDLE_MAX_HINTS = 3;

const DEFAULT_WORDS: WordleWord[] = Object.keys(DEFAULT_WORDLE_DEFINITIONS).map((word) => ({ word, definition: DEFAULT_WORDLE_DEFINITIONS[word] }));
const EXTRA_GUESSES = ['LIMIN'];

/** Trini Wordle: the answer list (admin-managed in triniWordleWords, like the website), guess checks and the solver. */
export class WordleService {
  private static instance: WordleService;
  private validWordsPromise: Promise<Set<string>> | null = null;
  private words: WordleWord[] = DEFAULT_WORDS;
  private definitions = new Map<string, string>(DEFAULT_WORDS.map((entry) => [entry.word, entry.definition]));
  private wordsPromise: Promise<WordleWord[]> | null = null;

  private constructor() {}

  public static getInstance(): WordleService {
    if (!WordleService.instance) WordleService.instance = new WordleService();
    return WordleService.instance;
  }

  /**
   * The enabled words from triniWordleWords (the website's /api/wordle/words). Falls back to the built-in list when
   * there are none or the collection can't be read.
   */
  public loadWords(): Promise<WordleWord[]> {
    if (!this.wordsPromise) {
      this.wordsPromise = getDocs(query(collection(db, 'triniWordleWords'), where('enabled', '==', true)))
        .then((snapshot) => {
          const managedWords = snapshot.docs
            .map((document) => {
              const data = document.data();
              return { word: String(data.word ?? '').trim().toUpperCase(), definition: String(data.definition ?? '').trim() };
            })
            .filter((entry) => /^[A-Z]{5}$/.test(entry.word));
          if (managedWords.length > 0) {
            this.words = managedWords;
            managedWords.forEach((entry) => { if (entry.definition) this.definitions.set(entry.word, entry.definition); });
          }
          return this.words;
        })
        .catch((error: unknown) => {
          console.warn('[WordleService.loadWords] Error:', error instanceof Error ? error.message : 'Unable to load managed words');
          this.wordsPromise = null;
          return this.words;
        });
    }
    return this.wordsPromise;
  }

  public getAnswerWords(): string[] {
    return this.words.map((entry) => entry.word);
  }

  public getDefinition(word: string): string | undefined {
    return this.definitions.get(word.toUpperCase()) || undefined;
  }

  public createTargetWord(): string {
    return this.words[Math.floor(Math.random() * this.words.length)].word;
  }

  public async isValidGuess(word: string): Promise<boolean> {
    const normalizedWord = word.toUpperCase();
    if (!/^[A-Z]{5}$/.test(normalizedWord)) return false;
    if (this.words.some((entry) => entry.word === normalizedWord) || EXTRA_GUESSES.includes(normalizedWord)) return true;
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

  /** Answers still possible after these guesses (the website's utils/wordSolver.ts), sorted A–Z. */
  public filterPossibleAnswers(guesses: WordleGuess[]): string[] {
    const required: { letter: string; index: number }[] = [];
    const misplaced: { letter: string; index: number }[] = [];
    guesses.forEach((guess) => {
      guess.states.forEach((state, index) => {
        const letter = guess.word[index];
        if (state === 'correct') required.push({ letter, index });
        else if (state === 'present') misplaced.push({ letter, index });
      });
    });
    const presentOrCorrect = new Set<string>([...required, ...misplaced].map((entry) => entry.letter));
    const forbidden = new Set<string>();
    guesses.forEach((guess) => {
      guess.states.forEach((state, index) => {
        const letter = guess.word[index];
        if (state === 'absent' && !presentOrCorrect.has(letter)) forbidden.add(letter);
      });
    });
    return this.getAnswerWords().filter((word) => {
      for (const letter of forbidden) if (word.includes(letter)) return false;
      for (const { letter, index } of required) if (word[index] !== letter) return false;
      for (const { letter, index } of misplaced) if (word[index] === letter || !word.includes(letter)) return false;
      return true;
    }).sort();
  }

  /** The website's game-over line for a win in this many guesses. */
  public getWinMessage(guessCount: number): string {
    if (guessCount === 1) return 'Boss ting! Yuh get it in one shot! 🎯';
    if (guessCount === 2) return 'Wicked! Yuh real smart nah! 🧠';
    if (guessCount === 3) return 'Nice! Yuh know yuh Trini words good! 💪';
    if (guessCount === 4) return 'Good job! Yuh handle dat real nice! 👍';
    if (guessCount === 5) return 'Close one! But yuh make it! 😅';
    return 'Phew! Yuh just scrape through! 😮‍💨';
  }

  private getValidWords(): Promise<Set<string>> {
    if (!this.validWordsPromise) {
      this.validWordsPromise = import('an-array-of-english-words').then(({ default: words }) => {
        const fiveLetterWords = new Set<string>([...this.getAnswerWords(), ...EXTRA_GUESSES]);
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
