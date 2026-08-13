import { useState, useEffect } from 'react';
import { ActivityIndicator, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { AuthService } from '@/lib/services/AuthService';
import { RelationshipService, type RelationshipSuggestion } from '@/lib/services/RelationshipService';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const authService = AuthService.getInstance();
const relationshipService = RelationshipService.getInstance();

export default function SuggestedUsersSection() {
  const router = useRouter();
  const { colors } = useAppTheme();
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
    <View style={{ marginBottom: 16, backgroundColor: colors.surface, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 }}>
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
              backgroundColor: colors.control,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              marginRight: 10,
            }}
          >
            <UserAvatar profileImage={user.profileImage} firstName={user.firstName || user.userName} size={52} />
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 8, textAlign: 'center' }}>
              {user.firstName}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: colors.mutedText, marginTop: 2, textAlign: 'center' }}>
              @{user.userName}
            </Text>
            {user.reason ? <Text numberOfLines={1} style={{ fontSize: 10, color: '#10b981', marginTop: 3 }}>{user.reason}</Text> : null}
            <TouchableOpacity disabled={busyId === user.id || pendingIds.has(user.id)} onPress={() => void handleFriendRequest(user.id)} style={{ marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: pendingIds.has(user.id) ? colors.border : '#10b981', width: '100%', alignItems: 'center' }}>
              {busyId === user.id ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={{ fontSize: 12, fontWeight: '700', color: pendingIds.has(user.id) ? colors.mutedText : '#ffffff' }}>{pendingIds.has(user.id) ? 'Sent' : 'Add Friend'}</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <CustomModal visible={Boolean(errorMessage)} title="People unavailable" message={errorMessage ?? ''} type="error" onClose={() => setErrorMessage(null)} />
    </View>
  );
}
