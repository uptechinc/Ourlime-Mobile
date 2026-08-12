import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Image,
  type TextStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authService, getAuthErrorCode } from '@/lib/services/AuthService';
import type { Href } from 'expo-router';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

// Background SVG
import BackgroundSVG from '../../assets/images/login/mobileBackground.svg';

// ─── Constants ────────────────────────────────────────────────────────────────
const GREEN = '#01eb53';
const GREEN_DARK = '#10b981';

// ─── Eye icons (inline SVG-based via text) ────────────────────────────────────
const EyeIcon = () => (
  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }}>👁</Text>
);
const EyeOffIcon = () => (
  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 18 }}>🙈</Text>
);

// ─── Simple email validator ───────────────────────────────────────────────────
function validateEmail(email: string): string | null {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Please enter a valid email address.';
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Error state
  const [errorMsg, setErrorMsg] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Button press animation
  const btnScale = useSharedValue(1);
  const btnAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  const handlePressIn = () => {
    btnScale.value = withSpring(0.97, { damping: 15 });
  };
  const handlePressOut = () => {
    btnScale.value = withSpring(1, { damping: 15 });
  };

  // ── Validation + Submit ────────────────────────────────────────────────────
  const handleLogin = async () => {
    setErrorMsg('');
    setEmailError('');
    setPasswordError('');

    let valid = true;

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError('Email is required.');
      valid = false;
    } else {
      const err = validateEmail(trimmedEmail);
      if (err) {
        setEmailError(err);
        valid = false;
      }
    }

    if (password.length < 8) {
      setPasswordError('Password should be at least 8 characters.');
      valid = false;
    }

    if (!valid) return;

    setIsSubmitting(true);

    try {
      await authService.login(trimmedEmail, password);
      setSuccess(true);
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 600);
    } catch (error: unknown) {
      const errorMessages: Record<string, string> = {
        'auth/user-not-found': 'No user found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-email': 'The email address is not valid.',
        'auth/user-disabled': 'This user account has been disabled.',
        'auth/too-many-requests': 'Too many login attempts. Please try again later.',
        'auth/invalid-credential': 'Invalid credentials provided.',
        EMAIL_NOT_VERIFIED: 'Verify your email before signing in. We sent a new verification email.',
        ACCOUNT_DISABLED: 'This account is currently disabled.',
        ACCOUNT_DELETED: 'This account has been deleted.',
      };
      setErrorMsg(errorMessages[getAuthErrorCode(error)] || 'Failed to sign in. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flex: 1 }}>
        <BackgroundSVG width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
        {/* Gradient overlay matching web: bg-black/35 backdrop-blur */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.38)',
          }}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40, maxWidth: 440, width: '100%', alignSelf: 'center' }}>

            {/* ── Logo & Title ── */}
            <Animated.View entering={FadeInDown.duration(500).delay(100)}>
              {/* "Welcome back to Ourlime" */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff' }}>
                  Welcome back to
                </Text>
                <Image
                  source={require('../../assets/transparentLogo.png')}
                  style={{ width: 22, height: 22, marginLeft: 8, marginRight: 4 }}
                  resizeMode="contain"
                />
                <Text style={{ fontSize: 17, fontWeight: '700', color: GREEN }}>Ourlime</Text>
              </View>

              {/* "Sign back in." */}
              <Text
                style={{
                  fontSize: 36,
                  fontWeight: '800',
                  color: '#fff',
                  marginBottom: 8,
                  letterSpacing: -0.5,
                }}
              >
                Sign back in.
              </Text>

              {/* "Don't have an account?" */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.8)' }}>
                  Don't have an account?
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('/(auth)/register')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: GREEN,
                      marginLeft: 6,
                    }}
                  >
                    Sign Up
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* ── Error Banner ── */}
            {errorMsg ? (
              <Animated.View
                entering={FadeInDown.duration(300)}
                style={{
                  marginTop: 20,
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: 'rgba(239,68,68,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(239,68,68,0.22)',
                }}
              >
                <Text style={{ color: '#ef4444', fontSize: 13 }}>{errorMsg}</Text>
              </Animated.View>
            ) : null}

            {/* ── Form ── */}
            <Animated.View entering={FadeInDown.duration(500).delay(200)} style={{ marginTop: 28 }}>

              {/* Email */}
              <View style={{ marginBottom: 16 }}>
                <TextInput
                  style={[inputStyle, emailError ? { borderColor: 'rgba(239,68,68,0.6)' } : {}]}
                  placeholder="Email Address"
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  value={email}
                  onChangeText={(v) => {
                    setEmail(v);
                    if (emailError) setEmailError('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
                {emailError ? (
                  <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4, marginLeft: 2 }}>
                    {emailError}
                  </Text>
                ) : null}
              </View>

              {/* Password */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={[
                      inputStyle,
                      { paddingRight: 50 },
                      passwordError ? { borderColor: 'rgba(239,68,68,0.6)' } : {},
                    ]}
                    placeholder="Password"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={password}
                    onChangeText={(v) => {
                      setPassword(v);
                      if (passwordError) setPasswordError('');
                    }}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: 0,
                      bottom: 0,
                      justifyContent: 'center',
                    }}
                    onPress={() => setShowPassword(!showPassword)}
                    activeOpacity={0.7}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </TouchableOpacity>
                </View>
                {passwordError ? (
                  <Text style={{ color: '#ef4444', fontSize: 12, marginTop: 4, marginLeft: 2 }}>
                    {passwordError}
                  </Text>
                ) : null}
              </View>

              {/* Forgot Password */}
              <TouchableOpacity
                onPress={() => router.push('/forgot-password' as Href)}
                activeOpacity={0.7}
                style={{ marginBottom: 28 }}
              >
                <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.75)' }}>
                  Forgot password?
                </Text>
              </TouchableOpacity>

              {/* Login Button */}
              <Animated.View style={btnAnimStyle}>
                <TouchableOpacity
                  onPress={handleLogin}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  disabled={isSubmitting || success}
                  activeOpacity={0.9}
                  style={[
                    {
                      backgroundColor: success ? GREEN_DARK : GREEN,
                      borderRadius: 14,
                      paddingVertical: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      // Glow effect
                      shadowColor: GREEN,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: isSubmitting || success ? 0.2 : 0.45,
                      shadowRadius: 14,
                      elevation: 8,
                    },
                    (isSubmitting || success) && { opacity: 0.85 },
                  ]}
                >
                  {success ? (
                    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>✓ Logged in!</Text>
                  ) : isSubmitting ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginLeft: 8 }}>
                        Signing in…
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>Login</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>

            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Shared input style ────────────────────────────────────────────────────────
const inputStyle: TextStyle = {
  width: '100%',
  borderRadius: 14,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.14)',
  backgroundColor: 'rgba(255,255,255,0.10)',
  paddingHorizontal: 16,
  paddingVertical: 14,
  color: '#fff',
  fontSize: 15,
  fontWeight: '500',
};
