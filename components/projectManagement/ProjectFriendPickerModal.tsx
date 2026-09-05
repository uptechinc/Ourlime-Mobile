import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { auth } from '@/lib/firebaseConfig';
import { RelationshipService, type RelationshipUser } from '@/lib/services/RelationshipService';
import { ProjectService } from '@/lib/services/ProjectService';
import UserAvatar from '@/components/ui/UserAvatar';
import type { ProjectRole, ProjectTeamMember } from '@/lib/types/project';

type ProjectFriendPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  existingMembers: Record<string, ProjectTeamMember>;
  onMemberInvited?: (userId: string) => void;
};

const PAGE_SIZE = 12;
const ROLES: ProjectRole[] = ['member', 'admin', 'viewer'];

export default function ProjectFriendPickerModal({
  visible,
  onClose,
  projectId,
  existingMembers,
  onMemberInvited,
}: ProjectFriendPickerModalProps) {
  const { colors, isDark } = useAppTheme();
  const [friends, setFriends] = useState<RelationshipUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Record<string, ProjectRole>>({});
  const [invitingIds, setInvitingIds] = useState<Set<string>>(new Set());
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);

  const relationshipService = useMemo(() => RelationshipService.getInstance(), []);
  const projectService = useMemo(() => ProjectService.getInstance(), []);

  const loadFriends = useCallback(async () => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    setLoading(true);
    try {
      const list = await relationshipService.getFriends(currentUid);
      setFriends(list);
    } catch (err) {
      console.error('[ProjectFriendPickerModal] Error loading friends:', err);
    } finally {
      setLoading(false);
    }
  }, [relationshipService]);

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setPageLimit(PAGE_SIZE);
      void loadFriends();
    }
  }, [visible, loadFriends]);

  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((friend) => {
      const fullName = `${friend.firstName || ''} ${friend.lastName || ''}`.toLowerCase();
      const user = (friend.userName || '').toLowerCase();
      return fullName.includes(q) || user.includes(q);
    });
  }, [friends, searchQuery]);

  const paginatedFriends = useMemo(() => {
    return filteredFriends.slice(0, pageLimit);
  }, [filteredFriends, pageLimit]);

  const handleEndReached = () => {
    if (pageLimit < filteredFriends.length) {
      setPageLimit((prev) => prev + PAGE_SIZE);
    }
  };

  const handleInvite = async (friend: RelationshipUser) => {
    const role = selectedRoles[friend.id] || 'member';
    setInvitingIds((prev) => new Set(prev).add(friend.id));
    try {
      await projectService.inviteMember(projectId, friend.id, role);
      onMemberInvited?.(friend.id);
    } catch (error) {
      console.error('[ProjectFriendPickerModal] Invite error:', error);
    } finally {
      setInvitingIds((prev) => {
        const next = new Set(prev);
        next.delete(friend.id);
        return next;
      });
    }
  };

  const toggleRole = (userId: string) => {
    setSelectedRoles((prev) => {
      const current = prev[userId] || 'member';
      const nextRoleIndex = (ROLES.indexOf(current) + 1) % ROLES.length;
      return { ...prev, [userId]: ROLES[nextRoleIndex] };
    });
  };

  const renderItem = ({ item }: { item: RelationshipUser }) => {
    const existing = existingMembers[item.id];
    const isInviting = invitingIds.has(item.id);
    const chosenRole = selectedRoles[item.id] || 'member';
    const fullName = `${item.firstName || ''} ${item.lastName || ''}`.trim() || item.userName || 'User';

    return (
      <View style={[styles.friendRow, { borderBottomColor: colors.border }]}>
        <UserAvatar
          profileImage={item.profileImage}
          firstName={item.firstName || item.userName || 'User'}
          size={42}
        />
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
            {fullName}
          </Text>
          {item.userName ? (
            <Text style={[styles.friendUsername, { color: colors.mutedText }]} numberOfLines={1}>
              @{item.userName}
            </Text>
          ) : null}
        </View>

        {existing ? (
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  existing.membershipStatus === 'accepted'
                    ? `${colors.accent}18`
                    : isDark
                    ? '#334155'
                    : '#f1f5f9',
                borderColor:
                  existing.membershipStatus === 'accepted' ? colors.accent : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                {
                  color:
                    existing.membershipStatus === 'accepted' ? colors.accent : colors.mutedText,
                },
              ]}
            >
              {existing.membershipStatus === 'accepted' ? 'Member' : 'Pending'}
            </Text>
          </View>
        ) : (
          <View style={styles.actionCol}>
            <TouchableOpacity
              onPress={() => toggleRole(item.id)}
              style={[styles.roleSelector, { borderColor: colors.border, backgroundColor: colors.control }]}
            >
              <Text style={[styles.roleSelectorText, { color: colors.accent }]}>
                {chosenRole.toUpperCase()}
              </Text>
              <Ionicons name="swap-vertical" size={12} color={colors.accent} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => void handleInvite(item)}
              disabled={isInviting}
              style={[styles.inviteBtn, { backgroundColor: colors.accent }]}
            >
              {isInviting ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Text style={[styles.inviteBtnText, { color: colors.onAccent }]}>Invite</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: colors.canvas, borderColor: colors.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Invite Friends</Text>
              <Text style={[styles.subtitle, { color: colors.mutedText }]}>
                Add your contacts to the project team
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.closeBtn, { backgroundColor: colors.control }]}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.mutedText} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search friends by name or username..."
              placeholderTextColor={colors.mutedText}
              style={[styles.searchInput, { color: colors.text }]}
              autoCapitalize="none"
              clearButtonMode="while-editing"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color={colors.mutedText} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Friends List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.loadingText, { color: colors.mutedText }]}>Loading friends...</Text>
            </View>
          ) : paginatedFriends.length === 0 ? (
            <View style={styles.centerContainer}>
              <Ionicons name="people-outline" size={40} color={colors.mutedText} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Friends Found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.mutedText }]}>
                {searchQuery ? 'Try a different search query' : 'Connect with friends on Ourlime first'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={paginatedFriends}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.4}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 6 }}
              keyboardShouldPersistTaps="handled"
              ListFooterComponent={
                pageLimit < filteredFriends.length ? (
                  <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={colors.accent} />
                  </View>
                ) : null
              }
            />
          )}

          {/* Footer Done Button */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.doneButton, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.doneButtonText, { color: colors.onAccent }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  friendInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  friendName: {
    fontSize: 14,
    fontWeight: '700',
  },
  friendUsername: {
    fontSize: 12,
    marginTop: 1,
  },
  actionCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleSelectorText: {
    fontSize: 10,
    fontWeight: '800',
  },
  inviteBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  doneButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
