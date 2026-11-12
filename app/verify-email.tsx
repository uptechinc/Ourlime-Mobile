import { Linking, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import AuthFlowScreen from '@/components/auth/AuthFlowScreen';
import { OURLIME_SITE_URL } from '@/lib/constants/site';

const GREEN = '#10b981';

/**
 * The website's /verify-email/success and /verify-email/failure pages. The emailed link (?token=&userId=) is
 * checked by the website server, so a link opened here is handed to the browser to finish verification.
 */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const { status, token, userId } = useLocalSearchParams<{ status?: string; token?: string; userId?: string }>();

  if (token && userId && !status) {
    const verificationUrl = `${OURLIME_SITE_URL}/verify-email?token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}`;
    return (
      <AuthFlowScreen iconName="mail-outline" title="Verify your email" subtitle="Finish verifying your email address in your browser, then come back and sign in.">
        <TouchableOpacity onPress={() => void Linking.openURL(verificationUrl)} style={{ borderRadius: 14, padding: 15, alignItems: 'center', backgroundColor: GREEN }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Verify email</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 12, borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Go to login</Text>
        </TouchableOpacity>
      </AuthFlowScreen>
    );
  }

  const succeeded = status === 'success';
  return (
    <AuthFlowScreen
      title={succeeded ? 'Email Verified Successfully!' : 'Verification Failed'}
      subtitle={succeeded
        ? 'Your email has been verified. You can now log in to your account and start exploring Ourlime.'
        : 'The verification link has expired or is invalid. Please request a new verification email or contact support if you continue to experience issues.'}
    >
      <View style={{ alignSelf: 'center', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 18, backgroundColor: succeeded ? '#22c55e' : '#ef4444' }}>
        {succeeded ? <Check size={32} color="#ffffff" /> : <X size={32} color="#ffffff" />}
      </View>
      {succeeded ? (
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ borderRadius: 14, padding: 15, alignItems: 'center', backgroundColor: GREEN }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Continue to login</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ gap: 12 }}>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ borderRadius: 14, padding: 15, alignItems: 'center', backgroundColor: GREEN }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Sign in to resend the email</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(auth)/register')} style={{ borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Try Registering Again</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/help')} style={{ borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      )}
    </AuthFlowScreen>
  );
}
