import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { SearchService } from '@/lib/services/SearchService';
import type { UserProfile } from '@/lib/services/AuthService';
import { SkeletonChatRow } from '@/components/home/SkeletonLoaders';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const searchService = SearchService.getInstance();

export default function SearchScreen() {
  const router = useRouter();
  const { isDark, colors } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(async (queryText: string) => {
    setSearchError(null);
    if (!queryText.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const users = await searchService.searchUsers(queryText);
      setResults(users);
    } catch (error: unknown) {
      setResults([]);
      setSearchError(error instanceof Error ? error.message : 'Search is unavailable');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = (text: string) => {
    setSearchQuery(text);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      void performSearch(text);
    }, 400);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (searchQuery.trim()) {
      void performSearch(searchQuery);
    }
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  }, [performSearch, searchQuery]);

  const handleNavigateProfile = (username: string) => {
    router.push({ pathname: '/profile/[username]', params: { username } });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.surface} />

      {/* Search Bar Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.control,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}>
          <Ionicons name="search" size={20} color={colors.icon} style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: colors.text }}
            placeholder="Search people on Ourlime..."
            placeholderTextColor={colors.mutedText}
            value={searchQuery}
            onChangeText={handleQueryChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleQueryChange('')}>
              <Ionicons name="close-circle" size={18} color={colors.mutedText} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content Area with Pull-To-Refresh */}
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.canvas }}
        contentContainerStyle={{ flexGrow: 1, padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
            colors={['#10b981']}
          />
        }
      >
        {isSearching ? (
          <View style={{ paddingTop: 8 }}>
            <SkeletonChatRow />
            <SkeletonChatRow />
            <SkeletonChatRow />
          </View>
        ) : searchQuery.trim().length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <Ionicons name="compass-outline" size={48} color={colors.icon} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 12 }}>Discover People & Profiles</Text>
            <Text style={{ fontSize: 13, color: colors.mutedText, marginTop: 4, textAlign: 'center', maxWidth: 280 }}>
              Type a username or name above to search for people on Ourlime.
            </Text>
          </View>
        ) : searchError ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}><Ionicons name="alert-circle-outline" size={48} color="#c64d53" /><Text style={{ fontSize: 17, fontWeight: '700', color: isDark ? '#fca5a5' : '#991b1b', marginTop: 12 }}>Search unavailable</Text><Text style={{ color: colors.mutedText, marginTop: 5, textAlign: 'center' }}>{searchError}</Text><TouchableOpacity onPress={() => void performSearch(searchQuery)} style={{ marginTop: 15, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: '#10b981' }}><Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text></TouchableOpacity></View>
        ) : results.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <Ionicons name="search-outline" size={48} color={colors.icon} />
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 12 }}>
              No users found for &quot;{searchQuery}&quot;
            </Text>
          </View>
        ) : (
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.mutedText, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              People ({results.length})
            </Text>
            {results.map((user) => (
              <TouchableOpacity
                key={user.uid}
                onPress={() => handleNavigateProfile(user.userName)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surface,
                  padding: 14,
                  borderRadius: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <UserAvatar profileImage={user.profilePicture} firstName={user.firstName || user.userName} size={48} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                    {user.firstName} {user.lastName}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.mutedText, marginTop: 2 }}>@{user.userName}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.icon} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
