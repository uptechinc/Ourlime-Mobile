import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebaseConfig';
import { DEFAULT_LOCATIONS } from '@/lib/games/geoGuesserDefaultLocations';

export type GeoDifficulty = 'easy' | 'medium' | 'hard';
export type GeoCoordinates = { lat: number; lng: number };
export type GeoLocation = { id: string; name: string; info: string; hint?: string; imageUrl: string; coordinates: GeoCoordinates };
export type GeoLeaderboardEntry = { rank: number; userId: string | null; username: string; avatarUrl: string | null; score: number };
export type GeoRoundScore = { earned: number; nextStreak: number; isStreakBonus: boolean };
export type GeoPlayerCount = { count: number; isAtLeast: boolean };

type GameApiRequest =
  | { action: 'locations'; mode: GeoDifficulty }
  | { action: 'leaderboard'; mode: GeoDifficulty }
  | { action: 'save_score'; mode: GeoDifficulty; score: number }
  | { action: 'players' };

// The website's rules (app/triniGeoGuesser/game): 10 rounds, one timer for the whole game, points by distance.
export const GEO_TOTAL_ROUNDS = 10;
export const GEO_TIMER_SECONDS: Record<GeoDifficulty, number> = { easy: 300, medium: 180, hard: 120 };
export const GEO_DIFFICULTIES: GeoDifficulty[] = ['easy', 'medium', 'hard'];
/** Unlocking the easy-mode hint or skipping a round costs a point (never below zero). */
export const GEO_PENALTY_POINTS = 1;
/** Every third scoring round in a row earns this many extra points. */
export const GEO_STREAK_BONUS_POINTS = 2;
const LEADERBOARD_PAGE_SIZE = 50;
const SCORE_THRESHOLDS_KM: Record<GeoDifficulty, { perfect: number; good: number; ok: number }> = {
  easy: { perfect: 1.0, good: 3.0, ok: 5.0 },
  medium: { perfect: 0.5, good: 1.5, ok: 2.5 },
  hard: { perfect: 0.2, good: 0.5, ok: 1.0 },
};

/** Trini GeoGuesser through the gameApi callable (locations and scores are closed to clients). */
export class GeoGuesserService {
  private static instance: GeoGuesserService;
  private constructor() {}

  public static getInstance(): GeoGuesserService {
    if (!GeoGuesserService.instance) GeoGuesserService.instance = new GeoGuesserService();
    return GeoGuesserService.instance;
  }

  /** A level's places; the website's curated list when Firestore has none for the level. */
  public async getLocations(mode: GeoDifficulty): Promise<GeoLocation[]> {
    const result = await this.call<{ locations: GeoLocation[] }>({ action: 'locations', mode });
    const locations = Array.isArray(result.locations) ? result.locations : [];
    return locations.length > 0 ? locations : DEFAULT_LOCATIONS[mode];
  }

  public async getLeaderboard(mode: GeoDifficulty): Promise<GeoLeaderboardEntry[]> {
    const result = await this.call<{ leaders: GeoLeaderboardEntry[] }>({ action: 'leaderboard', mode });
    return Array.isArray(result.leaders) ? result.leaders : [];
  }

  /**
   * Players ranked across all three levels (the website's unique leaderboard player count), from the gameApi
   * "players" action. If that fails, it is estimated from each level's top 50, so a full board reads as "at least".
   */
  public async getLeaderboardPlayerCount(): Promise<GeoPlayerCount> {
    try {
      const result = await this.call<{ count: number }>({ action: 'players' });
      if (typeof result.count === 'number' && Number.isFinite(result.count)) return { count: result.count, isAtLeast: false };
    } catch (error: unknown) {
      console.warn('[GeoGuesserService.getLeaderboardPlayerCount] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
    const boards = await Promise.all(GEO_DIFFICULTIES.map((mode) => this.getLeaderboard(mode)));
    const players = new Set<string>();
    boards.flat().forEach((entry) => players.add(entry.userId ?? `name:${entry.username.trim().toLowerCase()}`));
    return { count: players.size, isAtLeast: boards.some((board) => board.length >= LEADERBOARD_PAGE_SIZE) };
  }

  /** Personal best on this device (the website keeps it in localStorage under the same key). */
  public async getBestScore(mode: GeoDifficulty): Promise<number> {
    try {
      const stored = Number.parseInt((await AsyncStorage.getItem(`trini_best_${mode}`)) ?? '0', 10);
      return Number.isFinite(stored) ? stored : 0;
    } catch (error: unknown) {
      console.warn('[GeoGuesserService.getBestScore] Error:', error instanceof Error ? error.message : 'Unknown error');
      return 0;
    }
  }

  public async setBestScore(mode: GeoDifficulty, score: number): Promise<void> {
    try {
      await AsyncStorage.setItem(`trini_best_${mode}`, String(score));
    } catch (error: unknown) {
      console.warn('[GeoGuesserService.setBestScore] Error:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /** Points for a confirmed guess plus the website's streak rule: every third scoring round in a row adds a bonus. */
  public scoreRound(points: number, streak: number): GeoRoundScore {
    if (points <= 0) return { earned: 0, nextStreak: 0, isStreakBonus: false };
    const nextStreak = streak + 1;
    const isStreakBonus = nextStreak % 3 === 0;
    return { earned: points + (isStreakBonus ? GEO_STREAK_BONUS_POINTS : 0), nextStreak, isStreakBonus };
  }

  /** Saves the signed-in player's score; the server keeps only their best. */
  public async saveScore(mode: GeoDifficulty, score: number): Promise<void> {
    await this.call({ action: 'save_score', mode, score });
  }

  /** Up to GEO_TOTAL_ROUNDS locations in random order; a level with fewer locations repeats them. */
  public pickRounds(locations: GeoLocation[]): GeoLocation[] {
    if (locations.length === 0) return [];
    const shuffled = [...locations].sort(() => Math.random() - 0.5);
    return Array.from({ length: GEO_TOTAL_ROUNDS }, (_, index) => shuffled[index % shuffled.length]);
  }

  public distanceKm(from: GeoCoordinates, to: GeoCoordinates): number {
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    const latitudeDelta = radians(to.lat - from.lat);
    const longitudeDelta = radians(to.lng - from.lng);
    const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(longitudeDelta / 2) ** 2;
    return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
  }

  public points(distanceKm: number, mode: GeoDifficulty): number {
    const thresholds = SCORE_THRESHOLDS_KM[mode];
    if (distanceKm <= thresholds.perfect) return 5;
    if (distanceKm <= thresholds.good) return 3;
    if (distanceKm <= thresholds.ok) return 1;
    return 0;
  }

  private async call<Result>(request: GameApiRequest): Promise<Result> {
    const result = await httpsCallable<GameApiRequest, Result>(getFunctions(app), 'gameApi')(request);
    return result.data;
  }
}

export const geoGuesserService = GeoGuesserService.getInstance();
