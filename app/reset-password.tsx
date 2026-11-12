import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AuthFlowScreen from '@/components/auth/AuthFlowScreen';
import { AuthService } from '@/lib/services/AuthService';

const authService = AuthService.getInstance();

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { oobCode } = useLocalSearchParams<{ oobCode?: string }>();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [status, setStatus] = useState<'validating' | 'ready' | 'saving' | 'saved' | 'invalid' | 'error'>('validating');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!oobCode) {
      setStatus('invalid');
      return;
    }
    void authService.validatePasswordResetCode(oobCode).then(() => setStatus('ready')).catch(() => setStatus('invalid'));
  }, [oobCode]);

  // After a successful reset the website returns to login after three seconds; so does the app.
  useEffect(() => {
    if (status !== 'saved') return undefined;
    const loginTimer = setTimeout(() => router.replace('/(auth)/login'), 3000);
    return () => clearTimeout(loginTimer);
  }, [router, status]);

  const handleReset = async () => {
    if (!oobCode || password.length < 8 || password !== confirmation) return;
    setStatus('saving');
    setErrorMessage('');
    try {
      await authService.resetPassword(oobCode, password);
      setStatus('saved');
    } catch (error: unknown) {
      console.error('[ResetPasswordScreen.handleReset] Error:', error instanceof Error ? error.message : error);
      setErrorMessage(authService.getPasswordResetErrorMessage(error));
      setStatus('error');
    }
  };

  return (
    <AuthFlowScreen iconName="lock-closed-outline" title="Set New Password" subtitle="Enter your new password below. Use at least eight characters.">
      {status === 'validating' ? (
        <View accessibilityLabel="Validating reset link" style={{ paddingVertical: 4 }}>
          <Skeleton width={110} height={13} />
          <Skeleton height={50} borderRadius={14} style={{ marginTop: 8, marginBottom: 16 }} />
          <Skeleton width={150} height={13} />
          <Skeleton height={50} borderRadius={14} style={{ marginTop: 8, marginBottom: 18 }} />
          <Skeleton height={54} borderRadius={30} />
        </View>
      ) : null}

      {status === 'invalid' ? (
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(239, 68, 68, 0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ionicons name="alert-circle-outline" size={28} color="#fca5a5" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 6 }}>Invalid or Expired Link</Text>
          <Text style={{ color: '#94a3b8', textAlign: 'center', fontSize: 14, marginBottom: 20 }}>
            This reset link is invalid or has expired. Please request a new link.
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/forgot-password')}
            style={{ width: '100%', borderRadius: 30, paddingVertical: 14, alignItems: 'center', backgroundColor: '#10b981' }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>Request New Link</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {status === 'saved' ? (
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(16, 185, 129, 0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ionicons name="checkmark-circle-outline" size={28} color="#10b981" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#ffffff', textAlign: 'center', marginBottom: 6 }}>Password Reset Successful</Text>
          <Text style={{ color: '#94a3b8', textAlign: 'center', fontSize: 14, marginBottom: 20 }}>
            Your password was updated. Taking you to login…
          </Text>
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            style={{ width: '100%', borderRadius: 30, paddingVertical: 14, alignItems: 'center', backgroundColor: '#10b981' }}
          >
            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>Return to Login</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {status === 'ready' || status === 'saving' || status === 'error' ? (
        <>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#cbd5e1', marginBottom: 8 }}>New Password</Text>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput
                secureTextEntry={!showPassword}
                placeholder="Enter new password"
                placeholderTextColor="#64748b"
                value={password}
                onChangeText={setPassword}
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  paddingRight: 48,
                  color: '#ffffff',
                  fontSize: 15,
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: 14, padding: 4 }}
              >
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#cbd5e1', marginBottom: 8 }}>Confirm New Password</Text>
            <View style={{ position: 'relative', justifyContent: 'center' }}>
              <TextInput
                secureTextEntry={!showConfirmation}
                placeholder="Confirm new password"
                placeholderTextColor="#64748b"
                value={confirmation}
                onChangeText={setConfirmation}
                style={{
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 14,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  paddingRight: 48,
                  color: '#ffffff',
                  fontSize: 15,
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                }}
              />
              <TouchableOpacity
                onPress={() => setShowConfirmation(!showConfirmation)}
                style={{ position: 'absolute', right: 14, padding: 4 }}
              >
                <Ionicons name={showConfirmation ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {password && password.length < 8 ? (
            <Text style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>Password must contain at least eight characters.</Text>
          ) : null}
          {confirmation && confirmation !== password ? (
            <Text style={{ color: '#fca5a5', fontSize: 12, marginBottom: 10 }}>Passwords do not match.</Text>
          ) : null}
          {status === 'error' ? (
            <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.18)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', padding: 12, borderRadius: 12, marginBottom: 14 }}>
              <Text style={{ color: '#fca5a5', fontSize: 13, textAlign: 'center' }}>
                {errorMessage || 'Something went wrong. Please try again.'}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            disabled={status === 'saving' || password.length < 8 || password !== confirmation}
            onPress={() => void handleReset()}
            style={{
              marginTop: 8,
              borderRadius: 30,
              paddingVertical: 16,
              alignItems: 'center',
              backgroundColor: '#10b981',
              opacity: status === 'saving' || password.length < 8 || password !== confirmation ? 0.5 : 1,
              shadowColor: '#10b981',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 6,
            }}
          >
            {status === 'saving' ? (
              <Skeleton width={130} height={18} borderRadius={9} />
            ) : (
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 16 }}>Update Password</Text>
            )}
          </TouchableOpacity>
        </>
      ) : null}

      <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 24, alignItems: 'center' }}>
        <Text style={{ color: '#64748b', fontSize: 14 }}>
          Remember your password? <Text style={{ color: '#10b981', fontWeight: '700' }}>Back to Login</Text>
        </Text>
      </TouchableOpacity>
    </AuthFlowScreen>
  );
}

