import { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import FriendsTab from '@/components/profile/FriendsTab';
import { FriendRowsSkeleton } from '@/components/profile/ProfileTabSkeletons';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { AuthService } from '@/lib/services/AuthService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { RelationshipHubSection } from '@/lib/types/relationshipHub';

const authService = AuthService.getInstance();

/** Website ?tab= values ("all friends", following, followers, requests, suggestions). */
const toSection = (tab: string | undefined): RelationshipHubSection => {
  const normalized = (tab ?? '').toLowerCase();
  if (normalized === 'following' || normalized === 'followers' || normalized === 'requests' || normalized === 'suggestions' || normalized === 'active') return normalized;
  return 'friends';
};

/** Website /profile/friends: the signed-in member's friends, followers, following, requests and suggestions. */
export default function FriendsScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [userId, setUserId] = useState(authService.getVerifiedCurrentUser()?.uid ?? '');

  useEffect(() => authService.subscribeToVerifiedAuthState((user) => setUserId(user?.uid ?? '')), []);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} style={{ padding: 6 }}>
          <ChevronLeft size={26} color={colors.icon} />
        </TouchableOpacity>
        <Text style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: '800', marginLeft: 4 }}>Friends</Text>
      </View>
      <KeyboardSafeView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {userId ? <FriendsTab key={toSection(tab)} userId={userId} initialSection={toSection(tab)} /> : <View style={{ paddingTop: 14 }}><FriendRowsSkeleton count={6} /></View>}
        </ScrollView>
      </KeyboardSafeView>
    </SafeAreaView>
  );
}
