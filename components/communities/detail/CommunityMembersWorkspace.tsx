import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Search, Shield, UserMinus, Users } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityMember, CommunityPage } from '@/lib/types/community';
import type { ResourceState } from '@/lib/types/resourceState';

type CommunityMembersWorkspaceProps = {
  resource: ResourceState<CommunityPage<CommunityMember>>;
  canManage: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
  onSearch: (search: string) => void;
  onOpenProfile: (member: CommunityMember) => void;
  onManageMember: (member: CommunityMember) => void;
};

export default function CommunityMembersWorkspace({ resource, canManage, onRetry, onLoadMore, onSearch, onOpenProfile, onManageMember }: CommunityMembersWorkspaceProps) {
  const { colors } = useAppTheme();
  const [search, setSearch] = useState('');
  const [searchTouched, setSearchTouched] = useState(false);
  const members = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (resource.data?.items ?? []).filter((member) => !query || `${member.firstName} ${member.lastName} ${member.userName}`.toLowerCase().includes(query));
  }, [resource.data?.items, search]);
  useEffect(() => {
    if (!searchTouched) return;
    const timeout = setTimeout(() => onSearch(search), 350);
    return () => clearTimeout(timeout);
  }, [onSearch, search, searchTouched]);

  if (!resource.data && (resource.status === 'hydrating' || resource.status === 'idle')) return <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />;
  if (!resource.data && resource.status === 'error') return <View style={{ padding: 28, alignItems: 'center' }}><Text style={{ color: colors.destructiveText, textAlign: 'center' }}>{resource.error?.message ?? 'Members could not be loaded.'}</Text><TouchableOpacity onPress={onRetry} style={{ marginTop: 12, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent, fontWeight: '800' }}>Retry</Text></TouchableOpacity></View>;

  return <View style={{ margin: 16 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input }}><Search size={17} color={colors.icon} /><TextInput value={search} onChangeText={(value) => { setSearchTouched(true); setSearch(value); }} placeholder="Search members" placeholderTextColor={colors.mutedText} style={{ flex: 1, paddingHorizontal: 9, paddingVertical: 11, color: colors.text }} /></View>
    <Text style={{ marginTop: 11, marginBottom: 9, color: colors.mutedText, fontSize: 12 }}>{members.length} of {resource.data?.totalCount ?? 0} members</Text>
    {members.length ? members.map((member) => <TouchableOpacity key={`${member.userId}-${member.membershipId}`} onPress={() => onOpenProfile(member)} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 9, padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>{member.profilePicture ? <CachedImage uri={member.profilePicture} recyclingKey={`community-member-${member.userId}-${member.profilePicture}`} style={{ width: 46, height: 46, borderRadius: 23 }} contentFit="cover" /> : <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSurface }}><Text style={{ color: colors.accentText, fontWeight: '900' }}>{(member.firstName || member.userName).charAt(0).toUpperCase()}</Text></View>}<View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: colors.text, fontWeight: '900' }}>{`${member.firstName} ${member.lastName}`.trim() || member.userName}</Text><Text style={{ marginTop: 3, color: colors.mutedText, fontSize: 12 }}>@{member.userName} · <Text style={{ color: colors.accentText, textTransform: 'capitalize' }}>{member.role}</Text></Text>{member.isFriend ? <Text style={{ marginTop: 3, color: colors.accentText, fontSize: 11 }}>Friend {member.isOnline ? '· Online' : ''}</Text> : null}</View>{member.role === 'owner' || member.role === 'admin' || member.role === 'moderator' ? <Shield size={18} color={colors.accent} /> : null}{canManage && member.role !== 'owner' ? <TouchableOpacity onPress={(event) => { event.stopPropagation(); onManageMember(member); }} style={{ marginLeft: 9, padding: 8, borderRadius: 10, backgroundColor: colors.control }}><UserMinus size={17} color={colors.icon} /></TouchableOpacity> : null}</TouchableOpacity>) : <View style={{ alignItems: 'center', padding: 28 }}><Users size={40} color={colors.accent} /><Text style={{ marginTop: 10, color: colors.text, fontWeight: '900' }}>No members found</Text></View>}
    {resource.data?.hasMore ? <TouchableOpacity disabled={resource.status === 'refreshing'} onPress={onLoadMore} style={{ minHeight: 44, marginTop: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.control }}>{resource.status === 'refreshing' ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accentText, fontWeight: '900' }}>Load more members</Text>}</TouchableOpacity> : null}
  </View>;
}
