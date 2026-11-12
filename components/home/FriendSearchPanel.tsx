import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, UserCheck, UserPlus, Users, X } from 'lucide-react-native';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal from '@/components/ui/CustomModal';
import { Skeleton, SkeletonCircle } from '@/components/ui/Skeleton';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { SearchService } from '@/lib/services/SearchService';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';

type FriendshipState = 'none' | 'pending' | 'accepted';
type SearchResultUser = UserProfile & { friendshipStatus: FriendshipState; isFollowing: boolean };

const searchService = SearchService.getInstance();
const relationshipService = RelationshipService.getInstance();
const authService = AuthService.getInstance();

/**
 * "Find and add friends" card the website shows above the feed when the Friends feed is selected
 * (components/search/UserSearch): search people, then add friend / cancel request / follow / unfollow.
 */
export default function FriendSearchPanel() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<SearchResultUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<SearchResultUser | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = searchText.trim();
    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsSearching(true);
    setSearchError(null);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const currentUserId = authService.getCurrentUser()?.uid ?? '';
          const users = (await searchService.searchUsers(trimmed, 10)).filter((user) => user.uid !== currentUserId);
          const withStatus = await Promise.all(users.map(async (user): Promise<SearchResultUser> => {
            if (!currentUserId) return { ...user, friendshipStatus: 'none', isFollowing: false };
            const [friendshipStatus, isFollowing] = await Promise.all([
              relationshipService.checkFriendshipStatus(currentUserId, user.uid).catch((): FriendshipState => 'none'),
              relationshipService.checkFollowStatus(currentUserId, user.uid).catch(() => false),
            ]);
            return { ...user, friendshipStatus, isFollowing };
          }));
          if (requestIdRef.current === requestId) setResults(withStatus);
        } catch (error: unknown) {
          console.error('[FriendSearchPanel.search] Error:', error instanceof Error ? error.message : error);
          if (requestIdRef.current === requestId) {
            setResults([]);
            setSearchError(error instanceof Error ? error.message : 'Search is unavailable');
          }
        } finally {
          if (requestIdRef.current === requestId) setIsSearching(false);
        }
      })();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const updateUser = (userId: string, changes: Partial<Pick<SearchResultUser, 'friendshipStatus' | 'isFollowing'>>): void => {
    setResults((current) => current.map((user) => user.uid === userId ? { ...user, ...changes } : user));
  };

  const handleSendFriendRequest = async (user: SearchResultUser): Promise<void> => {
    const currentUserId = authService.getCurrentUser()?.uid;
    if (!currentUserId || busyUserId) return;
    setBusyUserId(user.uid);
    try {
      await relationshipService.sendFriendRequest(currentUserId, user.uid);
      updateUser(user.uid, { friendshipStatus: 'pending' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'The friend request could not be sent.';
      if (/pending|already/i.test(message)) updateUser(user.uid, { friendshipStatus: 'pending' });
      setActionError(message);
    } finally {
      setBusyUserId(null);
    }
  };

  const handleConfirmCancel = async (): Promise<void> => {
    const currentUserId = authService.getCurrentUser()?.uid;
    if (!currentUserId || !cancelTarget) return;
    setBusyUserId(cancelTarget.uid);
    try {
      await relationshipService.cancelOrRemoveFriend(currentUserId, cancelTarget.uid, 'pending');
      updateUser(cancelTarget.uid, { friendshipStatus: 'none' });
      setCancelTarget(null);
    } catch (error: unknown) {
      setCancelTarget(null);
      setActionError(error instanceof Error ? error.message : 'The friend request could not be cancelled.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleToggleFollow = async (user: SearchResultUser): Promise<void> => {
    const currentUserId = authService.getCurrentUser()?.uid;
    if (!currentUserId || busyUserId) return;
    setBusyUserId(user.uid);
    try {
      await relationshipService.setFollowing(currentUserId, user.uid, !user.isFollowing);
      updateUser(user.uid, { isFollowing: !user.isFollowing });
    } catch (error: unknown) {
      setActionError(error instanceof Error ? error.message : 'The follow status could not be updated.');
    } finally {
      setBusyUserId(null);
    }
  };

  const renderActions = (user: SearchResultUser) => {
    const isBusy = busyUserId === user.uid;
    if (user.friendshipStatus === 'accepted') {
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.successSurface }}>
          <UserCheck size={14} color={colors.successText} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.successText }}>Friends</Text>
        </View>
      );
    }
    if (user.friendshipStatus === 'pending') {
      return (
        <TouchableOpacity
          disabled={isBusy}
          onPress={() => setCancelTarget(user)}
          accessibilityRole="button"
          accessibilityLabel={`Cancel friend request to ${user.firstName || user.userName}`}
          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.warningText, backgroundColor: colors.warningSurface }}
        >
          {isBusy ? <ActivityIndicator size="small" color={colors.warningText} /> : <Text style={{ fontSize: 12, fontWeight: '700', color: colors.warningText }}>Cancel Request</Text>}
        </TouchableOpacity>
      );
    }
    return (
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <TouchableOpacity
          disabled={isBusy}
          onPress={() => void handleSendFriendRequest(user)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${user.firstName || user.userName} as a friend`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: colors.accent }}
        >
          {isBusy ? <ActivityIndicator size="small" color={colors.onAccent} /> : <UserPlus size={14} color={colors.onAccent} />}
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.onAccent }}>Add Friend</Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={isBusy}
          onPress={() => void handleToggleFollow(user)}
          accessibilityRole="button"
          accessibilityLabel={user.isFollowing ? `Unfollow ${user.firstName || user.userName}` : `Follow ${user.firstName || user.userName}`}
          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: colors.border, opacity: isBusy ? 0.5 : 1 }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.secondaryText }}>{user.isFollowing ? 'Unfollow' : 'Follow'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={{ marginBottom: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 2 }}>
        <Users size={16} color={colors.accent} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>Find and add friends</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, paddingHorizontal: 12 }}>
        <Search size={16} color={colors.mutedText} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search users..."
          placeholderTextColor={colors.mutedText}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search users"
          style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 8, fontSize: 14, color: colors.text }}
        />
        {searchText ? (
          <TouchableOpacity onPress={() => setSearchText('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
            <X size={16} color={colors.mutedText} />
          </TouchableOpacity>
        ) : null}
      </View>

      {searchText.trim() ? (
        <View style={{ marginTop: 10 }}>
          {isSearching ? (
            [0, 1, 2].map((row) => (
              <View key={`friend-search-skeleton-${row}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <SkeletonCircle size={40} />
                <View style={{ flex: 1, marginLeft: 10, gap: 6 }}>
                  <Skeleton width="55%" height={13} />
                  <Skeleton width="35%" height={11} />
                </View>
                <Skeleton width={84} height={28} borderRadius={10} />
              </View>
            ))
          ) : searchError ? (
            <Text style={{ paddingVertical: 10, textAlign: 'center', fontSize: 13, color: colors.destructiveText }}>{searchError}</Text>
          ) : results.length === 0 ? (
            <Text style={{ paddingVertical: 10, textAlign: 'center', fontSize: 13, color: colors.mutedText }}>No users found</Text>
          ) : (
            results.map((user) => (
              <TouchableOpacity
                key={user.uid}
                activeOpacity={0.8}
                onPress={() => router.push({ pathname: '/profile/[username]', params: { username: user.userName || user.uid } })}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
              >
                <UserAvatar profileImage={user.profilePicture} firstName={user.firstName || user.userName} size={40} />
                <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
                  <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{`${user.firstName} ${user.lastName}`.trim() || user.userName}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: colors.mutedText }}>@{user.userName}</Text>
                </View>
                {renderActions(user)}
              </TouchableOpacity>
            ))
          )}
        </View>
      ) : null}

      {cancelTarget ? (
        <CustomModal
          visible
          type="warning"
          title="Cancel Friend Request?"
          message={`Cancel your friend request to ${cancelTarget.firstName || cancelTarget.userName} (@${cancelTarget.userName})?`}
          confirmText="Cancel Request"
          cancelText="Keep Request"
          isLoading={busyUserId === cancelTarget.uid}
          onConfirm={() => void handleConfirmCancel()}
          onClose={() => setCancelTarget(null)}
        />
      ) : null}
      {actionError ? (
        <CustomModal
          visible
          type="error"
          title="Friend request"
          message={actionError}
          confirmText="OK"
          onConfirm={() => setActionError(null)}
          onClose={() => setActionError(null)}
        />
      ) : null}
    </View>
  );
}
