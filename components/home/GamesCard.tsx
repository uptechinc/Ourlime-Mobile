import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { auth } from '@/lib/firebaseConfig';
import GameWebViewModal from './GameWebViewModal';

type GameItem = {
  gameId: string;
  name: string;
  thumbnailUrl: string;
  type: string;
  totalPlays: number;
  estimatedDuration: number;
};

const getTypeEmoji = (type: string): string => {
  switch (type) {
    case 'trivia':
    case 'quiz':    return '🧠';
    case 'puzzle':  return '🧩';
    case 'arcade':  return '🎮';
    case 'strategy':return '♟️';
    case 'action':  return '⚡';
    default:        return '🎯';
  }
};

export default function GamesCard() {
  const [games, setGames] = useState<GameItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeGame, setActiveGame] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const webApiBase = process.env.EXPO_PUBLIC_WEB_API_URL ?? '';
        if (!webApiBase) {
          setGames([]);
          return;
        }
        const response = await fetch(`${webApiBase}/api/home/LeftSection/games`, {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setGames((data.data?.games ?? []).slice(0, 4));
          }
        }
      } catch {
        setGames([]);
      } finally {
        setIsLoading(false);
      }
    };
    void fetchGames();
  }, []);

  // Don't render if API base not configured and no games
  if (!isLoading && games.length === 0) return null;

  return (
    <View style={{
      marginBottom: 16,
      backgroundColor: '#ffffff',
      borderRadius: 20,
      padding: 16,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 6,
      elevation: 2,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: isCollapsed ? 0 : 14 }}>
        <TouchableOpacity
          onPress={() => setIsCollapsed(c => !c)}
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
          activeOpacity={0.7}
        >
          <View style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: '#fef9c3',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 10,
          }}>
            <Text style={{ fontSize: 16 }}>🎮</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }}>Games</Text>
          <Icon name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={16} color="#9ca3af" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveGame({ id: 'all', name: 'Games' })}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#10b981' }}>See All</Text>
        </TouchableOpacity>
      </View>

      {!isCollapsed && (
        isLoading ? (
          <View style={{ gap: 10 }}>
            {[1, 2].map(i => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: '#f1f5f9' }} />
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={{ width: '60%', height: 14, borderRadius: 6, backgroundColor: '#f1f5f9' }} />
                  <View style={{ width: '40%', height: 12, borderRadius: 6, backgroundColor: '#f1f5f9' }} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {games.map(game => (
              <TouchableOpacity
                key={game.gameId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 10,
                  borderRadius: 14,
                  backgroundColor: '#f8fafc',
                  borderWidth: 1,
                  borderColor: '#f1f5f9',
                }}
                onPress={() => setActiveGame({ id: game.gameId, name: game.name })}
                activeOpacity={0.75}
              >
                {/* Thumbnail */}
                {game.thumbnailUrl ? (
                  <Image
                    source={{ uri: game.thumbnailUrl }}
                    style={{ width: 56, height: 56, borderRadius: 12, marginRight: 12 }}
                  />
                ) : (
                  <View style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    backgroundColor: '#d1fae5',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 26 }}>{getTypeEmoji(game.type)}</Text>
                  </View>
                )}

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#111827' }} numberOfLines={1}>
                    {game.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {getTypeEmoji(game.type)} {game.type}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                    <Icon name="trending-up" size={11} color="#9ca3af" />
                    <Text style={{ fontSize: 11, color: '#9ca3af' }}>
                      {game.totalPlays.toLocaleString()} plays
                    </Text>
                  </View>
                </View>

                {/* Play button */}
                <TouchableOpacity
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: '#10b981',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                  onPress={() => setActiveGame({ id: game.gameId, name: game.name })}
                >
                  <Icon name="play" size={14} color="#ffffff" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )
      )}

      {/* ── Game WebView Modal ── */}
      {activeGame && (
        <GameWebViewModal
          gameId={activeGame.id}
          gameName={activeGame.name}
          isVisible={true}
          onClose={() => setActiveGame(null)}
        />
      )}
    </View>
  );
}
