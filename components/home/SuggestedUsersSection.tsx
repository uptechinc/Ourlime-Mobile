import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { SearchService } from '@/lib/services/SearchService';
import type { UserProfile } from '@/lib/services/AuthService';

const searchService = SearchService.getInstance();

export default function SuggestedUsersSection() {
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    void searchService.searchUsers('a', 6).then(setUsers);
  }, []);

  if (users.length === 0) return null;

  return (
    <View style={{ marginBottom: 16, backgroundColor: '#ffffff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 }}>
        People You May Know
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {users.map((user) => (
          <TouchableOpacity
            key={user.uid}
            onPress={() => router.push(`/profile/${user.userName}` as any)}
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
            <UserAvatar profileImage={user.profilePicture} firstName={user.firstName || user.userName} size={52} />
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 8, textAlign: 'center' }}>
              {user.firstName}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: '#64748b', marginTop: 2, textAlign: 'center' }}>
              @{user.userName}
            </Text>
            <TouchableOpacity style={{ marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#10b981', width: '100%', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff' }}>Add Friend</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
