import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { geoGuesserService } from '@/lib/services/GeoGuesserService';

export type GameListItem = {
  gameId: string;
  name: string;
  thumbnailUrl: string;
  type: string;
  totalPlays: number;
  /** True when totalPlays is a lower bound (the GeoGuesser count comes from each level's top 50). */
  isPlaysAtLeast: boolean;
  /** App route for a playable game; null for listed games with no page yet (the website links them to a missing page). */
  route: string | null;
};

const BUILT_IN_GAMES: GameListItem[] = [
  { gameId: 'wordle', name: 'Trini Wordle', thumbnailUrl: '', type: 'puzzle', totalPlays: 0, isPlaysAtLeast: false, route: '/wordle-game' },
  { gameId: 'triniGeoGuesser', name: 'Trini GeoGuesser', thumbnailUrl: '', type: 'quiz', totalPlays: 0, isPlaysAtLeast: false, route: '/triniGeoGuesser' },
];

const readText = (value: unknown, fallback = ''): string => (typeof value === 'string' && value.trim() ? value.trim() : fallback);

/** The games hub list (the website's GamesService): built-in games first, then active games from Firestore. */
export class GamesService {
  private static instance: GamesService;
  private constructor() {}

  public static getInstance(): GamesService {
    if (!GamesService.instance) GamesService.instance = new GamesService();
    return GamesService.instance;
  }

  public getBuiltInGames(): GameListItem[] {
    return BUILT_IN_GAMES.map((game) => ({ ...game }));
  }

  public async fetchGames(): Promise<GameListItem[]> {
    const [firestoreGames, geoPlayers] = await Promise.all([
      getDocs(query(collection(db, 'games'), where('isActive', '==', true), orderBy('totalPlays', 'desc')))
        .then((snapshot) => snapshot.docs.map((document): GameListItem => {
          const data = document.data();
          return {
            gameId: readText(data.gameId, document.id),
            name: readText(data.name, 'Game'),
            thumbnailUrl: readText(data.thumbnailUrl),
            type: readText(data.type, 'game'),
            totalPlays: typeof data.totalPlays === 'number' ? data.totalPlays : 0,
            isPlaysAtLeast: false,
            route: null,
          };
        }))
        .catch((error: unknown) => {
          console.warn('[GamesService.fetchGames] Firestore games query error:', error instanceof Error ? error.message : 'Unknown error');
          return [] as GameListItem[];
        }),
      geoGuesserService.getLeaderboardPlayerCount().catch((error: unknown) => {
        console.warn('[GamesService.fetchGames] Player count error:', error instanceof Error ? error.message : 'Unknown error');
        return { count: 0, isAtLeast: false };
      }),
    ]);

    const games = this.getBuiltInGames().map((game) => (game.gameId === 'triniGeoGuesser' ? { ...game, totalPlays: geoPlayers.count, isPlaysAtLeast: geoPlayers.isAtLeast } : game));
    for (const game of firestoreGames) {
      const index = games.findIndex((existing) => existing.gameId === game.gameId);
      if (index >= 0) games[index] = { ...games[index], name: game.name, thumbnailUrl: game.thumbnailUrl || games[index].thumbnailUrl, type: game.type, totalPlays: Math.max(games[index].totalPlays, game.totalPlays) };
      else games.push(game);
    }
    return games;
  }

  /** The website's getTypeIcon. */
  public getTypeIcon(type: string): string {
    switch (type) {
      case 'geography': return '🗺️';
      case 'trivia':
      case 'quiz': return '🧠';
      case 'puzzle': return '🧩';
      case 'arcade': return '🎮';
      case 'strategy': return '♟️';
      case 'action': return '⚡';
      default: return '🎯';
    }
  }
}

export const gamesService = GamesService.getInstance();
