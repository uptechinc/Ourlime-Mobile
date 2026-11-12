import { useState, useEffect, useEffectEvent, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  StyleSheet,
  Image,
  ScrollView,
  Pressable,
  StatusBar,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService, type RegistrationVerificationType } from '@/lib/services/AuthService';
import { registrationDataService, type RegistrationMode } from '@/lib/services/RegistrationDataService';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { cartoonAvatars, realisticAvatars } from './registrationAvatars';
import BetaAccessView, { type BetaAccessState } from '@/components/auth/BetaAccessView';
import TermsModal from '@/components/auth/TermsModal';
import PrivacyModal from '@/components/auth/PrivacyModal';
import ChildSafetyPolicyModal from '@/components/auth/ChildSafetyPolicyModal';
import { COUNTRIES, isCaribbeanCountry } from '@/lib/helpers/countryData';
import LocationPickerModal, { type LocationPickerItem } from '@/components/auth/LocationPickerModal';
import VerificationSection from '@/components/auth/VerificationSection';
import { dateOfBirthService } from '@/lib/services/DateOfBirthService';
import { registrationDraftService } from '@/lib/services/RegistrationDraftService';
import KeyboardSafeView from '@/components/ui/KeyboardSafeView';
import { Skeleton } from '@/components/ui/Skeleton';
import { BadgeCheck, Check, ChevronRight, PartyPopper, User } from 'lucide-react-native';
import { GENDERS, MINIMUM_INTERESTS, REGISTRATION_INTERESTS, STUDENT_LEVELS } from './registrationOptions';
// ─── Constants ────────────────────────────────────────────────────────────────
const GREEN = '#01eb53';
const GREEN_DARK = '#10b981';
const TOTAL_STEPS = 7; // Steps 1 to 7 (Step 0 is Welcome)
const NAME_REGEX = /^[a-zA-Z\s'-]+$/;

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
  state: string;
  phone: string;
  city: string;
  profilePicture: string | null;
  coverPhoto: string | null;
  selectedInterests: string[];
  verificationType: RegistrationVerificationType;
  idSubType: 'national_id' | 'passport' | null;
  guardianRelation: 'biological_parent' | 'legal_guardian' | null;
  guardianEmail: string;
  verificationDocuments?: {
    faceUri: string;
    frontUri: string;
    backUri?: string;
  };
};

type RegistrationErrorField = keyof FormData | 'terms' | 'privacy' | 'childSafety' | 'interests' | 'global';
type RegistrationErrors = Partial<Record<RegistrationErrorField, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_TAKEN_MESSAGE = 'This email is already registered. Please log in instead.';
const USERNAME_TAKEN_MESSAGE = 'Username is already taken.';

/** Preset avatars are saved as the website saves them: the SVG file name (e.g. cartoonAvatarBlackBoy.svg). */
const presetAvatarValue = (avatarId: string): string => `${avatarId}.svg`;
const isSamePresetAvatar = (profilePicture: string | null, avatarId: string): boolean =>
  profilePicture === avatarId || profilePicture === presetAvatarValue(avatarId);

