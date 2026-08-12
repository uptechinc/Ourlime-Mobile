import { useState } from 'react';
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
  Alert,
  ScrollView,
  Pressable,
  StatusBar,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { authService } from '@/lib/services/AuthService';
import * as ImagePicker from 'expo-image-picker';
import { cartoonAvatars, realisticAvatars } from './registrationAvatars';

// ─── Constants ────────────────────────────────────────────────────────────────
const GREEN = '#01eb53';
const GREEN_DARK = '#10b981';
const TOTAL_STEPS = 5;

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;

// ─── Types ────────────────────────────────────────────────────────────────────
type AvatarType = 'cartoon' | 'realistic';

type FormData = {
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: 'student' | 'regular' | '';
  gender: string;
  dateOfBirth: string;
  country: string;
  phone: string;
  city: string;
  profilePicture: string | null;
  selectedInterests: string[];
};

// ─── Interests ────────────────────────────────────────────────────────────────
const INTERESTS = [
  'Technology', 'Music', 'Sports', 'Art', 'Travel', 'Food', 'Gaming',
  'Fitness', 'Photography', 'Fashion', 'Education', 'Business',
  'Environment', 'Health', 'Science', 'Politics', 'Entertainment',
];

// ─── Main Component ───────────────────────────────────────────────────────────
const Register = () => {
  const router = useRouter();

  // Step state
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Avatar tab
  const [activeTab, setActiveTab] = useState<AvatarType>('cartoon');

  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [isPrivacyAccepted, setIsPrivacyAccepted] = useState(false);

  // Form data
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    userName: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: '',
    gender: '',
    dateOfBirth: '',
    country: '',
    phone: '',
    city: '',
    profilePicture: null,
    selectedInterests: [],
  });

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ── Helpers ────────────────────────────────────────────────────────────────
  const updateField = <TField extends keyof FormData>(field: TField, value: FormData[TField]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const setError = (field: string, msg: string) => {
    setErrors(prev => ({ ...prev, [field]: msg }));
  };

  // ── Step Validation ────────────────────────────────────────────────────────
  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      // Account type
      if (!formData.accountType) newErrors.accountType = 'Please select an account type.';
    }

    if (step === 2) {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required.';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required.';
      if (!formData.userName.trim()) newErrors.userName = 'Username is required.';
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address.';
      }
      if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters.';
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
      if (!isTermsAccepted) newErrors.terms = 'You must accept the Terms and Conditions.';
      if (!isPrivacyAccepted) newErrors.privacy = 'You must accept the Privacy Policy.';
    }

    if (step === 3) {
      if (!formData.profilePicture) newErrors.profilePicture = 'Please select an avatar.';
    }

    if (step === 4) {
      if (!formData.country.trim()) newErrors.country = 'Country is required.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(s => Math.min(s + 1, TOTAL_STEPS));
    }
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => Math.max(s - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setIsSubmitting(true);
    try {
      await authService.register(formData);
      Alert.alert('🎉 Welcome to Ourlime!', 'Your account has been created successfully.', [
        { text: 'Continue to App', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create account. Please try again.';
      Alert.alert('Registration Error', errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Progress indicator ─────────────────────────────────────────────────────
  const progress = step / TOTAL_STEPS;

  // ── Step labels ────────────────────────────────────────────────────────────
  const stepLabels = ['Account Type', 'Your Info', 'Avatar', 'Location', 'Interests'];

  // ── STEP 1: Account Type ───────────────────────────────────────────────────
  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>Welcome to <Text style={styles.green}>Ourlime</Text></Text>
      <Text style={styles.stepSubtitle}>What type of account would you like?</Text>

      {/* Account Type Cards */}
      <View style={{ gap: 14, marginTop: 8 }}>
        {(['regular', 'student'] as const).map((type) => (
          <Pressable
            key={type}
            onPress={() => updateField('accountType', type)}
            style={[
              styles.accountTypeCard,
              formData.accountType === type && styles.accountTypeCardActive,
            ]}
          >
            <Text style={styles.accountTypeIcon}>
              {type === 'regular' ? '🌟' : '🎓'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.accountTypeTitle, formData.accountType === type && { color: GREEN }]}>
                {type === 'regular' ? 'Regular Account' : 'Student Account'}
              </Text>
              <Text style={styles.accountTypeDesc}>
                {type === 'regular'
                  ? 'Standard access to all Ourlime features'
                  : 'Special features for students & academic communities'}
              </Text>
            </View>
            {formData.accountType === type && (
              <View style={styles.radioActive}><Text style={{ color: '#fff', fontSize: 10 }}>✓</Text></View>
            )}
          </Pressable>
        ))}
      </View>

      {errors.accountType ? <Text style={styles.errorText}>{errors.accountType}</Text> : null}

      {/* Already have an account */}
      <View style={styles.authLink}>
        <Text style={styles.authLinkText}>Already have an account?</Text>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.authLinkGreen}> Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── STEP 2: Personal Info ──────────────────────────────────────────────────
  const renderStep2 = () => (
    <View>
      <Text style={styles.stepTitle}>Create your account</Text>
      <Text style={styles.stepSubtitle}>Fill in your personal information below</Text>

      {/* Name Row */}
      <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>First Name *</Text>
          <TextInput
            style={[styles.input, errors.firstName && styles.inputError]}
            placeholder="First Name"
            placeholderTextColor="rgba(0,0,0,0.35)"
            value={formData.firstName}
            onChangeText={v => updateField('firstName', v)}
            autoCapitalize="words"
          />
          {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Last Name *</Text>
          <TextInput
            style={[styles.input, errors.lastName && styles.inputError]}
            placeholder="Last Name"
            placeholderTextColor="rgba(0,0,0,0.35)"
            value={formData.lastName}
            onChangeText={v => updateField('lastName', v)}
            autoCapitalize="words"
          />
          {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}
        </View>
      </View>

      {/* Username */}
      <Text style={styles.label}>Username *</Text>
      <TextInput
        style={[styles.input, errors.userName && styles.inputError]}
        placeholder="@username"
        placeholderTextColor="rgba(0,0,0,0.35)"
        value={formData.userName}
        onChangeText={v => updateField('userName', v)}
        autoCapitalize="none"
      />
      {errors.userName ? <Text style={styles.errorText}>{errors.userName}</Text> : null}

      {/* Email */}
      <Text style={styles.label}>Email Address *</Text>
      <TextInput
        style={[styles.input, errors.email && styles.inputError]}
        placeholder="your@email.com"
        placeholderTextColor="rgba(0,0,0,0.35)"
        value={formData.email}
        onChangeText={v => updateField('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

      {/* Password */}
      <Text style={styles.label}>Password *</Text>
      <TextInput
        style={[styles.input, errors.password && styles.inputError]}
        placeholder="Minimum 8 characters"
        placeholderTextColor="rgba(0,0,0,0.35)"
        value={formData.password}
        onChangeText={v => updateField('password', v)}
        secureTextEntry
      />
      {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}

      {/* Confirm Password */}
      <Text style={styles.label}>Confirm Password *</Text>
      <TextInput
        style={[styles.input, errors.confirmPassword && styles.inputError]}
        placeholder="Repeat your password"
        placeholderTextColor="rgba(0,0,0,0.35)"
        value={formData.confirmPassword}
        onChangeText={v => updateField('confirmPassword', v)}
        secureTextEntry
      />
      {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}

      {/* Terms */}
      <View style={{ marginTop: 16, gap: 10 }}>
        <Pressable style={styles.checkRow} onPress={() => setIsTermsAccepted(!isTermsAccepted)}>
          <View style={[styles.checkbox, isTermsAccepted && styles.checkboxChecked]}>
            {isTermsAccepted && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>
            I accept Ourlime{' '}
            <Text style={styles.green} onPress={() => router.push('/terms-and-conditions' as Href)}>Terms & Conditions</Text>
          </Text>
        </Pressable>

        <Pressable style={styles.checkRow} onPress={() => setIsPrivacyAccepted(!isPrivacyAccepted)}>
          <View style={[styles.checkbox, isPrivacyAccepted && styles.checkboxChecked]}>
            {isPrivacyAccepted && <Text style={{ color: '#fff', fontSize: 11 }}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>
            I accept Ourlime{' '}
            <Text style={styles.green} onPress={() => router.push('/privacy-policy' as Href)}>Privacy Policy</Text>
          </Text>
        </Pressable>
      </View>

      {(errors.terms || errors.privacy) ? (
        <Text style={styles.errorText}>{errors.terms || errors.privacy}</Text>
      ) : null}
    </View>
  );

  // ── STEP 3: Avatar ─────────────────────────────────────────────────────────
  const renderStep3 = () => (
    <View>
      <Text style={styles.stepTitle}>Choose your avatar</Text>
      <Text style={styles.stepSubtitle}>Pick one that represents you</Text>

      {/* Tab Toggle */}
      <View style={styles.tabBar}>
        {(['cartoon', 'realistic'] as const).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Avatar Grid */}
      <View style={styles.avatarGrid}>
        {(activeTab === 'cartoon' ? cartoonAvatars : realisticAvatars).map((avatar) => (
          <Pressable
            key={avatar.id}
            onPress={() => updateField('profilePicture', avatar.id)}
            style={[
              styles.avatarItem,
              formData.profilePicture === avatar.id && styles.avatarItemActive,
            ]}
          >
            <Image source={avatar.image} style={styles.avatarImg} />
            {formData.profilePicture === avatar.id && (
              <View style={styles.avatarCheck}>
                <Text style={{ color: '#fff', fontSize: 14 }}>✓</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {errors.profilePicture ? <Text style={styles.errorText}>{errors.profilePicture}</Text> : null}

      <TouchableOpacity onPress={async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
        const uri = result.canceled ? null : result.assets[0]?.uri;
        if (uri) updateField('profilePicture', uri);
      }} style={{ alignSelf: 'center', marginTop: 12 }}><Text style={[styles.green, { fontWeight: '700' }]}>Use your own photo</Text></TouchableOpacity>
      {formData.profilePicture?.startsWith('file:') || formData.profilePicture?.startsWith('content:') ? <Image source={{ uri: formData.profilePicture }} style={[styles.avatarImg, { alignSelf: 'center', marginTop: 10, borderRadius: 40 }]} /> : null}
    </View>
  );

  // ── STEP 4: Location / Demographics ───────────────────────────────────────
  const renderStep4 = () => (
    <View>
      <Text style={styles.stepTitle}>Tell us about yourself</Text>
      <Text style={styles.stepSubtitle}>Location and demographics</Text>

      {/* Gender */}
      <Text style={styles.label}>Gender</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        {['Male', 'Female', 'Other'].map(g => (
          <Pressable
            key={g}
            onPress={() => updateField('gender', g)}
            style={[
              styles.chipBtn,
              formData.gender === g && styles.chipBtnActive,
            ]}
          >
            <Text style={[styles.chipText, formData.gender === g && { color: '#fff' }]}>{g}</Text>
          </Pressable>
        ))}
      </View>

      {/* Date of Birth */}
      <Text style={styles.label}>Date of Birth</Text>
      <TextInput
        style={styles.input}
        placeholder="MM/DD/YYYY"
        placeholderTextColor="rgba(0,0,0,0.35)"
        value={formData.dateOfBirth}
        onChangeText={v => updateField('dateOfBirth', v)}
      />

      {/* Country */}
      <Text style={styles.label}>Country *</Text>
      <TextInput
        style={[styles.input, errors.country && styles.inputError]}
        placeholder="Your country"
        placeholderTextColor="rgba(0,0,0,0.35)"
        value={formData.country}
        onChangeText={v => updateField('country', v)}
      />
      {errors.country ? <Text style={styles.errorText}>{errors.country}</Text> : null}

      {/* City */}
      <Text style={styles.label}>City</Text>
      <TextInput
        style={styles.input}
        placeholder="Your city"
        placeholderTextColor="rgba(0,0,0,0.35)"
        value={formData.city}
        onChangeText={v => updateField('city', v)}
      />

      {/* Phone */}
      <Text style={styles.label}>Phone Number</Text>
      <TextInput
        style={styles.input}
        placeholder="+1 (123) 456-7890"
        placeholderTextColor="rgba(0,0,0,0.35)"
        value={formData.phone}
        onChangeText={v => updateField('phone', v)}
        keyboardType="phone-pad"
      />
    </View>
  );

  // ── STEP 5: Interests ──────────────────────────────────────────────────────
  const renderStep5 = () => (
    <View>
      <Text style={styles.stepTitle}>Your interests</Text>
      <Text style={styles.stepSubtitle}>Select topics you care about (optional)</Text>

      <View style={styles.interestsGrid}>
        {INTERESTS.map(interest => {
          const selected = formData.selectedInterests.includes(interest);
          return (
            <Pressable
              key={interest}
              onPress={() => {
                const updated = selected
                  ? formData.selectedInterests.filter(i => i !== interest)
                  : [...formData.selectedInterests, interest];
                updateField('selectedInterests', updated);
              }}
              style={[styles.interestChip, selected && styles.interestChipActive]}
            >
              <Text style={[styles.interestText, selected && { color: '#fff' }]}>{interest}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.stepSubtitle, { textAlign: 'center', marginTop: 20 }]}>
        {formData.selectedInterests.length} selected
      </Text>
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      default: return renderStep1();
    }
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* ── Header ── */}
      <View style={styles.header}>
        {/* Back arrow button */}
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.6}
          style={styles.backArrowBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827', marginTop: -2 }}>‹</Text>
        </TouchableOpacity>

        {/* Center brand logo */}
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center', marginRight: 40 }}>
          <Image
            source={require('./images/transparentLogo.png')}
            style={{ width: 26, height: 26, marginRight: 6 }}
            resizeMode="contain"
          />
          <Text style={styles.headerBrand}>Ourlime</Text>
        </View>
      </View>

      {/* ── Content Container with background fill ── */}
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        {/* ── Progress Bar ── */}
        <View style={[styles.progressContainer, { paddingHorizontal: 20, marginTop: 14, marginBottom: 0 }]}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressLabel}>Step {step} of {TOTAL_STEPS} — {stepLabels[step - 1]}</Text>
        </View>

        {/* ── KeyboardAvoidingView ── */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.container}>
              {/* ── Step Content ── */}
              <View style={styles.card}>
                {renderStep()}
              </View>

              {/* ── Navigation Buttons ── */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 16 }}>
                {step > 1 && (
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={handleBack}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.backBtnText}>← Back</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.nextBtn, { flex: 1 }]}
                  onPress={step === TOTAL_STEPS ? handleSubmit : handleNext}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.nextBtnText}>
                      {step === TOTAL_STEPS ? 'Create Account 🎉' : 'Next Step →'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* ── Terms Modal ── */}

      {/* ── Privacy Modal ── */}
    </SafeAreaView>
  );
};

export default Register;

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Layout
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    minHeight: 56,
  },
  backArrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    marginRight: 4,
  },
  headerBrand: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10b981',
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 20,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  // Progress
  progressContainer: {
    marginBottom: 12,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 99,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: GREEN,
    borderRadius: 99,
  },
  progressLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '600',
  },

  // Card
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },

  // Step Typography
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  green: {
    color: GREEN_DARK,
  },

  // Input
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#fafafa',
    marginBottom: 2,
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
    marginBottom: 4,
  },

  // Account Type Cards
  accountTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
    gap: 12,
  },
  accountTypeCardActive: {
    borderColor: GREEN,
    backgroundColor: 'rgba(1,235,83,0.06)',
  },
  accountTypeIcon: {
    fontSize: 28,
  },
  accountTypeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  accountTypeDesc: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  radioActive: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Auth link
  authLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  authLinkText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  authLinkGreen: {
    color: GREEN_DARK,
    fontSize: 14,
    fontWeight: '700',
  },

  // Checkboxes
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: {
    backgroundColor: GREEN,
    borderColor: GREEN,
  },
  checkLabel: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
    lineHeight: 18,
  },

  // Avatar tab
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabBtnTextActive: {
    color: '#111827',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  avatarItem: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    position: 'relative',
  },
  avatarItemActive: {
    borderColor: GREEN,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarCheck: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Chips (gender)
  chipBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fafafa',
  },
  chipBtnActive: {
    backgroundColor: GREEN_DARK,
    borderColor: GREEN_DARK,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },

  // Interests
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
  },
  interestChipActive: {
    backgroundColor: GREEN_DARK,
    borderColor: GREEN_DARK,
  },
  interestText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },

  // Buttons
  nextBtn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  backBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  backBtnText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  modalBody: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 20,
  },
  modalBtn: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  modalBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
