import { Crown, Heart, MessageSquareText, Users } from 'lucide-react-native';
import { Text, TouchableOpacity, View } from 'react-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityCardModel } from '@/lib/types/community';

type CommunityOfTheWeekProps = {
  community: CommunityCardModel;
  onOpen: (community: CommunityCardModel) => void;
};

export default function CommunityOfTheWeek({ community, onOpen }: CommunityOfTheWeekProps) {
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity onPress={() => onOpen(community)} activeOpacity={0.92} style={{ margin: 16, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ height: 172, backgroundColor: colors.successSurface }}>
        {community.imageUrl ? <CachedImage uri={community.imageUrl} recyclingKey={`community-week-${community.id}-${community.imageUrl}`} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Users size={52} color={colors.accent} /></View>}
        <View style={{ position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#f59e0b' }}><Crown size={14} color="#fff" /><Text style={{ marginLeft: 5, color: '#fff', fontWeight: '900', fontSize: 11 }}>COMMUNITY OF THE WEEK</Text></View>
      </View>
      <View style={{ padding: 15 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '900' }}>{community.title}</Text>
        <Text numberOfLines={2} style={{ marginTop: 6, color: colors.secondaryText, lineHeight: 19 }}>{community.description}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 13 }}><Users size={15} color={colors.accent} /><Text style={{ marginLeft: 5, color: colors.mutedText, fontWeight: '800' }}>{community.memberCount.toLocaleString()}</Text><Heart size={15} color="#ec4899" style={{ marginLeft: 18 }} /><Text style={{ marginLeft: 5, color: colors.mutedText, fontWeight: '800' }}>{community.likeCount.toLocaleString()}</Text><MessageSquareText size={15} color="#3b82f6" style={{ marginLeft: 18 }} /><Text style={{ marginLeft: 5, color: colors.mutedText, fontWeight: '800' }}>{community.postCount.toLocaleString()}</Text></View>
      </View>
    </TouchableOpacity>
  );
}
