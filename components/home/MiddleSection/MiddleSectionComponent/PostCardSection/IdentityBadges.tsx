import { Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { postAuthorizationService } from '@/lib/services/PostAuthorizationService';
import type { PostUser } from '@/lib/services/PostService';

type IdentityBadgesProps = { user: PostUser };

export default function IdentityBadges({ user }: IdentityBadgesProps) {
  const isStudent = user.accountType?.toLowerCase().includes('student') === true;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
      {postAuthorizationService.isIdentityVerified(user) ? <Icon name="check-circle" size={15} color="#10b981" style={{ marginLeft: 5 }} /> : null}
      {user.isAdmin ? <View style={{ marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: '#fef2f2' }}><Text style={{ color: '#b91c1c', fontSize: 9, fontWeight: '800' }}>ADMIN</Text></View> : null}
      {isStudent ? <View style={{ marginLeft: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: '#eff6ff' }}><Text style={{ color: '#1d4ed8', fontSize: 9, fontWeight: '800' }}>STUDENT</Text></View> : null}
    </View>
  );
}