export default function Register() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const referralToken = (searchParams.referralToken as string) || '';

  // Beta Access State
  const [registrationAccess, setRegistrationAccess] = useState<'loading' | 'allowed' | BetaAccessState>('loading');

  // Step state (0: Welcome, 1: Account Type, 2: Basic Info, 3: Demographics, 4: Location, 5: Avatar, 6: Interests, 7: Verification)
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Email reserved by a beta invitation link; the email field is locked to it, as on the website.
  const [invitedEmail, setInvitedEmail] = useState('');
  const [hasInvitation, setHasInvitation] = useState(false);
  // Interests are confirmed on a "Your Lime Profile Is Ready!" preview before verification.
  const [showInterestsPreview, setShowInterestsPreview] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  // The saved draft (or a pending email verification) is read before the form is shown and saved.
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Modals & Availability
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isChildSafetyOpen, setIsChildSafetyOpen] = useState(false);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);
  const [isPrivacyAccepted, setIsPrivacyAccepted] = useState(false);
  const [isChildSafetyAccepted, setIsChildSafetyAccepted] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [registeredUserId, setRegisteredUserId] = useState('');
  const [verificationEmailSent, setVerificationEmailSent] = useState(false);
  const [isRetryingVerificationEmail, setIsRetryingVerificationEmail] = useState(false);
  const [verificationEmailError, setVerificationEmailError] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [hasPhoneNumber, setHasPhoneNumber] = useState<boolean | null>(null);

  // Username / Email Availability
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailExistsError, setEmailExistsError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameExistsError, setUsernameExistsError] = useState('');
  const emailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest value being checked; replies for older values are ignored.
  const latestEmailCheckRef = useRef('');
  const latestUsernameCheckRef = useRef('');

  // Password Visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
    country: 'Trinidad and Tobago',
    state: '',
    phone: '',
    city: '',
    profilePicture: null,
    coverPhoto: null,
    selectedInterests: [],
    verificationType: 'skipped',
    idSubType: null,
    guardianRelation: null,
    guardianEmail: '',
  });

  const [errors, setErrors] = useState<RegistrationErrors>({});

  // Age calculation
  const calculatedAge = useMemo(() => {
    if (!formData.dateOfBirth.trim()) return null;
    const dob = dateOfBirthService.parse(formData.dateOfBirth);
    if (!dob || Number.isNaN(dob.getTime())) return null;
    const today = new Date();
    let a = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      a--;
    }
    return a;
  }, [formData.dateOfBirth]);

  // ── Beta Registration Access Check ───────────────────────────────────────
  // Effect events read the latest form helpers without re-running the effects that call them.
  useEffect(() => {
    let cancelled = false;

    const checkBetaAccess = async () => {
      let mode: RegistrationMode | undefined;
      try {
        mode = await registrationDataService.getRegistrationMode();
        if (cancelled) return;

        if (mode === 'closed') {
          setRegistrationAccess('closed');
          return;
        }

        // Like the website, an invitation link is still checked (and its badge shown) when sign-up is open.
        if (!referralToken) {
          setRegistrationAccess(mode === 'open' ? 'allowed' : 'invite_required');
          return;
        }

        const tokenRes = await registrationDataService.validateInvitation(referralToken);
        if (cancelled) return;

        if (!tokenRes.valid) {
          setRegistrationAccess(tokenRes.reason);
          return;
        }
        setHasInvitation(true);
        if (tokenRes.email) setInvitedEmail(tokenRes.email);
        setRegistrationAccess('allowed');
      } catch {
        if (!cancelled) {
          setRegistrationAccess(referralToken ? 'allowed' : (mode === 'open' ? 'allowed' : 'invite_required'));
        }
      }
    };

    void checkBetaAccess();
    return () => {
      cancelled = true;
    };
  }, [referralToken]);

  // ── Saved Draft & Pending Verification ────────────────────────────────────
  // Restores the website-style draft (7 days) or reopens the "verify your email" dialog (24 hours).
  const restoreDraft = useEffectEvent(async () => {
    try {
      const pending = await registrationDraftService.loadPendingVerification();
      if (pending) {
        setRegisteredUserId(pending.userId);
        setVerificationEmailSent(pending.verificationEmailSent);
        setFormData(previous => ({ ...previous, email: pending.email }));
        setShowSuccessModal(true);
        return;
      }
      const draft = await registrationDraftService.loadDraft();
      if (!draft) return;
      const { step: savedStep, showInterestsPreview: savedPreview, ...savedFields } = draft;
      setFormData(previous => ({ ...previous, ...savedFields, country: savedFields.country || previous.country }));
      if (savedFields.phone) setHasPhoneNumber(true);
      setShowInterestsPreview(savedPreview);
      setStep(savedStep);
      if (savedStep === 2 && savedFields.email) handleEmailChange(savedFields.email);
    } finally {
      setHasRestoredDraft(true);
    }
  });
  useEffect(() => {
    void restoreDraft();
  }, []);

  // The invitation's email wins over a restored draft, as on the website.
  const applyInvitedEmail = useEffectEvent((email: string) => {
    if (formData.email !== email) handleEmailChange(email);
  });
  useEffect(() => {
    if (hasRestoredDraft && invitedEmail) applyInvitedEmail(invitedEmail);
  }, [hasRestoredDraft, invitedEmail]);

  useEffect(() => {
    if (!hasRestoredDraft || showSuccessModal) return undefined;
    const saveTimer = setTimeout(() => {
      const { password: _password, confirmPassword: _confirmPassword, coverPhoto: _coverPhoto, verificationDocuments: _documents, idSubType: _idSubType, guardianRelation: _guardianRelation, ...draftFields } = formData;
      void registrationDraftService.saveDraft({ ...draftFields, step, showInterestsPreview });
    }, 400);
    return () => clearTimeout(saveTimer);
  }, [formData, hasRestoredDraft, showInterestsPreview, showSuccessModal, step]);

  useEffect(() => () => {
    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
  }, []);

  // ── Real-time Email & Username Checks ─────────────────────────────────────
  const handleEmailChange = (val: string) => {
    updateField('email', val);
    setEmailExistsError('');
    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
    const trimmed = val.trim();
    latestEmailCheckRef.current = trimmed;
    if (EMAIL_PATTERN.test(trimmed)) {
      setIsCheckingEmail(true);
      emailDebounceRef.current = setTimeout(async () => {
        try {
          const available = await registrationDataService.isEmailAvailable(trimmed);
          if (latestEmailCheckRef.current === trimmed && !available) {
            setEmailExistsError(EMAIL_TAKEN_MESSAGE);
          }
        } catch (error: unknown) {
          // A failed check is repeated when Continue is pressed.
          console.error('[Register.handleEmailChange] Error:', error instanceof Error ? error.message : error);
        } finally {
          if (latestEmailCheckRef.current === trimmed) setIsCheckingEmail(false);
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
    latestUsernameCheckRef.current = trimmed;
    if (trimmed.length >= 3) {
      setIsCheckingUsername(true);
      usernameDebounceRef.current = setTimeout(async () => {
        try {
          const available = await registrationDataService.isUsernameAvailable(trimmed);
          if (latestUsernameCheckRef.current === trimmed && !available) {
            setUsernameExistsError(USERNAME_TAKEN_MESSAGE);
          }
        } catch (error: unknown) {
          // A failed check is repeated when Continue is pressed.
          console.error('[Register.handleUsernameChange] Error:', error instanceof Error ? error.message : error);
        } finally {
          if (latestUsernameCheckRef.current === trimmed) setIsCheckingUsername(false);
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

  // ── Location Modal & Data States ──────────────────────────────────────────
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [isStateModalOpen, setIsStateModalOpen] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);

  const [cities, setCities] = useState<string[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [states, setStates] = useState<{ name: string; state_code: string }[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const cityAbortRef = useRef<AbortController | null>(null);
  const stateAbortRef = useRef<AbortController | null>(null);

  const isCaribbean = useMemo(() => isCaribbeanCountry(formData.country), [formData.country]);

  const fetchCities = useCallback(async (countryName: string) => {
    if (cityAbortRef.current) cityAbortRef.current.abort();
    setCitiesLoading(true);
    setCities([]);
    const controller = new AbortController();
    cityAbortRef.current = controller;

    try {
      const res = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryName }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!data.error && Array.isArray(data.data)) {
        setCities(data.data.filter((c: string) => c && c.trim()));
      }
    } catch {
      // Non-blocking
    } finally {
      setCitiesLoading(false);
    }
  }, []);

  const fetchStates = useCallback(async (countryName: string) => {
    if (stateAbortRef.current) stateAbortRef.current.abort();
    setStatesLoading(true);
    setStates([]);
    const controller = new AbortController();
    stateAbortRef.current = controller;

    try {
      const res = await fetch('https://countriesnow.space/api/v0.1/countries/states', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryName }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!data.error && Array.isArray(data.data?.states)) {
        setStates(data.data.states);
      }
    } catch {
      // Non-blocking
    } finally {
      setStatesLoading(false);
    }
  }, []);

  const fetchCitiesForState = useCallback(async (countryName: string, stateName: string) => {
    if (cityAbortRef.current) cityAbortRef.current.abort();
    setCitiesLoading(true);
    setCities([]);
    const controller = new AbortController();
    cityAbortRef.current = controller;

    try {
      const res = await fetch('https://countriesnow.space/api/v0.1/countries/state/cities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: countryName, state: stateName }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!data.error && Array.isArray(data.data) && data.data.length > 0) {
        setCities(data.data.filter((c: string) => c && c.trim()));
      } else {
        fetchCities(countryName);
      }
    } catch {
      fetchCities(countryName);
    } finally {
      setCitiesLoading(false);
    }
  }, [fetchCities]);

  useEffect(() => {
    return () => {
      cityAbortRef.current?.abort();
      stateAbortRef.current?.abort();
    };
  }, []);

  // Reload states/cities when the country changes (the selected state is read, not watched).
  const loadLocationsForCountry = useEffectEvent((country: string) => {
    if (isCaribbean) {
      setStates([]);
      updateField('state', '');
      fetchCities(country);
    } else {
      fetchStates(country);
      if (formData.state) {
        fetchCitiesForState(country, formData.state);
      } else {
        fetchCities(country);
      }
    }
  });
  useEffect(() => {
    if (formData.country) loadLocationsForCountry(formData.country);
  }, [formData.country, isCaribbean]);

  const handleCountrySelect = (item: LocationPickerItem) => {
    updateField('country', item.label);
    updateField('state', '');
    updateField('city', '');
  };

  const handleStateSelect = (item: LocationPickerItem) => {
    updateField('state', item.label);
    updateField('city', '');
    if (formData.country) {
      fetchCitiesForState(formData.country, item.label);
    }
  };

  const handleCitySelect = (item: LocationPickerItem) => {
    updateField('city', item.label);
  };

  // ── Step Validation ────────────────────────────────────────────────────────
  const validateStep = (): boolean => {
    const newErrors: RegistrationErrors = {};

    if (step === 1) {
      if (!formData.accountType) newErrors.accountType = 'Please select an account type.';
    }

    if (step === 2) {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required.';
      else if (!NAME_REGEX.test(formData.firstName.trim())) newErrors.firstName = 'First name can only contain letters, spaces, hyphens, and apostrophes.';

      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required.';
      else if (!NAME_REGEX.test(formData.lastName.trim())) newErrors.lastName = 'Last name can only contain letters, spaces, hyphens, and apostrophes.';

      if (!formData.userName.trim()) newErrors.userName = 'Username is required.';
      else if (usernameExistsError) newErrors.userName = usernameExistsError;

      if (!formData.email.trim()) newErrors.email = 'Email is required.';
      else if (!EMAIL_PATTERN.test(formData.email.trim())) newErrors.email = 'Please enter a valid email address.';
      else if (invitedEmail && formData.email.trim().toLowerCase() !== invitedEmail.trim().toLowerCase()) newErrors.email = 'Use the email address connected to this invitation.';
      else if (emailExistsError) newErrors.email = emailExistsError;

      if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters.';
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match.';
      if (!isTermsAccepted) newErrors.terms = 'You must accept the Terms and Conditions.';
      if (!isPrivacyAccepted) newErrors.privacy = 'You must accept the Privacy Policy.';
      if (!isChildSafetyAccepted) newErrors.childSafety = 'You must accept the Child Safety Standards Policy.';
    }

    if (step === 3) {
      const dateValidation = dateOfBirthService.validate(formData.dateOfBirth, formData.accountType);
      if (!dateValidation.valid) newErrors.dateOfBirth = dateValidation.message;
      if (!formData.gender) newErrors.gender = 'Please select a gender.';
      if (formData.accountType === 'student' && !formData.studentLevel) {
        newErrors.studentLevel = 'Please select your student level.';
      }
    }

    if (step === 4) {
      if (!formData.country.trim()) newErrors.country = 'Country is required.';
      if (!isCaribbean && states.length > 0 && !formData.state.trim()) {
        newErrors.state = 'Please select your state or province.';
      }
      if (hasPhoneNumber === null) newErrors.phone = 'Please select Yes or No.';
      if (hasPhoneNumber && !formData.phone.trim()) newErrors.phone = 'Phone number is required when Yes is selected.';
    }

    if (step === 5) {
      if (!formData.profilePicture) newErrors.profilePicture = 'Please select an avatar or upload a picture.';
    }

    if (step === 6) {
      if (formData.selectedInterests.length < MINIMUM_INTERESTS) newErrors.interests = `Please select at least ${MINIMUM_INTERESTS} interests`;
    }

    if (step === 7 && formData.verificationType === 'guardian') {
      if (!EMAIL_PATTERN.test(formData.guardianEmail.trim())) {
        newErrors.guardianEmail = 'Enter a valid parent or guardian email address.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }
    return true;
  };

  /**
   * The website confirms the email and username with the server before leaving the account details, since the
   * as-you-type checks can be stale or have failed.
   */
  const confirmAccountDetailsAvailable = async (): Promise<boolean> => {
    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    const email = formData.email.trim();
    const userName = formData.userName.trim();
    latestEmailCheckRef.current = email;
    latestUsernameCheckRef.current = userName;
    setIsCheckingEmail(true);
    try {
      const [isEmailAvailable, isUsernameAvailable] = await Promise.all([
        registrationDataService.isEmailAvailable(email),
        registrationDataService.isUsernameAvailable(userName),
      ]);
      setEmailExistsError(isEmailAvailable ? '' : EMAIL_TAKEN_MESSAGE);
      setUsernameExistsError(isUsernameAvailable ? '' : USERNAME_TAKEN_MESSAGE);
      if (!isEmailAvailable || !isUsernameAvailable) {
        setErrors(previous => ({
          ...previous,
          ...(isEmailAvailable ? {} : { email: EMAIL_TAKEN_MESSAGE }),
          ...(isUsernameAvailable ? {} : { userName: USERNAME_TAKEN_MESSAGE }),
        }));
        return false;
      }
      return true;
    } catch (error: unknown) {
      console.error('[Register.confirmAccountDetailsAvailable] Error:', error instanceof Error ? error.message : error);
      setErrors(previous => ({ ...previous, global: error instanceof Error && error.message ? error.message : 'Unable to validate this email right now' }));
      return false;
    } finally {
      setIsCheckingEmail(false);
      setIsCheckingUsername(false);
    }
  };

  const handleNext = async () => {
    if (isAdvancing || !validateStep()) return;
    setErrors(previous => ({ ...previous, global: undefined }));
    if (step === 2) {
      setIsAdvancing(true);
      const isAvailable = await confirmAccountDetailsAvailable();
      setIsAdvancing(false);
      if (!isAvailable) return;
    }
    // Interests are confirmed on the profile preview first, as on the website.
    if (step === 6 && !showInterestsPreview) {
      setShowInterestsPreview(true);
      return;
    }
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setErrors({});
    if (step === 6 && showInterestsPreview) {
      setShowInterestsPreview(false);
      return;
    }
    setStep(s => Math.max(s - 1, 0));
  };

  // ── Final Registration Submit ─────────────────────────────────────────────
  const handleSubmit = async (verificationPayload?: {
    verificationType: RegistrationVerificationType;
    idSubType?: 'national_id' | 'passport' | null;
    guardianRelation?: 'biological_parent' | 'legal_guardian' | null;
    guardianEmail?: string;
    documents?: {
      faceUri: string;
      frontUri: string;
      backUri?: string;
    };
  }) => {
    setIsSubmitting(true);
    setErrors(prev => ({ ...prev, global: undefined }));
    try {
      const vType = verificationPayload?.verificationType ?? formData.verificationType;
      const idSub = verificationPayload?.idSubType !== undefined ? verificationPayload.idSubType : formData.idSubType;
      const gRel = verificationPayload?.guardianRelation !== undefined ? verificationPayload.guardianRelation : formData.guardianRelation;
      const gEmail = verificationPayload?.guardianEmail !== undefined ? verificationPayload.guardianEmail : formData.guardianEmail;
      const vDocs = verificationPayload?.documents;

      const registrationResult = await authService.register({
        ...formData,
        verificationType: vType,
        idSubType: idSub,
        guardianRelation: gRel,
        guardianEmail: gEmail,
        verificationDocuments: vDocs,
        referralToken,
        policyAcknowledgements: {
          terms: isTermsAccepted,
          privacy: isPrivacyAccepted,
          childSafety: isChildSafetyAccepted,
        },
      });
      await registrationDraftService.clearDraft();
      await registrationDraftService.savePendingVerification({
        userId: registrationResult.user.uid,
        email: formData.email.trim(),
        verificationEmailSent: registrationResult.verificationEmailSent,
      });
      setRegisteredUserId(registrationResult.user.uid);
      setVerificationEmailSent(registrationResult.verificationEmailSent);
      setVerificationEmailError(registrationResult.verificationEmailSent ? '' : 'Your account was created, but the verification email could not be sent.');
      setShowSuccessModal(true);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Registration failed. Please try again.';
      setErrors(prev => ({ ...prev, global: msg }));
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

  /** Optional cover photo (the website's "Upload Your Own Pictures" step also offers one). */
  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [3, 1], quality: 0.8 });
    if (!res.canceled && res.assets[0]?.uri) updateField('coverPhoto', res.assets[0].uri);
  };

  const toggleInterest = (interest: string) => {
    const current = formData.selectedInterests;
    const next = current.includes(interest)
      ? current.filter(i => i !== interest)
      : [...current, interest];
    updateField('selectedInterests', next);
  };

  // ── Render Guard ──────────────────────────────────────────────────────────
  if (registrationAccess === 'loading' || !hasRestoredDraft) {
    return <RegistrationSkeleton />;
  }

  if (registrationAccess !== 'allowed') {
    return <BetaAccessView state={registrationAccess} />;
  }

  // Step Labels & Progress
  const stepLabels = ['', 'Account Type', 'Basic Info', 'Demographics', 'Location', 'Avatar', 'Interests', 'Verification'];
  const progress = step > 0 ? step / TOTAL_STEPS : 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#000000' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Top Header & Back Button */}
      <View style={{ paddingTop: 10, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
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

      <KeyboardSafeView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">

          {/* Beta invitation (the website's InvitationBadge) */}
          {hasInvitation ? (
            <View style={styles.invitationBadge}>
              <BadgeCheck size={20} color={GREEN} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: '#ffffff', fontWeight: '700', fontSize: 14 }}>You have been invited to join the OurLime beta.</Text>
                {invitedEmail ? <Text style={{ color: '#dcfce7', fontSize: 13, marginTop: 4 }}>This invitation is reserved for {invitedEmail}.</Text> : null}
              </View>
            </View>
          ) : null}

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
                      {isCheckingUsername && <Skeleton width={56} height={10} borderRadius={5} style={{ position: 'absolute', right: 14, top: 19 }} />}
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
                        editable={!invitedEmail}
                        style={[styles.input, invitedEmail ? { opacity: 0.7 } : null]}
                      />
                      {isCheckingEmail && <Skeleton width={56} height={10} borderRadius={5} style={{ position: 'absolute', right: 14, top: 19 }} />}
                    </View>
                    {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
                  </View>

                  {/* Password & Confirm */}
                  <View>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        placeholder="Password (min 8 chars)"
                        placeholderTextColor="#64748b"
                        secureTextEntry={!showPassword}
                        value={formData.password}
                        onChangeText={v => updateField('password', v)}
                        style={[styles.input, { paddingRight: 46 }]}
                      />
                      <TouchableOpacity
                        onPress={() => setShowPassword(!showPassword)}
                        style={{ position: 'absolute', right: 14, top: 12 }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                    {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
                  </View>

                  <View>
                    <View style={{ position: 'relative' }}>
                      <TextInput
                        placeholder="Confirm Password"
                        placeholderTextColor="#64748b"
                        secureTextEntry={!showConfirmPassword}
                        value={formData.confirmPassword}
                        onChangeText={v => updateField('confirmPassword', v)}
                        style={[styles.input, { paddingRight: 46 }]}
                      />
                      <TouchableOpacity
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={{ position: 'absolute', right: 14, top: 12 }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94a3b8" />
                      </TouchableOpacity>
                    </View>
                    {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text> : null}
                  </View>

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

                <TouchableOpacity onPress={handleNext} disabled={isAdvancing} style={[styles.primaryButton, { marginTop: 20 }, isAdvancing && { opacity: 0.7 }]}>
                  {isAdvancing ? <Skeleton width={110} height={16} borderRadius={8} /> : <Text style={styles.primaryButtonText}>Continue →</Text>}
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
                    <Text style={styles.label}>Date of Birth</Text>
                    <TouchableOpacity
                      onPress={() => setIsDatePickerOpen(true)}
                      style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                    >
                      <Text style={{ color: formData.dateOfBirth ? '#ffffff' : '#64748b', fontSize: 16 }}>
                        {formData.dateOfBirth
                          ? dateOfBirthService.parse(formData.dateOfBirth)?.toLocaleDateString() ?? 'Select your date of birth'
                          : 'Select your date of birth'}
                      </Text>
                      <Ionicons name="calendar-outline" size={20} color="#94a3b8" />
                    </TouchableOpacity>
                    {errors.dateOfBirth ? <Text style={styles.fieldError}>{errors.dateOfBirth}</Text> : null}
                  </View>

                  {/* Under 16 regular account warning banner */}
                  {formData.accountType === 'regular' && calculatedAge !== null && calculatedAge < 16 && (
                    <View style={styles.ageAlertCard}>
                      <Ionicons name="alert-circle-outline" size={24} color="#f87171" style={{ marginBottom: 6 }} />
                      <Text style={styles.ageAlertText}>
                        Regular accounts require users to be at least 16 years old. Please register as a Student instead.
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          updateField('accountType', 'student');
                          setErrors(prev => ({ ...prev, dateOfBirth: undefined }));
                        }}
                        style={styles.switchStudentButton}
                      >
                        <Text style={styles.switchStudentButtonText}>Switch to Student Account</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Gender Selection */}
                  <View>
                    <Text style={styles.label}>Gender</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {GENDERS.map(gender => {
                        // Older app sign-ups saved the label ("Male"); the website saves the lowercase value.
                        const isSelected = formData.gender.toLowerCase() === gender.value;
                        return (
                          <TouchableOpacity
                            key={gender.value}
                            onPress={() => updateField('gender', gender.value)}
                            style={[styles.chip, { flex: 1, alignItems: 'center' }, isSelected && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{gender.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {errors.gender ? <Text style={styles.fieldError}>{errors.gender}</Text> : null}
                  </View>

                  {/* Student Level (If Student Account) */}
                  {formData.accountType === 'student' && (
                    <View style={{ marginTop: 6 }}>
                      <Text style={styles.label}>Student Level</Text>
                      <View style={{ gap: 8 }}>
                        {STUDENT_LEVELS.map(level => (
                          <TouchableOpacity
                            key={level}
                            onPress={() => updateField('studentLevel', level)}
                            style={[styles.chip, formData.studentLevel === level && styles.chipActive, { width: '100%', alignItems: 'center' }]}
                          >
                            <Text style={[styles.chipText, formData.studentLevel === level && styles.chipTextActive]}>{level}</Text>
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
                  {/* Country */}
                  <View>
                    <Text style={styles.label}>Country</Text>
                    <TouchableOpacity
                      onPress={() => setIsCountryModalOpen(true)}
                      style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: formData.country ? '#ffffff' : '#64748b', fontSize: 16 }}>
                        {formData.country || 'Select your country'}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                    {errors.country ? <Text style={styles.fieldError}>{errors.country}</Text> : null}
                  </View>

                  {/* State / Province - ONLY for Non-Caribbean Countries */}
                  {!isCaribbean && formData.country ? (
                    <View>
                      <Text style={styles.label}>
                        State / Province {states.length > 0 ? '(Required)' : '(Optional)'}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setIsStateModalOpen(true)}
                        style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: formData.state ? '#ffffff' : '#64748b', fontSize: 16 }}>
                          {formData.state || (statesLoading ? 'Loading states...' : 'Select your state or province')}
                        </Text>
                        <Ionicons name="chevron-down" size={18} color="#94a3b8" />
                      </TouchableOpacity>
                      {errors.state ? <Text style={styles.fieldError}>{errors.state}</Text> : null}
                    </View>
                  ) : null}

                  {/* Optional Phone Number */}
                  <View>
                    <Text style={styles.label}>Do you have a phone number?</Text>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      {([true, false] as const).map((choice) => (
                        <TouchableOpacity
                          key={String(choice)}
                          onPress={() => {
                            setHasPhoneNumber(choice);
                            if (!choice) updateField('phone', '');
                            setErrors((currentErrors) => ({ ...currentErrors, phone: undefined }));
                          }}
                          style={[styles.chip, { flex: 1, alignItems: 'center' }, hasPhoneNumber === choice && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, hasPhoneNumber === choice && styles.chipTextActive]}>{choice ? 'Yes' : 'No'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {hasPhoneNumber ? (
                      <TextInput
                        placeholder="+1 (868) 000-0000"
                        placeholderTextColor="#64748b"
                        keyboardType="phone-pad"
                        value={formData.phone}
                        onChangeText={(value) => updateField('phone', value)}
                        style={[styles.input, { marginTop: 10 }]}
                      />
                    ) : null}
                    {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}
                  </View>

                  {/* City / Town / Region */}
                  <View>
                    <Text style={styles.label}>
                      {isCaribbean ? 'City / Town / Region (Optional)' : 'City / Town (Optional)'}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setIsCityModalOpen(true)}
                      style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                      activeOpacity={0.8}
                    >
                      <Text style={{ color: formData.city ? '#ffffff' : '#64748b', fontSize: 16 }}>
                        {formData.city || (citiesLoading ? 'Loading cities...' : 'Select your city / town')}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#94a3b8" />
                    </TouchableOpacity>
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
                  {(activeTab === 'cartoon' ? cartoonAvatars : realisticAvatars).map((avatar) => (
                    <TouchableOpacity
                      key={avatar.id}
                      accessibilityLabel={avatar.name}
                      onPress={() => updateField('profilePicture', presetAvatarValue(avatar.id))}
                      style={[styles.avatarOption, isSamePresetAvatar(formData.profilePicture, avatar.id) && styles.avatarOptionSelected]}
                    >
                      <Image source={avatar.image} style={{ width: 68, height: 68, borderRadius: 34 }} resizeMode="cover" />
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Upload Custom Photo Option */}
                <TouchableOpacity onPress={pickImage} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'rgba(255,255,255,0.05)', marginBottom: 20 }}>
                  <Ionicons name="camera-outline" size={20} color={GREEN_DARK} />
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Upload Custom Photo</Text>
                </TouchableOpacity>

                {/* Optional cover photo */}
                {formData.coverPhoto ? (
                  <View style={{ marginBottom: 20 }}>
                    <Image source={{ uri: formData.coverPhoto }} style={{ width: '100%', height: 110, borderRadius: 14 }} resizeMode="cover" />
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                      <TouchableOpacity onPress={pickCover} style={{ flex: 1, alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                        <Text style={{ color: '#ffffff', fontWeight: '600' }}>Change cover</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateField('coverPhoto', null)} style={{ flex: 1, alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' }}>
                        <Text style={{ color: '#fca5a5', fontWeight: '600' }}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity onPress={pickCover} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', marginBottom: 20 }}>
                    <Ionicons name="image-outline" size={20} color={GREEN_DARK} />
                    <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>Add a cover photo (optional)</Text>
                  </TouchableOpacity>
                )}

                {errors.profilePicture ? <Text style={styles.fieldError}>{errors.profilePicture}</Text> : null}

                <TouchableOpacity onPress={handleNext} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Continue →</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 6: Interests Selection ── */}
            {step === 6 && !showInterestsPreview && (
              <View>
                <Text style={styles.stepTitle}>What do you like?</Text>
                <Text style={styles.stepSubtitle}>Select at least {MINIMUM_INTERESTS} interests to help us personalize your feed. (Selected: {formData.selectedInterests.length})</Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 16 }}>
                  {REGISTRATION_INTERESTS.map((interest) => {
                    const isSelected = formData.selectedInterests.includes(interest.name);
                    const InterestIcon = interest.icon;
                    return (
                      <TouchableOpacity
                        key={interest.name}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => toggleInterest(interest.name)}
                        style={[styles.chip, styles.interestChip, isSelected && styles.chipActive]}
                      >
                        <InterestIcon size={16} color={isSelected ? GREEN : '#cbd5e1'} />
                        <Text style={[styles.chipText, isSelected ? styles.chipTextActive : { color: '#ffffff' }]}>{interest.name}</Text>
                        {isSelected ? <Check size={14} color={GREEN} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {errors.interests ? <Text style={styles.fieldError}>{errors.interests}</Text> : null}

                <TouchableOpacity onPress={handleNext} disabled={formData.selectedInterests.length < MINIMUM_INTERESTS} style={[styles.primaryButton, styles.buttonRow, formData.selectedInterests.length < MINIMUM_INTERESTS && { opacity: 0.5 }]}>
                  <Text style={styles.primaryButtonText}>Preview Profile</Text>
                  <ChevronRight size={18} color="#ffffff" />
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 6b: Profile preview (the website's "Your Lime Profile Is Ready!") ── */}
            {step === 6 && showInterestsPreview && (
              <View style={{ alignItems: 'center' }}>
                <PartyPopper size={40} color="#facc15" />
                <Text style={{ marginTop: 8, color: '#facc15', fontSize: 22, fontWeight: '800', textAlign: 'center' }}>🎉 Your Lime Profile Is Ready!</Text>
                <Text style={{ marginTop: 6, color: '#cbd5e1', fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
                  We&apos;ll use these interests to connect you with people and communities you&apos;ll enjoy.
                </Text>

                <View style={styles.previewCard}>
                  <RegistrationAvatarPreview profilePicture={formData.profilePicture} />
                  <Text style={{ marginTop: 12, marginBottom: 14, color: '#ffffff', fontSize: 19, fontWeight: '800', textAlign: 'center' }}>{formData.firstName.trim() || 'User'}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                    {formData.selectedInterests.map((interestName) => {
                      const InterestIcon = REGISTRATION_INTERESTS.find((interest) => interest.name === interestName)?.icon;
                      return (
                        <View key={interestName} style={styles.previewInterest}>
                          {InterestIcon ? <InterestIcon size={14} color={GREEN} /> : null}
                          <Text style={{ color: GREEN, fontSize: 13, fontWeight: '600' }}>{interestName}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity onPress={handleNext} style={[styles.primaryButton, styles.buttonRow]}>
                  <Text style={styles.primaryButtonText}>Looks Great!</Text>
                  <ChevronRight size={18} color="#ffffff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowInterestsPreview(false)} style={{ marginTop: 14, padding: 6 }}>
                  <Text style={{ color: '#94a3b8', fontWeight: '600' }}>Go back to edit interests</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 7: Identity Verification & Submit ── */}
            {step === 7 && (
              <VerificationSection
                dateOfBirth={formData.dateOfBirth}
                accountType={formData.accountType}
                isSubmitting={isSubmitting}
                submissionError={errors.global}
                onSkipVerification={() => handleSubmit({ verificationType: 'skipped' })}
                onSubmitVerification={(data) => handleSubmit(data)}
                onBackToInterests={() => setStep(6)}
              />
            )}

          </View>

          {step > 0 ? (
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 20, alignSelf: 'center', padding: 6 }}>
              <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center' }}>
                Already have an account? <Text style={{ color: GREEN_DARK, fontWeight: '700' }}>Login instead</Text>
              </Text>
            </TouchableOpacity>
          ) : null}

        </ScrollView>
      </KeyboardSafeView>

      {/* Terms & Privacy Modals */}
      <TermsModal isOpen={isTermsOpen} onClose={() => setIsTermsOpen(false)} onAccept={() => setIsTermsAccepted(true)} />
      <PrivacyModal isOpen={isPrivacyOpen} onClose={() => setIsPrivacyOpen(false)} onAccept={() => setIsPrivacyAccepted(true)} />
      <ChildSafetyPolicyModal isOpen={isChildSafetyOpen} onClose={() => setIsChildSafetyOpen(false)} onAccept={() => setIsChildSafetyAccepted(true)} />

      <Modal visible={isDatePickerOpen} transparent animationType="fade" onRequestClose={() => setIsDatePickerOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', padding: 24 }} onPress={() => setIsDatePickerOpen(false)}>
          <Pressable style={{ borderRadius: 20, backgroundColor: '#111827', padding: 20 }} onPress={(event) => event.stopPropagation()}>
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '800', marginBottom: 14 }}>Select date of birth</Text>
            <DateTimePicker
              value={dateOfBirthService.parse(formData.dateOfBirth) ?? new Date(2000, 0, 1)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
              maximumDate={new Date()}
              minimumDate={new Date(new Date().getFullYear() - 120, new Date().getMonth(), new Date().getDate())}
              onChange={(_, selectedDate) => {
                if (Platform.OS === 'android') setIsDatePickerOpen(false);
                if (selectedDate) {
                  updateField('dateOfBirth', dateOfBirthService.formatIso(selectedDate));
                  setErrors((currentErrors) => ({ ...currentErrors, dateOfBirth: undefined }));
                }
              }}
              themeVariant="dark"
            />
            {Platform.OS === 'ios' ? (
              <TouchableOpacity onPress={() => setIsDatePickerOpen(false)} style={[styles.primaryButton, { marginTop: 14 }]}>
                <Text style={styles.primaryButtonText}>Done</Text>
              </TouchableOpacity>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Success / Email Verification Polling Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ width: '100%', maxWidth: 480, backgroundColor: '#090d16', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', padding: 28, alignItems: 'center' }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(16,185,129,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="mail-unread" size={36} color={GREEN_DARK} />
            </View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#ffffff', textAlign: 'center' }}>Verify Your Email Address</Text>
            <Text style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
              {verificationEmailSent
                ? <>We sent a verification link to <Text style={{ color: GREEN, fontWeight: '700' }}>{formData.email}</Text>. Please click the link in your email to activate your account.</>
                : <>Your account was created, but we could not send a verification email to <Text style={{ color: GREEN, fontWeight: '700' }}>{formData.email}</Text>.</>}
            </Text>

            {verificationEmailError ? <Text style={[styles.fieldError, { marginTop: 12, textAlign: 'center' }]}>{verificationEmailError}</Text> : null}
            {!verificationEmailSent && registeredUserId ? (
              <TouchableOpacity
                disabled={isRetryingVerificationEmail}
                onPress={() => {
                  setIsRetryingVerificationEmail(true);
                  setVerificationEmailError('');
                  void authService.resendRegistrationVerificationEmail(registeredUserId)
                    .then(() => setVerificationEmailSent(true))
                    .catch((error: unknown) => setVerificationEmailError(error instanceof Error ? error.message : 'Unable to resend the verification email.'))
                    .finally(() => setIsRetryingVerificationEmail(false));
                }}
                style={[styles.primaryButton, { marginTop: 18, width: '100%' }]}
              >
                {isRetryingVerificationEmail ? <Skeleton width={150} height={16} borderRadius={8} /> : <Text style={styles.primaryButtonText}>Retry verification email</Text>}
              </TouchableOpacity>
            ) : null}

            <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 18, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <Ionicons name="alert-circle" size={20} color="#eab308" />
              <Text style={{ flex: 1, color: '#94a3b8', fontSize: 13, lineHeight: 19 }}>
                Please check your inbox and spam folder. Click the link in the email to activate your account and start liming!
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                setShowSuccessModal(false);
                void registrationDraftService.clearPendingVerification();
                router.replace('/(auth)/login');
              }}
              style={[styles.primaryButton, { marginTop: 24, width: '100%' }]}
            >
              <Text style={styles.primaryButtonText}>Proceed to Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Location Picker Modals */}
      <LocationPickerModal
        visible={isCountryModalOpen}
        title="Select Country"
        placeholder="Search country..."
        items={COUNTRIES.map(c => ({ label: c.label, value: c.label, subtitle: c.value }))}
        selectedValue={formData.country}
        onSelect={handleCountrySelect}
        onClose={() => setIsCountryModalOpen(false)}
      />

      <LocationPickerModal
        visible={isStateModalOpen}
        title="Select State / Province"
        placeholder="Search state / province..."
        loading={statesLoading}
        items={states.map(s => ({ label: s.name, value: s.name, subtitle: s.state_code }))}
        selectedValue={formData.state}
        emptyText="No states found in database. Tap below to use your input."
        onSelect={handleStateSelect}
        onClose={() => setIsStateModalOpen(false)}
      />

      <LocationPickerModal
        visible={isCityModalOpen}
        title={isCaribbean ? "Select City / Region" : "Select City / Town"}
        placeholder="Search city / town..."
        loading={citiesLoading}
        items={cities.map(c => ({ label: c, value: c }))}
        selectedValue={formData.city}
        emptyText="No cities found in database. Tap below to use your input."
        onSelect={handleCitySelect}
        onClose={() => setIsCityModalOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
type RegistrationAvatarPreviewProps = { profilePicture: string | null };

/** The chosen preset avatar or uploaded photo on the interests preview card. */
function RegistrationAvatarPreview({ profilePicture }: RegistrationAvatarPreviewProps) {
  const presetAvatar = [...cartoonAvatars, ...realisticAvatars].find((avatar) => isSamePresetAvatar(profilePicture, avatar.id));
  const source = presetAvatar?.image ?? (profilePicture && /^(file:|content:|https?:)/i.test(profilePicture) ? { uri: profilePicture } : null);
  return (
    <View style={styles.previewAvatar}>
      {source ? <Image source={source} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <User size={48} color="#94a3b8" />}
    </View>
  );
}

/** Loading state shaped like the sign-up card (progress header, title, fields and button). */
function RegistrationSkeleton() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#000000' }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <View accessibilityLabel="Loading registration" style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        <Skeleton width={140} height={34} borderRadius={17} />
      </View>
      <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
        <View style={styles.glassCard}>
          <View style={{ alignItems: 'center' }}>
            <Skeleton width={80} height={80} borderRadius={40} />
            <Skeleton width="70%" height={26} style={{ marginTop: 16 }} />
            <Skeleton width="85%" height={14} style={{ marginTop: 10 }} />
          </View>
          <Skeleton height={74} borderRadius={16} style={{ marginTop: 24 }} />
          <Skeleton height={74} borderRadius={16} style={{ marginTop: 12 }} />
          <Skeleton height={50} borderRadius={14} style={{ marginTop: 28 }} />
          <Skeleton width="60%" height={14} style={{ marginTop: 20, alignSelf: 'center' }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  invitationBadge: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(1,235,83,0.3)',
    backgroundColor: 'rgba(1,235,83,0.1)',
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 6,
  },
  previewCard: {
    width: '100%',
    marginTop: 20,
    marginBottom: 24,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  previewAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    borderWidth: 4,
    borderColor: 'rgba(16,185,129,0.6)',
  },
  previewInterest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
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
  ageAlertCard: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    padding: 16,
    alignItems: 'center',
    marginVertical: 10,
  },
  ageAlertText: {
    color: '#fca5a5',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 12,
  },
  switchStudentButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    width: '100%',
  },
  switchStudentButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
