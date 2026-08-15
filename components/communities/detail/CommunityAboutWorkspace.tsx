import { CalendarDays, CheckCircle2, Globe2, Lock, MessageSquareText, ShieldCheck, Users } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { CommunityDetailResource } from '@/lib/types/community';

type CommunityAboutWorkspaceProps = { detail: CommunityDetailResource };

export default function CommunityAboutWorkspace({ detail }: CommunityAboutWorkspaceProps) {
  const { colors } = useAppTheme();
  const { community, rules } = detail;
  const rows = [
    { label: 'Category', value: community.categoryName || 'Uncategorized', icon: Globe2 },
    { label: 'Privacy', value: community.isPrivate ? 'Private community' : 'Public community', icon: community.isPrivate ? Lock : Globe2 },
    { label: 'Verification policy', value: community.verifiedMembersOnly ? 'Verified members only' : 'Verification is not required', icon: ShieldCheck },
    { label: 'Posting permission', value: community.postingPermission, icon: MessageSquareText },
    { label: 'Created', value: community.createdAt ? new Date(community.createdAt).toLocaleDateString() : 'Unavailable', icon: CalendarDays },
    { label: 'Members', value: community.memberCount.toLocaleString(), icon: Users },
  ];
  return <View style={{ margin: 16, padding: 17, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.text, fontSize: 18, fontWeight: '900' }}>About & community settings</Text><Text style={{ marginTop: 8, color: colors.secondaryText, lineHeight: 21 }}>{community.description || 'No community description.'}</Text><View style={{ marginTop: 14 }}>{rows.map((row) => <View key={row.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border }}><View style={{ width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.control }}><row.icon size={18} color={colors.accent} /></View><View style={{ flex: 1, marginLeft: 10 }}><Text style={{ color: colors.mutedText, fontSize: 11 }}>{row.label}</Text><Text style={{ marginTop: 2, color: colors.text, fontWeight: '800', textTransform: row.label === 'Posting permission' ? 'capitalize' : 'none' }}>{row.value}</Text></View></View>)}</View><Text style={{ marginTop: 17, color: colors.text, fontSize: 16, fontWeight: '900' }}>Community rules</Text>{rules.length ? rules.map((rule, index) => <View key={`${index}-${rule}`} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 }}><CheckCircle2 size={17} color={colors.accent} /><Text style={{ flex: 1, marginLeft: 8, color: colors.secondaryText, lineHeight: 20 }}>{index + 1}. {rule}</Text></View>) : <Text style={{ marginTop: 8, color: colors.mutedText }}>No additional rules have been published.</Text>}</View>;
}
