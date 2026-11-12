import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import UserAvatar from '@/components/ui/UserAvatar';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { searchService } from '@/lib/services/SearchService';
import { RelationshipService } from '@/lib/services/RelationshipService';
import { relationshipResourceService } from '@/lib/services/RelationshipResourceService';
import { relationshipRequestResourceService } from '@/lib/services/RelationshipRequestResourceService';
import { conversationResourceService } from '@/lib/services/ConversationResourceService';
import type { BlockedUserSummary } from '@/lib/profile/settings/SettingsService';

type BlockListSectionProps = {
  userId: string;
  blockedUsers: BlockedUserSummary[];
  onBlockedUsersChange: (blockedUsers: BlockedUserSummary[]) => void;
};

type PendingAction = { kind: 'block' | 'unblock'; user: BlockedUserSummary } | null;

const relationshipService = RelationshipService.getInstance();

const displayNameOf = (user: BlockedUserSummary): string => `${user.firstName} ${user.lastName}`.trim() || user.userName || 'Ourlime user';

/** Website BlockList: search for someone to block, and unblock people already blocked. */
export default function BlockListSection({ userId, blockedUsers, onBlockedUsersChange }: BlockListSectionProps) {
  const { colors } = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState<BlockedUserSummary[]>([]);
  const [pending, setPending] = useState<PendingAction>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (): Promise<void> => {
    if (!searchQuery.trim() || searching) return;
    setSearching(true);
    setError('');
    try {
      const profiles = await searchService.searchUsers(searchQuery);
      setResults(profiles
        .filter((profile) => profile.uid !== userId && !blockedUsers.some((blocked) => blocked.id === profile.uid))
        .map((profile) => ({ id: profile.uid, userName: profile.userName ?? '', firstName: profile.firstName ?? '', lastName: profile.lastName ?? '', profileImage: profile.profilePicture ?? null })));
      setSearched(true);
    } catch (searchError: unknown) {
      console.error('[BlockListSection.handleSearch] Error:', searchError);
      setError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const handleConfirm = async (): Promise<void> => {
    if (!pending) return;
    setWorking(true);
    setError('');
    try {
      if (pending.kind === 'block') {
        relationshipResourceService.removeUserFromCachedRelationships(userId, pending.user.id);
        relationshipRequestResourceService.removeUserFromCachedRequests(pending.user.id);
        void conversationResourceService.removeConversation(userId, pending.user.id);
        await relationshipService.blockUser(pending.user.id);
        relationshipResourceService.invalidateAll();
        onBlockedUsersChange([...blockedUsers, pending.user]);
        setResults((current) => current.filter((result) => result.id !== pending.user.id));
      } else {
        await relationshipService.unblockUser(pending.user.id);
        onBlockedUsersChange(blockedUsers.filter((blocked) => blocked.id !== pending.user.id));
      }
      setPending(null);
    } catch (actionError: unknown) {
      console.error('[BlockListSection.handleConfirm] Error:', actionError);
      setPending(null);
      setError(actionError instanceof Error ? actionError.message : 'That change could not be saved.');
    } finally {
      setWorking(false);
    }
  };

  const renderUser = (user: BlockedUserSummary, kind: 'block' | 'unblock') => (
    <View key={`${kind}-${user.id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <UserAvatar profileImage={user.profileImage} firstName={user.firstName || displayNameOf(user)} size={42} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{displayNameOf(user)}</Text>
        {user.userName ? <Text numberOfLines={1} style={{ color: colors.mutedText, fontSize: 12 }}>@{user.userName}</Text> : null}
      </View>
      <TouchableOpacity
        onPress={() => setPending({ kind, user })}
        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: kind === 'block' ? colors.destructiveSurface : colors.control }}
      >
        <Text style={{ color: kind === 'block' ? colors.destructiveText : colors.text, fontWeight: '800', fontSize: 12 }}>{kind === 'block' ? 'Block' : 'Unblock'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ gap: 14 }}>
      <View>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Blocked Users</Text>
        <Text style={{ color: colors.mutedText, fontSize: 13, marginTop: 2 }}>Search for someone to block, or unblock people below.</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.input, paddingHorizontal: 12 }}>
          <Icon name="search" size={16} color={colors.mutedText} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={() => void handleSearch()}
            returnKeyType="search"
            autoCapitalize="none"
            placeholder="Search by name or username"
            placeholderTextColor={colors.mutedText}
            style={{ flex: 1, color: colors.text, paddingVertical: 11 }}
          />
        </View>
        <TouchableOpacity onPress={() => void handleSearch()} disabled={searching || !searchQuery.trim()} style={{ paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: searching || !searchQuery.trim() ? 0.6 : 1 }}>
          {searching ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '800' }}>Search</Text>}
        </TouchableOpacity>
      </View>
      {error ? <Text style={{ color: colors.destructiveText, fontWeight: '700' }}>{error}</Text> : null}
      {searched ? (
        <View>
          <Text style={{ color: colors.mutedText, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>Search Results</Text>
          {results.length === 0 ? <Text style={{ color: colors.mutedText, paddingVertical: 8 }}>No people found.</Text> : results.map((result) => renderUser(result, 'block'))}
        </View>
      ) : null}
      <View>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 14, marginBottom: 4 }}>Currently Blocked</Text>
        {blockedUsers.length === 0 ? <Text style={{ color: colors.mutedText, paddingVertical: 8 }}>Your blocked-users list is empty.</Text> : blockedUsers.map((blocked) => renderUser(blocked, 'unblock'))}
      </View>
      <CustomModal
        visible={pending !== null}
        type={pending?.kind === 'block' ? 'danger' : 'warning'}
        title={pending ? (pending.kind === 'block' ? `Block @${pending.user.userName}?` : `Unblock @${pending.user.userName}?`) : ''}
        message={pending?.kind === 'block'
          ? "You will no longer be friends or follow each other, and neither of you will be able to view the other's profile."
          : 'They will be able to find and interact with you again.'}
        confirmText={pending?.kind === 'block' ? 'Block' : 'Unblock'}
        cancelText="Cancel"
        isLoading={working}
        onConfirm={() => void handleConfirm()}
        onClose={() => { if (!working) setPending(null); }}
      />
    </View>
  );
}
