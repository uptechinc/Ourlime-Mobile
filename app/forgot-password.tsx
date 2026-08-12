import { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity } from 'react-native';
import AuthFlowScreen from '@/components/auth/AuthFlowScreen';
import { AuthService } from '@/lib/services/AuthService';

const authService = AuthService.getInstance();

export default function ForgotPasswordScreen() {
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

  return (
    <AuthFlowScreen title="Reset password" subtitle="Enter your email and we will send a secure password-reset link.">
      <TextInput
        accessibilityLabel="Email address"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="Email address"
        value={email}
        onChangeText={setEmail}
        style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, color: '#0f172a' }}
      />
      {status === 'sent' ? <Text style={{ marginTop: 14, color: '#047857' }}>Check your inbox for the reset link.</Text> : null}
      {status === 'error' ? <Text style={{ marginTop: 14, color: '#b91c1c' }}>We could not send the reset email. Please try again.</Text> : null}
      <TouchableOpacity disabled={status === 'sending' || !email.trim()} onPress={() => void handleSubmit()} style={{ marginTop: 18, borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: '#10b981', opacity: status === 'sending' || !email.trim() ? 0.55 : 1 }}>
        {status === 'sending' ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Send reset link</Text>}
      </TouchableOpacity>
    </AuthFlowScreen>
  );
}
