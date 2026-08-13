import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AuthFlowScreen from '@/components/auth/AuthFlowScreen';
import { AuthService } from '@/lib/services/AuthService';
import { getEmailProvider, openEmailApp } from '@/lib/helpers/emailProvider';

const authService = AuthService.getInstance();

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setStatus('sending');
    try {
      await authService.requestPasswordReset(email);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  const provider = getEmailProvider(email);

  return (
    <AuthFlowScreen iconName="mail-outline" title="Forgot Password?" subtitle="No worries! Enter your email and we'll send you a reset link.">
      {status === 'sent' ? (
        <View style={{ alignItems: 'center', width: '100%' }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 8 }}>
            Check Your Email
          </Text>
          <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
            We've sent a password reset link to <Text style={{ color: '#10b981', fontWeight: '700' }}>{email}</Text>. Check your inbox or spam folder.
          </Text>

          {/* Open Email Client Button (Gmail / Outlook / Yahoo / Apple Mail / Proton / Email) */}
          <TouchableOpacity
            onPress={() => void openEmailApp(email)}
            style={{
              width: '100%',
              borderRadius: 30,
              paddingVertical: 16,
              alignItems: 'center',
              backgroundColor: '#10b981',
              marginBottom: 14,
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              shadowColor: '#10b981',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            <Ionicons name="open-outline" size={20} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>
              {provider.buttonLabel}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setStatus('idle')}
            style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
          >
            <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 14 }}>Try a different email</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={{ marginBottom: 18 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#cbd5e1', marginBottom: 8 }}>Email Address</Text>
            <TextInput
              accessibilityLabel="Email address"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="Enter your email"
              placeholderTextColor="#64748b"
              value={email}
              onChangeText={setEmail}
              style={{
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.15)',
                borderRadius: 14,
                paddingHorizontal: 16,
                paddingVertical: 14,
                color: '#ffffff',
                fontSize: 15,
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
              }}
            />
          </View>

          {status === 'error' ? (
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.18)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', padding: 12, borderRadius: 12, marginBottom: 16 }}>
              <Text style={{ color: '#fca5a5', fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
                We could not send the reset email. Please make sure the email is correct and try again.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            disabled={status === 'sending' || !email.trim()}
            onPress={() => void handleSubmit()}
            style={{
              marginTop: 6,
              borderRadius: 30,
              paddingVertical: 16,
              alignItems: 'center',
              backgroundColor: '#10b981',
              opacity: status === 'sending' || !email.trim() ? 0.5 : 1,
              shadowColor: '#10b981',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            {status === 'sending' ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>Reset Password</Text>
            )}
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 24, alignItems: 'center' }}>
        <Text style={{ color: '#64748b', fontSize: 14 }}>
          Remember your password? <Text style={{ color: '#10b981', fontWeight: '700' }}>Back to Login</Text>
        </Text>
      </TouchableOpacity>
    </AuthFlowScreen>
  );
}

