import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebaseConfig';

export type GeoDifficulty = 'easy' | 'medium' | 'hard';
export type GeoCoordinates = { lat: number; lng: number };
export type GeoLocation = { id: string; name: string; info: string; hint?: string; imageUrl: string; coordinates: GeoCoordinates };
export type GeoLeaderboardEntry = { rank: number; userId: string | null; username: string; avatarUrl: string | null; score: number };

type GameApiRequest =
  | { action: 'locations'; mode: GeoDifficulty }
  | { action: 'leaderboard'; mode: GeoDifficulty }
  | { action: 'save_score'; mode: GeoDifficulty; score: number };

// The website's rules (app/triniGeoGuesser/game): 10 rounds, one timer for the whole game, points by distance.
export const GEO_TOTAL_ROUNDS = 10;
export const GEO_TIMER_SECONDS: Record<GeoDifficulty, number> = { easy: 300, medium: 180, hard: 120 };
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

  public async getLocations(mode: GeoDifficulty): Promise<GeoLocation[]> {
    const result = await this.call<{ locations: GeoLocation[] }>({ action: 'locations', mode });
    return Array.isArray(result.locations) ? result.locations : [];
  }

  public async getLeaderboard(mode: GeoDifficulty): Promise<GeoLeaderboardEntry[]> {
    const result = await this.call<{ leaders: GeoLeaderboardEntry[] }>({ action: 'leaderboard', mode });
    return Array.isArray(result.leaders) ? result.leaders : [];
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
