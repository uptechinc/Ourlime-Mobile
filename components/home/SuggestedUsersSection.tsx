import { useState, useEffect } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { AuthService } from '@/lib/services/AuthService';
import { RelationshipService, type RelationshipSuggestion } from '@/lib/services/RelationshipService';
import CustomModal from '@/components/ui/CustomModal';

const authService = AuthService.getInstance();
const relationshipService = RelationshipService.getInstance();

export default function SuggestedUsersSection() {
  const router = useRouter();
  const [users, setUsers] = useState<RelationshipSuggestion[]>([]);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void relationshipService.getSuggestions(6).then(setUsers).catch((error: unknown) => {
      setErrorMessage(error instanceof Error ? error.message : 'Suggested users could not be loaded');
    });
  }, []);

  const handleFriendRequest = async (userId: string) => {
    const currentUserId = authService.getCurrentUser()?.uid;
    if (!currentUserId || busyId || pendingIds.has(userId)) return;
    setBusyId(userId);
    try {
      await relationshipService.sendFriendRequest(currentUserId, userId);
      setPendingIds((current) => new Set(current).add(userId));
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Friend request could not be sent');
    } finally {
      setBusyId(null);
    }
  };

  if (users.length === 0) return null;

  return (
    <View style={{ marginBottom: 16, backgroundColor: '#ffffff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 }}>
        People You May Know
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {users.map((user) => (
          <TouchableOpacity
            key={user.id}
            onPress={() => router.push({ pathname: '/profile/[username]', params: { username: user.userName } })}
            style={{
              width: 130,
              padding: 12,
              borderRadius: 16,
              backgroundColor: '#f8fafc',
              borderWidth: 1,
              borderColor: '#e2e8f0',
              alignItems: 'center',
              marginRight: 10,
            }}
          >
            <UserAvatar profileImage={user.profileImage} firstName={user.firstName || user.userName} size={52} />
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 8, textAlign: 'center' }}>
              {user.firstName}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: '#64748b', marginTop: 2, textAlign: 'center' }}>
              @{user.userName}
            </Text>
            {user.reason ? <Text numberOfLines={1} style={{ fontSize: 10, color: '#059669', marginTop: 3 }}>{user.reason}</Text> : null}
            <TouchableOpacity disabled={busyId === user.id || pendingIds.has(user.id)} onPress={() => void handleFriendRequest(user.id)} style={{ marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: pendingIds.has(user.id) ? '#e2e8f0' : '#10b981', width: '100%', alignItems: 'center' }}>
              {busyId === user.id ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={{ fontSize: 12, fontWeight: '700', color: pendingIds.has(user.id) ? '#64748b' : '#ffffff' }}>{pendingIds.has(user.id) ? 'Sent' : 'Add Friend'}</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <CustomModal visible={Boolean(errorMessage)} title="People unavailable" message={errorMessage ?? ''} type="error" onClose={() => setErrorMessage(null)} />
    </View>
  );
}
