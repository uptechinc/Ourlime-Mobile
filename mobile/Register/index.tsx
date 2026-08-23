import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  StatusBar,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { authService } from '@/lib/services/AuthService';
import { ApiService } from '@/lib/services/ApiService';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { cartoonAvatars, realisticAvatars } from './registrationAvatars';
import BetaAccessView, { type BetaAccessState } from '@/components/auth/BetaAccessView';
import TermsModal from '@/components/auth/TermsModal';
import PrivacyModal from '@/components/auth/PrivacyModal';
import ChildSafetyPolicyModal from '@/components/auth/ChildSafetyPolicyModal';

// ─── Constants ────────────────────────────────────────────────────────────────
const GREEN = '#01eb53';
const GREEN_DARK = '#10b981';
const TOTAL_STEPS = 7; // Steps 1 to 7 (Step 0 is Welcome)

type AvatarType = 'cartoon' | 'realistic';

type FormData = {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: 'student' | 'regular' | '';
  studentLevel: string;
  gender: string;
  dateOfBirth: string;
  country: string;
  phone: string;
  city: string;
  profilePicture: string | null;
  selectedInterests: string[];
  verificationType: 'student_id' | 'national_id' | 'guardian' | 'drivers_license' | 'skipped' | '';
  guardianEmail: string;
};

type RegistrationErrorField = keyof FormData | 'terms' | 'privacy' | 'childSafety' | 'interests' | 'global';
type RegistrationErrors = Partial<Record<RegistrationErrorField, string>>;

const INTERESTS = [
  'Technology', 'Music', 'Sports', 'Art', 'Travel', 'Food', 'Gaming',
  'Fitness', 'Photography', 'Fashion', 'Education', 'Business',
  'Environment', 'Health', 'Science', 'Politics', 'Entertainment',
];

const STUDENT_LEVELS = [
  'Secondary / High School',
  'Undergraduate / College',
  'Postgraduate / Master\'s / PhD',
  'Vocational / Trade School',
  'Other Student',
];

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'];

