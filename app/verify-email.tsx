import { Text, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AuthFlowScreen from '@/components/auth/AuthFlowScreen';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { status } = useLocalSearchParams<{ status?: 'success' | 'failure' }>();
  const succeeded = status === 'success';
  return (
    <AuthFlowScreen title={succeeded ? 'Email verified' : 'Verification link problem'} subtitle={succeeded ? 'Your email is verified and your account is ready.' : 'This verification link is invalid or expired. Sign in to request another one.'}>
      <Text style={{ color: succeeded ? '#047857' : '#b91c1c' }}>{succeeded ? 'Verification successful.' : 'Verification was not completed.'}</Text>
      <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 18, borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: '#10b981' }}>
        <Text style={{ color: '#fff', fontWeight: '800' }}>Go to login</Text>
      </TouchableOpacity>
    </AuthFlowScreen>
  );
}
