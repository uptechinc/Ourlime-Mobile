import { useState, useCallback, useRef } from 'react';
import type { ComponentProps } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import UserAvatar from '@/components/ui/UserAvatar';
import { SearchService } from '@/lib/services/SearchService';
import type { UserProfile } from '@/lib/services/AuthService';
import { SkeletonChatRow } from '@/components/home/SkeletonLoaders';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { AuthService } from '@/lib/services/AuthService';

type SearchCategory = 'people' | 'communities' | 'events' | 'jobs';

const searchService = SearchService.getInstance();
const relationshipService = RelationshipService.getInstance();
const authService = AuthService.getInstance();

export default function SearchScreen() {
  const router = useRouter();
  const { isDark, colors } = useAppTheme();
  const [activeCategory, setActiveCategory] = useState<SearchCategory>('people');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<UserProfile[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [friendSentIds, setFriendSentIds] = useState<Set<string>>(new Set());
  const [busyFriendId, setBusyFriendId] = useState<string | null>(null);
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

  const handleAddFriend = async (targetUid: string) => {
    const currentUserId = authService.getCurrentUser()?.uid;
    if (!currentUserId || busyFriendId || friendSentIds.has(targetUid)) return;
    setBusyFriendId(targetUid);
    try {
      await relationshipService.sendFriendRequest(currentUserId, targetUid);
      setFriendSentIds((prev) => new Set(prev).add(targetUid));
    } catch (error: unknown) {
      setSearchError(error instanceof Error ? error.message : 'Friend request could not be sent');
    } finally {
      setBusyFriendId(null);
    }
  };

  const categories: { key: SearchCategory; label: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'people', label: 'People', icon: 'people' },
    { key: 'communities', label: 'Communities', icon: 'people-circle' },
    { key: 'events', label: 'Events', icon: 'calendar' },
    { key: 'jobs', label: 'Jobs', icon: 'briefcase' },
  ];

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
            placeholder="Search Ourlime..."
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

        {/* Category Tabs Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {categories.map((cat) => {
              const active = activeCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setActiveCategory(cat.key)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                    borderRadius: 20,
                    backgroundColor: active ? '#10b981' : colors.control,
                    borderWidth: 1,
                    borderColor: active ? '#10b981' : colors.border,
                  }}
                >
                  <Ionicons name={cat.icon} size={15} color={active ? '#ffffff' : colors.text} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: active ? '#ffffff' : colors.text }}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
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
              Type a search query above to find people, communities, events, or jobs on Ourlime.
            </Text>
          </View>
        ) : searchError ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={48} color="#c64d53" />
            <Text style={{ fontSize: 17, fontWeight: '700', color: isDark ? '#fca5a5' : '#991b1b', marginTop: 12 }}>Search unavailable</Text>
            <Text style={{ color: colors.mutedText, marginTop: 5, textAlign: 'center' }}>{searchError}</Text>
            <TouchableOpacity onPress={() => void performSearch(searchQuery)} style={{ marginTop: 15, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: '#10b981' }}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : results.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <Ionicons name="search-outline" size={48} color={colors.icon} />
            <Text style={{ fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 12 }}>
              No results found for &quot;{searchQuery}&quot;
            </Text>
          </View>
        ) : (
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.mutedText, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Results ({results.length})
            </Text>
            {results.map((user) => {
              const isSent = friendSentIds.has(user.uid);
              const isBusy = busyFriendId === user.uid;
              return (
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
                  <View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>
                      {user.firstName} {user.lastName}
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.mutedText, marginTop: 2 }}>@{user.userName}</Text>
                  </View>
                  <TouchableOpacity
                    disabled={isSent || isBusy}
                    onPress={() => void handleAddFriend(user.uid)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 16,
                      backgroundColor: isSent ? colors.control : '#10b981',
                      borderWidth: isSent ? 1 : 0,
                      borderColor: colors.border,
                    }}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={{ fontSize: 12, fontWeight: '700', color: isSent ? colors.mutedText : '#ffffff' }}>
                        {isSent ? 'Sent' : 'Add Friend'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