export default function Register() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const referralToken = (searchParams.referralToken as string) || '';

  // Beta Access State
  const [registrationAccess, setRegistrationAccess] = useState<'loading' | 'allowed' | BetaAccessState>('loading');

  // Step state (0: Welcome, 1: Account Type, 2: Basic Info, 3: Demographics, 4: Location, 5: Avatar, 6: Interests, 7: Verification)
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals & Availability
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isChildSafetyOpen, setIsChildSafetyOpen] = useState(false);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [isPrivacyAccepted, setIsPrivacyAccepted] = useState(false);
  const [isChildSafetyAccepted, setIsChildSafetyAccepted] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Username / Email Availability
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailExistsError, setEmailExistsError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameExistsError, setUsernameExistsError] = useState('');
  const emailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Avatar tab
  const [activeTab, setActiveTab] = useState<AvatarType>('cartoon');

  // Form Data
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    userName: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: '',
    studentLevel: '',
    gender: '',
    dateOfBirth: '',
    country: 'Trinidad & Tobago',
    phone: '',
    city: '',
    profilePicture: null,
    selectedInterests: [],
    verificationType: 'skipped',
    guardianEmail: '',
  });

  const [errors, setErrors] = useState<RegistrationErrors>({});

  // ── Beta Registration Access Check ───────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const checkBetaAccess = async () => {
      try {
        const response = await ApiService.getInstance().request<{ success?: boolean; mode?: 'open' | 'invite_only' | 'closed' }>(
          '/api/beta/registration-mode',
          { signal: controller.signal }
        );
        const mode = response?.mode || 'invite_only';
        if (cancelled) return;

        if (mode === 'closed') { setRegistrationAccess('closed'); return; }
        if (mode === 'open') { setRegistrationAccess('allowed'); return; }

        if (!referralToken) {
          setRegistrationAccess('invite_required');
          return;
        }

        const tokenRes = await ApiService.getInstance().request<{ valid?: boolean; reason?: string }>(
          `/api/beta/validate-token?token=${encodeURIComponent(referralToken)}`,
          { signal: controller.signal }
        );
        if (cancelled) return;

        if (!tokenRes?.valid) {
          const supported: BetaAccessState[] = ['invalid', 'expired', 'revoked', 'used'];
          setRegistrationAccess(supported.includes(tokenRes?.reason as BetaAccessState) ? (tokenRes?.reason as BetaAccessState) : 'invalid');
          return;
        }
        setRegistrationAccess('allowed');
      } catch {
        if (!cancelled) {
          setRegistrationAccess(referralToken ? 'allowed' : 'invite_required');
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    void checkBetaAccess();
    return () => { cancelled = true; controller.abort(); clearTimeout(timeoutId); };
  }, [referralToken]);

  // ── Real-time Email & Username Checks ─────────────────────────────────────
  const handleEmailChange = (val: string) => {
    updateField('email', val);
    setEmailExistsError('');
    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
    const trimmed = val.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setIsCheckingEmail(true);
      emailDebounceRef.current = setTimeout(async () => {
        try {
          const res = await ApiService.getInstance().request<{ available?: boolean }>('/api/auth/registration-availability', {
            method: 'POST', body: { email: trimmed },
          });
          if (res && res.available === false) {
            setEmailExistsError('This email is already registered.');
          }
        } catch {
          // Ignore network failures gracefully
        } finally {
          setIsCheckingEmail(false);
        }
      }, 500);
    } else {
      setIsCheckingEmail(false);
    }
  };

  const handleUsernameChange = (val: string) => {
    updateField('userName', val);
    setUsernameExistsError('');
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    const trimmed = val.trim();
    if (trimmed.length >= 3) {
      setIsCheckingUsername(true);
      usernameDebounceRef.current = setTimeout(async () => {
        try {
          const res = await ApiService.getInstance().request<{ available?: boolean }>('/api/auth/registration-availability', {
            method: 'POST', body: { username: trimmed },
          });
          if (res && res.available === false) {
            setUsernameExistsError('Username is already taken.');
          }
        } catch {
          // Ignore network failures gracefully
        } finally {
          setIsCheckingUsername(false);
        }
      }, 500);
    } else {
      setIsCheckingUsername(false);
    }
  };

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // ── Step Validation ────────────────────────────────────────────────────────
  const validateStep = (): boolean => {
    const newErrors: RegistrationErrors = {};

    if (step === 1) {
      if (!formData.accountType) newErrors.accountType = 'Please select an account type.';
    }

    if (step === 2) {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required.';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required.';
      if (!formData.userName.trim()) newErrors.userName = 'Username is required.';
      else if (usernameExistsError) newErrors.userName = usernameExistsError;

      if (!formData.email.trim()) newErrors.email = 'Email is required.';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email address.';
      else if (emailExistsError) newErrors.email = emailExistsError;

      if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters.';
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
      if (!isTermsAccepted) newErrors.terms = 'You must accept the Terms and Conditions.';
      if (!isPrivacyAccepted) newErrors.privacy = 'You must accept the Privacy Policy.';
      if (!isChildSafetyAccepted) newErrors.childSafety = 'You must accept the Child Safety Standards Policy.';
    }

    if (step === 3) {
      if (!formData.dateOfBirth.trim()) newErrors.dateOfBirth = 'Date of birth is required.';
      if (!formData.gender) newErrors.gender = 'Please select a gender.';
      if (formData.accountType === 'student' && !formData.studentLevel) {
        newErrors.studentLevel = 'Please select your student level.';
      }
    }

    if (step === 4) {
      if (!formData.country.trim()) newErrors.country = 'Country is required.';
      if (!formData.phone.trim()) newErrors.phone = 'Phone number is required.';
    }

    if (step === 5) {
      if (!formData.profilePicture) newErrors.profilePicture = 'Please select an avatar or upload a picture.';
    }

    if (step === 6) {
      if (formData.selectedInterests.length < 3) newErrors.interests = 'Please select at least 3 interests.';
    }

    if (step === 7 && formData.verificationType === 'guardian') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guardianEmail.trim())) {
        newErrors.guardianEmail = 'Enter a valid parent or guardian email address.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => Math.max(s - 1, 0));
  };

  // ── Final Registration Submit ─────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateStep()) return;
    setIsSubmitting(true);
    try {
      await authService.register({
        ...formData,
        referralToken,
        policyAcknowledgements: {
          terms: isTermsAccepted,
          privacy: isPrivacyAccepted,
          childSafety: isChildSafetyAccepted,
        },
      });
      setShowSuccessModal(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Registration failed. Please try again.';
      setErrors({ global: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!res.canceled && res.assets[0]?.uri) {
      updateField('profilePicture', res.assets[0].uri);
    }
  };

  const toggleInterest = (interest: string) => {
    const current = formData.selectedInterests;
    const next = current.includes(interest)
      ? current.filter(i => i !== interest)
      : [...current, interest];
    updateField('selectedInterests', next);
  };

  // ── Render Guard ──────────────────────────────────────────────────────────
  if (registrationAccess === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (registrationAccess !== 'allowed') {
    return <BetaAccessView state={registrationAccess} />;
  }

  // Step Labels & Progress
  const stepLabels = ['', 'Account Type', 'Basic Info', 'Demographics', 'Location', 'Avatar', 'Interests', 'Verification'];
  const progress = step > 0 ? step / TOTAL_STEPS : 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Header & Back Button */}
      <View style={{ paddingTop: 50, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity
          onPress={step === 0 ? () => router.replace('/(auth)/login') : handleBack}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }}
        >
          <Ionicons name="arrow-back" size={16} color="#ffffff" style={{ marginRight: 6 }} />
          <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '600' }}>
            {step === 0 ? 'Back to Login' : 'Back'}
          </Text>
        </TouchableOpacity>

        {step > 0 && (
          <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600' }}>
            Step {step} of {TOTAL_STEPS} — {stepLabels[step]}
          </Text>
        )}
      </View>

      {/* Progress Bar */}
      {step > 0 && (
        <View style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.1)', width: '100%' }}>
          <View style={{ height: 3, backgroundColor: GREEN_DARK, width: `${progress * 100}%` }} />
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          
          {/* Main Glass Card */}
          <View style={styles.glassCard}>

            {/* Error Banner */}
            {errors.global ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                <Text style={{ color: '#ef4444', fontSize: 13, flex: 1 }}>{errors.global}</Text>
              </View>
            ) : null}

            {/* ── STEP 0: Welcome Step ── */}
            {step === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 10 }}>
                <Image source={require('../../assets/transparentLogo.png')} style={{ width: 80, height: 80, marginBottom: 16 }} resizeMode="contain" />
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#ffffff', textAlign: 'center' }}>
                  Welcome to Ourlime 🇹🇹
                </Text>
                <Text style={{ fontSize: 15, color: '#cbd5e1', textAlign: 'center', marginTop: 8, marginBottom: 24 }}>
                  A safer social network built for real people.
                </Text>

                <View style={{ width: '100%', gap: 12, marginBottom: 28 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Ionicons name="time-outline" size={22} color={GREEN_DARK} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>Quick & Easy</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>Estimated setup time: 2–3 minutes</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                      <Ionicons name="shield-checkmark-outline" size={22} color={GREEN_DARK} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 16 }}>Safe & Secure</Text>
                      <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>Your privacy and security are our priority</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity onPress={() => setStep(1)} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Get Started ✨</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 20 }}>
                  <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
                    Already have an account? <Text style={{ color: GREEN_DARK, fontWeight: '700' }}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 1: Account Type ── */}
            {step === 1 && (
              <View>
                <Text style={styles.stepTitle}>Who Are You?</Text>
                <Text style={styles.stepSubtitle}>Select your account type to personalize your experience.</Text>

                <View style={{ gap: 14, marginTop: 16, marginBottom: 24 }}>
                  <Pressable
                    onPress={() => updateField('accountType', 'student')}
                    style={[styles.typeCard, formData.accountType === 'student' && styles.typeCardActive]}
                  >
                    <View style={[styles.typeIconBox, formData.accountType === 'student' && { backgroundColor: GREEN_DARK }]}>
                      <Ionicons name="school-outline" size={26} color={formData.accountType === 'student' ? '#000' : GREEN_DARK} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.typeCardTitle, formData.accountType === 'student' && { color: GREEN }]}>Student Account</Text>
                      <Text style={styles.typeCardDesc}>Join your school's network and connect with classmates.</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => updateField('accountType', 'regular')}
                    style={[styles.typeCard, formData.accountType === 'regular' && styles.typeCardActive]}
                  >
                    <View style={[styles.typeIconBox, formData.accountType === 'regular' && { backgroundColor: '#3b82f6' }]}>
                      <Ionicons name="person-outline" size={26} color={formData.accountType === 'regular' ? '#fff' : '#3b82f6'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.typeCardTitle, formData.accountType === 'regular' && { color: '#3b82f6' }]}>Regular User</Text>
                      <Text style={styles.typeCardDesc}>Connect with friends, create communities, and lime!</Text>
                    </View>
                  </Pressable>
                </View>

                {errors.accountType ? <Text style={styles.fieldError}>{errors.accountType}</Text> : null}

                <TouchableOpacity onPress={handleNext} disabled={!formData.accountType} style={[styles.primaryButton, !formData.accountType && { opacity: 0.5 }]}>
                  <Text style={styles.primaryButtonText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 2: Basic Info ── */}
            {step === 2 && (
              <View>
                <Text style={styles.stepTitle}>Basic Information</Text>
                <Text style={styles.stepSubtitle}>Enter your account details to get started.</Text>

                <View style={{ gap: 12, marginTop: 14 }}>
                  {/* First Name & Last Name */}
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        placeholder="First Name"
                        placeholderTextColor="#64748b"
                        value={formData.firstName}
                        onChangeText={v => updateField('firstName', v)}
                        style={styles.input}
                      />
                      {errors.firstName ? <Text style={styles.fieldError}>{errors.firstName}</Text> : null}
                    </View>

                    <View style={{ flex: 1 }}>
                      <TextInput
                        placeholder="Last Name"
                        placeholderTextColor="#64748b"
                        value={formData.lastName}
                        onChangeText={v => updateField('lastName', v)}
                        style={styles.input}
                      />
                      {errors.lastName ? <Text style={styles.fieldError}>{errors.lastName}</Text> : null}
                    </View>
                  </View>

                  {/* Username */}
                  <View>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        placeholder="Username"
                        placeholderTextColor="#64748b"
                        autoCapitalize="none"
                        value={formData.userName}
                        onChangeText={handleUsernameChange}
                        style={styles.input}
                      />
                      {isCheckingUsername && <ActivityIndicator color={GREEN_DARK} size="small" style={{ position: 'absolute', right: 14, top: 14 }} />}
                    </View>
                    {errors.userName ? <Text style={styles.fieldError}>{errors.userName}</Text> : null}
                  </View>

                  {/* Email */}
                  <View>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        placeholder="Email Address"
                        placeholderTextColor="#64748b"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={formData.email}
                        onChangeText={handleEmailChange}
                        style={styles.input}
                      />
                      {isCheckingEmail && <ActivityIndicator color={GREEN_DARK} size="small" style={{ position: 'absolute', right: 14, top: 14 }} />}
                    </View>
                    {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
                  </View>

                  {/* Password & Confirm */}
                  <TextInput
                    placeholder="Password (min 8 chars)"
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    value={formData.password}
                    onChangeText={v => updateField('password', v)}
                    style={styles.input}
                  />
                  {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}

                  <TextInput
                    placeholder="Confirm Password"
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    value={formData.confirmPassword}
                    onChangeText={v => updateField('confirmPassword', v)}
                    style={styles.input}
                  />
                  {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text> : null}

                  {/* Terms & Privacy Toggles */}
                  <View style={{ marginTop: 8, gap: 10 }}>
                    <TouchableOpacity onPress={() => setIsTermsAccepted(!isTermsAccepted)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name={isTermsAccepted ? 'checkbox' : 'square-outline'} size={20} color={isTermsAccepted ? GREEN_DARK : '#64748b'} />
                      <Text style={{ color: '#cbd5e1', fontSize: 13, flex: 1 }}>
                        I accept the <Text onPress={() => setIsTermsOpen(true)} style={{ color: GREEN_DARK, fontWeight: '700', textDecorationLine: 'underline' }}>Terms and Conditions</Text>
                      </Text>
                    </TouchableOpacity>
                    {errors.terms ? <Text style={styles.fieldError}>{errors.terms}</Text> : null}

                    <TouchableOpacity onPress={() => setIsPrivacyAccepted(!isPrivacyAccepted)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name={isPrivacyAccepted ? 'checkbox' : 'square-outline'} size={20} color={isPrivacyAccepted ? GREEN_DARK : '#64748b'} />
                      <Text style={{ color: '#cbd5e1', fontSize: 13, flex: 1 }}>
                        I accept the <Text onPress={() => setIsPrivacyOpen(true)} style={{ color: GREEN_DARK, fontWeight: '700', textDecorationLine: 'underline' }}>Privacy Policy</Text>
                      </Text>
                    </TouchableOpacity>
                    {errors.privacy ? <Text style={styles.fieldError}>{errors.privacy}</Text> : null}

                    <TouchableOpacity onPress={() => setIsChildSafetyAccepted(!isChildSafetyAccepted)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <Ionicons name={isChildSafetyAccepted ? 'checkbox' : 'square-outline'} size={20} color={isChildSafetyAccepted ? GREEN_DARK : '#64748b'} />
                      <Text style={{ color: '#cbd5e1', fontSize: 13, flex: 1 }}>
                        I accept the <Text onPress={() => setIsChildSafetyOpen(true)} style={{ color: GREEN_DARK, fontWeight: '700', textDecorationLine: 'underline' }}>Child Safety Standards Policy</Text>
                      </Text>
                    </TouchableOpacity>
                    {errors.childSafety ? <Text style={styles.fieldError}>{errors.childSafety}</Text> : null}
                  </View>
                </View>

                <TouchableOpacity onPress={handleNext} style={[styles.primaryButton, { marginTop: 20 }]}>
                  <Text style={styles.primaryButtonText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 3: Demographics ── */}
            {step === 3 && (
              <View>
                <Text style={styles.stepTitle}>Demographics</Text>
                <Text style={styles.stepSubtitle}>Tell us a bit about yourself.</Text>

                <View style={{ gap: 14, marginTop: 14 }}>
                  {/* Date of Birth */}
                  <View>
                    <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
                    <TextInput
                      placeholder="2000-01-01"
                      placeholderTextColor="#64748b"
                      value={formData.dateOfBirth}
                      onChangeText={v => updateField('dateOfBirth', v)}
                      style={styles.input}
                    />
                    {errors.dateOfBirth ? <Text style={styles.fieldError}>{errors.dateOfBirth}</Text> : null}
                  </View>

                  {/* Gender Selection */}
                  <View>
                    <Text style={styles.label}>Gender</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {GENDERS.map(g => (
                        <TouchableOpacity
                          key={g}
                          onPress={() => updateField('gender', g)}
                          style={[styles.chip, formData.gender === g && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, formData.gender === g && styles.chipTextActive]}>{g}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {errors.gender ? <Text style={styles.fieldError}>{errors.gender}</Text> : null}
                  </View>

                  {/* Student Level (If Student Account) */}
                  {formData.accountType === 'student' && (
                    <View style={{ marginTop: 6 }}>
                      <Text style={styles.label}>Student Level</Text>
                      <View style={{ gap: 8 }}>
                        {STUDENT_LEVELS.map(lvl => (
                          <TouchableOpacity
                            key={lvl}
                            onPress={() => updateField('studentLevel', lvl)}
                            style={[styles.chip, formData.studentLevel === lvl && styles.chipActive, { width: '100%', alignItems: 'center' }]}
                          >
                            <Text style={[styles.chipText, formData.studentLevel === lvl && styles.chipTextActive]}>{lvl}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      {errors.studentLevel ? <Text style={styles.fieldError}>{errors.studentLevel}</Text> : null}
                    </View>
                  )}
                </View>

                <TouchableOpacity onPress={handleNext} style={[styles.primaryButton, { marginTop: 24 }]}>
                  <Text style={styles.primaryButtonText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 4: Location & Contact ── */}
            {step === 4 && (
              <View>
                <Text style={styles.stepTitle}>Location & Contact</Text>
                <Text style={styles.stepSubtitle}>Help us connect you locally.</Text>

                <View style={{ gap: 14, marginTop: 14 }}>
                  <View>
                    <Text style={styles.label}>Country</Text>
                    <TextInput
                      placeholder="Country"
                      placeholderTextColor="#64748b"
                      value={formData.country}
                      onChangeText={v => updateField('country', v)}
                      style={styles.input}
                    />
                    {errors.country ? <Text style={styles.fieldError}>{errors.country}</Text> : null}
                  </View>

                  <View>
                    <Text style={styles.label}>Phone Number</Text>
                    <TextInput
                      placeholder="+1 (868) 000-0000"
                      placeholderTextColor="#64748b"
                      keyboardType="phone-pad"
                      value={formData.phone}
                      onChangeText={v => updateField('phone', v)}
                      style={styles.input}
                    />
                    {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}
                  </View>

                  <View>
                    <Text style={styles.label}>City / Town</Text>
                    <TextInput
                      placeholder="Port of Spain"
                      placeholderTextColor="#64748b"
                      value={formData.city}
                      onChangeText={v => updateField('city', v)}
                      style={styles.input}
                    />
                  </View>
                </View>

                <TouchableOpacity onPress={handleNext} style={[styles.primaryButton, { marginTop: 24 }]}>
                  <Text style={styles.primaryButtonText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 5: Avatar Selection ── */}
            {step === 5 && (
              <View>
                <Text style={styles.stepTitle}>Choose Your Avatar</Text>
                <Text style={styles.stepSubtitle}>Select a cartoon/realistic avatar or upload your photo.</Text>

                {/* Avatar Tabs */}
                <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 4, marginVertical: 14 }}>
                  <TouchableOpacity onPress={() => setActiveTab('cartoon')} style={[styles.avatarTab, activeTab === 'cartoon' && styles.avatarTabActive]}>
                    <Text style={[styles.avatarTabText, activeTab === 'cartoon' && styles.avatarTabTextActive]}>Cartoon</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setActiveTab('realistic')} style={[styles.avatarTab, activeTab === 'realistic' && styles.avatarTabActive]}>
                    <Text style={[styles.avatarTabText, activeTab === 'realistic' && styles.avatarTabTextActive]}>Realistic</Text>
                  </TouchableOpacity>
                </View>

                {/* Avatar Grid */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
                  {(activeTab === 'cartoon' ? cartoonAvatars : realisticAvatars).map((av) => (
                    <TouchableOpacity
                      key={av.id}
                      onPress={() => updateField('profilePicture', av.id)}
                      style={[styles.avatarOption, formData.profilePicture === av.id && styles.avatarOptionSelected]}
                    >
                      <Image source={av.image} style={{ width: 68, height: 68, borderRadius: 34 }} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Upload Custom Photo Option */}
                <TouchableOpacity onPress={pickImage} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 20 }}>
                  <Ionicons name="camera-outline" size={20} color={GREEN_DARK} />
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Upload Custom Photo</Text>
                </TouchableOpacity>

                {errors.profilePicture ? <Text style={styles.fieldError}>{errors.profilePicture}</Text> : null}

                <TouchableOpacity onPress={handleNext} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 6: Interests Selection ── */}
            {step === 6 && (
              <View>
                <Text style={styles.stepTitle}>Select Your Interests</Text>
                <Text style={styles.stepSubtitle}>Choose at least 3 topics you enjoy (Selected: {formData.selectedInterests.length}).</Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 16 }}>
                  {INTERESTS.map((interest) => {
                    const isSelected = formData.selectedInterests.includes(interest);
                    return (
                      <TouchableOpacity
                        key={interest}
                        onPress={() => toggleInterest(interest)}
                        style={[styles.chip, isSelected && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                          {isSelected ? '✓ ' : ''}{interest}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {errors.interests ? <Text style={styles.fieldError}>{errors.interests}</Text> : null}

                <TouchableOpacity onPress={handleNext} disabled={formData.selectedInterests.length < 3} style={[styles.primaryButton, formData.selectedInterests.length < 3 && { opacity: 0.5 }]}>
                  <Text style={styles.primaryButtonText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 7: Identity Verification & Submit ── */}
            {step === 7 && (
              <View>
                <Text style={styles.stepTitle}>Identity Verification</Text>
                <Text style={styles.stepSubtitle}>Help keep Ourlime safe by verifying your identity (optional).</Text>

                <View style={{ gap: 12, marginVertical: 16 }}>
                  {([
                    { id: 'skipped', label: 'Skip Verification for Now', desc: 'Proceed directly to registration.' },
                    { id: 'student_id', label: 'Student ID', desc: 'Choose this method now and securely submit the documents from Account Verification.' },
                    { id: 'national_id', label: 'National ID / Passport', desc: 'Choose this method now and securely submit the documents from Account Verification.' },
                    { id: 'drivers_license', label: 'Driver\'s License', desc: 'Choose this method now and securely submit the documents from Account Verification.' },
                    { id: 'guardian', label: 'Parent or Guardian', desc: 'Send a consent request to a parent or guardian.' },
                  ] as const).map((option) => (
                    <TouchableOpacity
                      key={option.id}
                      onPress={() => updateField('verificationType', option.id)}
                      style={[styles.typeCard, formData.verificationType === option.id && styles.typeCardActive]}
                    >
                      <Ionicons name={formData.verificationType === option.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={formData.verificationType === option.id ? GREEN_DARK : '#64748b'} style={{ marginRight: 10 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.typeCardTitle, formData.verificationType === option.id && { color: GREEN }]}>{option.label}</Text>
                        <Text style={styles.typeCardDesc}>{option.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {formData.verificationType === 'guardian' ? (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.label}>Guardian email address</Text>
                    <TextInput
                      autoCapitalize="none"
                      keyboardType="email-address"
                      value={formData.guardianEmail}
                      onChangeText={(value) => updateField('guardianEmail', value)}
                      placeholder="guardian@example.com"
                      placeholderTextColor="#64748b"
                      style={styles.input}
                    />
                    {errors.guardianEmail ? <Text style={styles.fieldError}>{errors.guardianEmail}</Text> : null}
                  </View>
                ) : null}

                <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting} style={styles.primaryButton}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Complete Registration 🎉</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Terms & Privacy Modals */}
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} onAccept={() => setIsTermsAccepted(true)} />
      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} onAccept={() => setIsPrivacyAccepted(true)} />
      <ChildSafetyPolicyModal isOpen={isChildSafetyOpen} onClose={() => setIsChildSafetyOpen(false)} onAccept={() => setIsChildSafetyAccepted(true)} />

      {/* Success / Email Verification Polling Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 480, backgroundColor: '#090d16', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 28, alignItems: 'center' }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="mail-unread" size={36} color={GREEN_DARK} />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', textAlign: 'center' }}>Verify Your Email Address</Text>
            <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
              We sent a verification link to <Text style={{ color: GREEN, fontWeight: '700' }}>{formData.email}</Text>. Please click the link in your email to activate your account.
            </Text>

            <TouchableOpacity
              onPress={() => {
                setShowSuccessModal(false);
                router.replace('/(auth)/login');
              }}
              style={[styles.primaryButton, { marginTop: 24, width: '100%' }]}
            >
              <Text style={styles.primaryButtonText}>Proceed to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  glassCard: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
  },
  fieldError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: GREEN_DARK,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GREEN_DARK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  typeCardActive: {
    borderColor: GREEN_DARK,
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  typeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  typeCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  typeCardDesc: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipActive: {
    borderColor: GREEN_DARK,
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  chipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: GREEN,
    fontWeight: '700',
  },
  avatarTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
  },
  avatarTabActive: {
    backgroundColor: GREEN_DARK,
  },
  avatarTabText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
  avatarTabTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  avatarOption: {
    padding: 4,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    borderColor: GREEN_DARK,
  },
});
