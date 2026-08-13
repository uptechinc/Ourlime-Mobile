import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import UserAvatar from '@/components/ui/UserAvatar';
import { RelationshipService, type RelationshipUser } from '@/lib/services/RelationshipService';

type FriendsTabProps = {
  userId: string;
};

const relationshipService = RelationshipService.getInstance();

export default function FriendsTab({ userId }: FriendsTabProps) {
  const router = useRouter();
  const [friends, setFriends] = useState<RelationshipUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    setError(null);
    try {
      setFriends(await relationshipService.getFriends(userId));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Your friends could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    void loadFriends();
  }, [loadFriends]);

  const visibleFriends = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return friends;
    return friends.filter((friend) => `${friend.firstName} ${friend.lastName} ${friend.userName}`.toLowerCase().includes(term));
  }, [friends, search]);

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 16, backgroundColor: '#ffffff', paddingHorizontal: 13 }}>
        <Ionicons name="search-outline" size={18} color="#64748b" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search friends" placeholderTextColor="#94a3b8" style={{ flex: 1, color: '#0f172a', paddingVertical: 12 }} />
      </View>

      {loading ? (
        <View style={{ alignItems: 'center', paddingVertical: 28 }}><ActivityIndicator color="#10b981" /></View>
      ) : error ? (
        <View style={{ alignItems: 'center', padding: 20, borderRadius: 18, backgroundColor: '#ffffff' }}>
          <Text style={{ color: '#9f1239', textAlign: 'center', fontWeight: '700' }}>{error}</Text>
          <TouchableOpacity onPress={() => void loadFriends()} style={{ marginTop: 12, borderRadius: 14, backgroundColor: '#10b981', paddingHorizontal: 18, paddingVertical: 10 }}>
            <Text style={{ color: '#ffffff', fontWeight: '800' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : visibleFriends.length ? visibleFriends.map((friend) => {
        const displayName = `${friend.firstName} ${friend.lastName}`.trim() || friend.userName || 'Ourlime user';
        return (
          <TouchableOpacity
            key={friend.id}
            onPress={() => router.push({ pathname: '/profile/[username]', params: { username: friend.userName || friend.id } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e2e8f0' }}
          >
            <UserAvatar profileImage={friend.profileImage} firstName={friend.firstName || displayName} size={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#0f172a', fontSize: 15, fontWeight: '800' }}>{displayName}</Text>
              {friend.userName ? <Text style={{ color: '#64748b', marginTop: 2 }}>@{friend.userName}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
          </TouchableOpacity>
        );
      }) : (
        <View style={{ alignItems: 'center', padding: 28, borderRadius: 18, backgroundColor: '#ffffff' }}>
          <Ionicons name="people-outline" size={36} color="#10b981" />
          <Text style={{ color: '#0f172a', fontWeight: '800', fontSize: 16, marginTop: 10 }}>{search ? 'No matching friends' : 'No friends to show yet'}</Text>
        </View>
      )}
    </View>
  );
}
