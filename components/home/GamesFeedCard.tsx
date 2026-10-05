import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { Gamepad2, Globe2, Puzzle, Users } from 'lucide-react-native';
import { db } from '@/lib/firebaseConfig';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import CachedImage from '@/components/ui/CachedImage';

type GameCardItem = { gameId: string; name: string; type: string; difficulty: string; totalPlays: number; thumbnailUrl: string };

// Built-in games (same list the website's GamesService adds to the Firestore games).
const BUILT_IN_GAMES: GameCardItem[] = [
  { gameId: 'wordle', name: 'Trini Wordle', type: 'puzzle', difficulty: 'medium', totalPlays: 0, thumbnailUrl: '' },
  { gameId: 'triniGeoGuesser', name: 'Trini GeoGuesser', type: 'quiz', difficulty: 'medium', totalPlays: 0, thumbnailUrl: '' },
];

const readText = (value: unknown, fallback = ''): string => (typeof value === 'string' && value.trim() ? value : fallback);

/** Mobile version of the website's left-column "Games" card, shown inside the feed. */
export default function GamesFeedCard() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [games, setGames] = useState<GameCardItem[]>(BUILT_IN_GAMES);

  useEffect(() => {
    let cancelled = false;
    void getDocs(query(collection(db, 'games'), where('isActive', '==', true), orderBy('totalPlays', 'desc')))
      .then((snapshot) => {
        if (cancelled) return;
        const extra = snapshot.docs.map((document): GameCardItem => {
          const data = document.data();
          return {
            gameId: readText(data.gameId, document.id),
            name: readText(data.name, 'Game'),
            type: readText(data.type, 'game'),
            difficulty: readText(data.difficulty, ''),
            totalPlays: typeof data.totalPlays === 'number' ? data.totalPlays : 0,
            thumbnailUrl: readText(data.thumbnailUrl),
          };
        }).filter((game) => !BUILT_IN_GAMES.some((builtIn) => builtIn.gameId === game.gameId));
        setGames([...BUILT_IN_GAMES, ...extra].slice(0, 4));
      })
      .catch((error: unknown) => {
        console.warn('[GamesFeedCard.load] Error:', error instanceof Error ? error.message : 'games unavailable');
      });
    return () => { cancelled = true; };
  }, []);

  const handleOpen = (game: GameCardItem): void => {
    const route: Href = game.gameId === 'wordle' ? '/wordle-game' : game.gameId === 'triniGeoGuesser' ? '/triniGeoGuesser' : '/games';
    router.push(route);
  };

  return (
    <View style={{ padding: 16, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Gamepad2 size={20} color={colors.accent} />
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '900' }}>Games</Text>
        </View>
      </View>
      {games.map((game) => {
        const TypeIcon = game.type === 'quiz' ? Globe2 : Puzzle;
        return (
          <TouchableOpacity key={game.gameId} onPress={() => handleOpen(game)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, backgroundColor: colors.control }}>
            {game.thumbnailUrl ? (
              <CachedImage uri={game.thumbnailUrl} style={{ width: 48, height: 48, borderRadius: 12 }} contentFit="cover" />
            ) : (
              <View style={{ width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface }}><TypeIcon size={22} color={colors.accent} /></View>
            )}
            <View style={{ flex: 1, gap: 3 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800' }}>{game.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: colors.accentText, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>{game.type}</Text>
                {game.difficulty ? <Text style={{ color: colors.mutedText, fontSize: 12, textTransform: 'capitalize' }}>{game.difficulty}</Text> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Users size={12} color={colors.mutedText} /><Text style={{ color: colors.mutedText, fontSize: 12 }}>{game.totalPlays.toLocaleString()}</Text></View>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
