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

const searchService = SearchService.getInstance();

export default function SearchScreen() {
  const router = useRouter();
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
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Search Bar Header */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#f1f5f9',
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}>
          <Ionicons name="search" size={20} color="#64748b" style={{ marginRight: 8 }} />
          <TextInput
            style={{ flex: 1, fontSize: 15, color: '#0f172a' }}
            placeholder="Search people on Ourlime..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={handleQueryChange}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleQueryChange('')}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content Area with Pull-To-Refresh */}
      <ScrollView
        style={{ flex: 1, backgroundColor: '#f8fafc' }}
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
            <Ionicons name="compass-outline" size={48} color="#cbd5e1" />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 12 }}>Discover People & Profiles</Text>
            <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4, textAlign: 'center', maxWidth: 280 }}>
              Type a username or name above to search for people on Ourlime.
            </Text>
          </View>
        ) : searchError ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}><Ionicons name="alert-circle-outline" size={48} color="#c64d53" /><Text style={{ fontSize: 17, fontWeight: '700', color: '#991b1b', marginTop: 12 }}>Search unavailable</Text><Text style={{ color: '#64748b', marginTop: 5, textAlign: 'center' }}>{searchError}</Text><TouchableOpacity onPress={() => void performSearch(searchQuery)} style={{ marginTop: 15, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: '#10b981' }}><Text style={{ color: '#fff', fontWeight: '800' }}>Retry</Text></TouchableOpacity></View>
        ) : results.length === 0 ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <Ionicons name="search-outline" size={48} color="#cbd5e1" />
            <Text style={{ fontSize: 17, fontWeight: '600', color: '#334155', marginTop: 12 }}>
              No users found for &quot;{searchQuery}&quot;
            </Text>
          </View>
        ) : (
          <View>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              People ({results.length})
            </Text>
            {results.map((user) => (
              <TouchableOpacity
                key={user.uid}
                onPress={() => handleNavigateProfile(user.userName)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#ffffff',
                  padding: 14,
                  borderRadius: 16,
                  marginBottom: 10,
                  borderWidth: 1,
                  borderColor: '#f1f5f9',
                }}
              >
                <UserAvatar profileImage={user.profilePicture} firstName={user.firstName || user.userName} size={48} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#1e293b' }}>
                    {user.firstName} {user.lastName}
                  </Text>
                  <Text style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>@{user.userName}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
