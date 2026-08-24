import { useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authService, getAuthErrorCode } from '@/lib/services/AuthService';
import { pageAccessService } from '@/lib/services/PageAccessService';
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

// ─── Simple email validator ───────────────────────────────────────────────────
function validateEmail(email: string): string | null {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Please enter a valid email address.';
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [canResendVerification, setCanResendVerification] = useState(false);
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

  const getLoginErrorMessage = (code: string, fallbackMessage: string): string => {
    switch (code) {
      case 'auth/user-not-found': return 'No user found with this email.';
      case 'auth/wrong-password': return 'Incorrect password.';
      case 'auth/invalid-email': return 'The email address is not valid.';
      case 'auth/user-disabled': return 'This user account has been disabled.';
      case 'auth/too-many-requests': return 'Too many login attempts. Please try again later.';
      case 'auth/invalid-credential': return 'Invalid credentials provided.';
      case 'EMAIL_NOT_VERIFIED': return 'Verify your email before signing in. You can resend the verification message below.';
      case 'ACCOUNT_DISABLED': return 'This account is currently disabled.';
      case 'ACCOUNT_DELETED': return 'This account has been deleted.';
      case 'ACCOUNT_BANNED': return fallbackMessage;
      case 'ACCOUNT_SUSPENDED': return fallbackMessage;
      case 'BETA_ACCESS_REVOKED': return 'Your Ourlime beta access has been revoked. Contact support if you believe this is a mistake.';
      case 'BETA_ACCESS_SUSPENDED': return 'Your Ourlime beta access is currently suspended.';
      default: return fallbackMessage;
    }
  };

  // ── Validation + Submit ────────────────────────────────────────────────────
  const handleLogin = async () => {
    setErrorMsg('');
    setCanResendVerification(false);
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
    } catch (error: unknown) {
      const code = getAuthErrorCode(error);
      const fallbackMsg = error instanceof Error && error.message ? error.message : 'Failed to sign in. Please check your credentials.';
      setCanResendVerification(code === 'EMAIL_NOT_VERIFIED');
      setErrorMsg(getLoginErrorMessage(code, fallbackMsg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim() || !password || isResendingVerification) return;
    setIsResendingVerification(true);
    try {
      await authService.resendEmailVerification(email, password);
      setErrorMsg('Verification email sent. Check your inbox and spam folder, then sign in again.');
      setCanResendVerification(false);
    } catch (error: unknown) {
      const fallbackMessage = error instanceof Error ? error.message : 'Unable to resend the verification email.';
      setErrorMsg(getLoginErrorMessage(getAuthErrorCode(error), fallbackMessage));
    } finally {
      setIsResendingVerification(false);
    }
  };

  useEffect(() => {
    if (!success) return undefined;
    const navigationTimer = setTimeout(
      () => router.replace(pageAccessService.getPostAuthenticationRedirect(next) as Href),
      600,
    );
    return () => clearTimeout(navigationTimer);
  }, [next, router, success]);

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

      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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
                {canResendVerification ? (
                  <TouchableOpacity
                    disabled={isResendingVerification}
                    onPress={() => void handleResendVerification()}
                    style={{ alignSelf: 'flex-start', marginTop: 10, borderRadius: 10, backgroundColor: 'rgba(16,185,129,0.2)', paddingHorizontal: 12, paddingVertical: 9 }}
                  >
                    {isResendingVerification ? (
                      <ActivityIndicator size="small" color={GREEN} />
                    ) : (
                      <Text style={{ color: GREEN, fontWeight: '800' }}>Resend verification email</Text>
                    )}
                  </TouchableOpacity>
                ) : null}
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
                  onChangeText={(value) => {
                    setEmail(value);
                    if (emailError) setEmailError('');
                    if (canResendVerification) setCanResendVerification(false);
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
                    onChangeText={(value) => {
                      setPassword(value);
                      if (passwordError) setPasswordError('');
                      if (canResendVerification) setCanResendVerification(false);
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
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} color="rgba(255,255,255,0.65)" />
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

              {/* Public Safety, Policies & Help Links */}
              <View style={{ marginTop: 18, gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => router.push('/policies' as Href)}
                    activeOpacity={0.75}
                    style={{
                      flex: 1,
                      minHeight: 46,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.24)',
                      backgroundColor: 'rgba(255,255,255,0.09)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 10,
                    }}
                  >
                    <Ionicons name="document-text-outline" size={18} color="#fff" />
                    <Text style={{ marginLeft: 6, color: '#fff', fontSize: 14, fontWeight: '700' }}>
                      Policies
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => router.push('/child-safety-standards' as Href)}
                    activeOpacity={0.75}
                    style={{
                      flex: 1,
                      minHeight: 46,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.24)',
                      backgroundColor: 'rgba(255,255,255,0.09)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 10,
                    }}
                  >
                    <Ionicons name="shield-checkmark-outline" size={18} color={GREEN} />
                    <Text style={{ marginLeft: 6, color: '#fff', fontSize: 14, fontWeight: '700' }}>
                      Child Safety
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={() => router.push('/help' as Href)}
                  activeOpacity={0.75}
                  style={{
                    minHeight: 46,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.24)',
                    backgroundColor: 'rgba(255,255,255,0.09)',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="help-buoy-outline" size={18} color="#fff" />
                  <Text style={{ marginLeft: 8, color: '#fff', fontSize: 14, fontWeight: '700' }}>
                    Help & Support
                  </Text>
                </TouchableOpacity>
              </View>

            </Animated.View>
          </View>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
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
