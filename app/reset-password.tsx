import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AuthFlowScreen from '@/components/auth/AuthFlowScreen';
import { AuthService } from '@/lib/services/AuthService';

const authService = AuthService.getInstance();

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { oobCode } = useLocalSearchParams<{ oobCode?: string }>();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<'validating' | 'ready' | 'saving' | 'saved' | 'invalid' | 'error'>('validating');

  useEffect(() => {
    if (!oobCode) {
      setStatus('invalid');
      return;
    }
    void authService.validatePasswordResetCode(oobCode).then(() => setStatus('ready')).catch(() => setStatus('invalid'));
  }, [oobCode]);

  const handleReset = async () => {
    if (!oobCode || password.length < 8 || password !== confirmation) return;
    setStatus('saving');
    try {
      await authService.resetPassword(oobCode, password);
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  };

  return (
    <AuthFlowScreen title="Choose a new password" subtitle="Use at least eight characters and keep this password private.">
      {status === 'validating' ? <ActivityIndicator color="#10b981" /> : null}
      {status === 'invalid' ? <Text style={{ color: '#b91c1c' }}>This reset link is invalid or has expired.</Text> : null}
      {status === 'saved' ? (
        <>
          <Text style={{ color: '#047857' }}>Your password was updated.</Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 18, borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: '#10b981' }}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Return to login</Text>
          </TouchableOpacity>
        </>
      ) : null}
      {status === 'ready' || status === 'saving' || status === 'error' ? (
        <>
          <TextInput secureTextEntry placeholder="New password" value={password} onChangeText={setPassword} style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, padding: 13, marginBottom: 12 }} />
          <TextInput secureTextEntry placeholder="Confirm password" value={confirmation} onChangeText={setConfirmation} style={{ borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, padding: 13 }} />
          {password && password.length < 8 ? <Text style={{ color: '#b91c1c', marginTop: 10 }}>Password must contain at least eight characters.</Text> : null}
          {confirmation && confirmation !== password ? <Text style={{ color: '#b91c1c', marginTop: 10 }}>Passwords do not match.</Text> : null}
          {status === 'error' ? <Text style={{ color: '#b91c1c', marginTop: 10 }}>Password reset failed. Request a new link and try again.</Text> : null}
          <TouchableOpacity disabled={status === 'saving' || password.length < 8 || password !== confirmation} onPress={() => void handleReset()} style={{ marginTop: 18, borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: '#10b981', opacity: status === 'saving' || password.length < 8 || password !== confirmation ? 0.55 : 1 }}>
            {status === 'saving' ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Update password</Text>}
          </TouchableOpacity>
        </>
      ) : null}
    </AuthFlowScreen>
  );
}
