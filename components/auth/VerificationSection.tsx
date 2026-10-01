import { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { RegistrationVerificationType } from '@/lib/services/AuthService';

const GREEN = '#01eb53';
const GREEN_DARK = '#10b981';

export type VerificationSectionProps = {
  dateOfBirth: string;
  accountType?: 'student' | 'regular' | '';
  isSubmitting: boolean;
  submissionError?: string;
  onSkipVerification: () => void;
  onSubmitVerification: (data: {
    verificationType: RegistrationVerificationType;
    idSubType: 'national_id' | 'passport' | null;
    guardianRelation: 'biological_parent' | 'legal_guardian' | null;
    guardianEmail: string;
    documents: {
      faceUri: string;
      frontUri: string;
      backUri?: string;
    };
  }) => void;
  onBackToInterests: () => void;
};

type DocSlot = 'face' | 'front' | 'back';

type UploadedDoc = {
  uri: string;
  fileName: string;
};

export default function VerificationSection({
  dateOfBirth,
  accountType,
  isSubmitting,
  submissionError,
  onSkipVerification,
  onSubmitVerification,
  onBackToInterests,
}: VerificationSectionProps) {
  // Substep: 0 = Benefits, 1 = Choose Method, 2 = Upload Docs, 3 = Review & Submit
  const [subStep, setSubStep] = useState<0 | 1 | 2 | 3>(0);
  const [verificationType, setVerificationType] = useState<RegistrationVerificationType>('');
  const [idSubType, setIdSubType] = useState<'national_id' | 'passport' | null>(null);
  const [guardianRelation, setGuardianRelation] = useState<'biological_parent' | 'legal_guardian' | null>(null);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  // Uploaded docs
  const [faceDoc, setFaceDoc] = useState<UploadedDoc | null>(null);
  const [frontDoc, setFrontDoc] = useState<UploadedDoc | null>(null);
  const [backDoc, setBackDoc] = useState<UploadedDoc | null>(null);

  // Modals
  const [activePickerSlot, setActivePickerSlot] = useState<DocSlot | null>(null);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');

  // Calculate age from DOB
  const age = useMemo(() => {
    if (!dateOfBirth) return 18;
    const dob = new Date(dateOfBirth);
    if (Number.isNaN(dob.getTime())) return 18;
    const today = new Date();
    let a = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      a--;
    }
    return a;
  }, [dateOfBirth]);

  const handleMethodSelect = (method: 'student_id' | 'national_id' | 'guardian' | 'drivers_license') => {
    setVerificationType(method);
    if (method !== 'guardian') setGuardianRelation(null);
    if (method !== 'national_id') setIdSubType(null);
  };

  const handleIdSubTypeSelect = (subType: 'national_id' | 'passport') => {
    setVerificationType('national_id');
    setIdSubType(subType);
  };

  const handleNextToUpload = () => {
    if (!verificationType) return;
    if (verificationType === 'guardian' && !guardianRelation) return;
    if (verificationType === 'national_id' && !idSubType) return;
    setSubStep(2);
  };

  const handleNextToReview = () => {
    setUploadError('');
    if (verificationType === 'guardian') {
      if (!guardianEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guardianEmail.trim())) {
        setEmailError('Please enter a valid guardian email address');
        return;
      }
      setEmailError('');
    }

    // Validate docs
    if (!faceDoc) {
      setUploadError('Please upload a photo of yourself holding your ID.');
      return;
    }
    if (!frontDoc) {
      setUploadError('Please upload the front photo of your ID.');
      return;
    }
    if (!(verificationType === 'national_id' && idSubType === 'passport') && !backDoc) {
      setUploadError('Please upload the back photo of your ID.');
      return;
    }

    setSubStep(3);
  };

  const handleFinalSubmit = () => {
    if (!faceDoc || !frontDoc) return;
    onSubmitVerification({
      verificationType,
      idSubType,
      guardianRelation,
      guardianEmail: guardianEmail.trim(),
      documents: {
        faceUri: faceDoc.uri,
        frontUri: frontDoc.uri,
        backUri: backDoc?.uri,
      },
    });
  };

  // Image capture via camera
  const handleLaunchCamera = async () => {
    const slot = activePickerSlot;
    setActivePickerSlot(null);
    if (!slot) return;

    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Camera permission is required to capture your ID document.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const asset = result.assets[0];
        const doc: UploadedDoc = {
          uri: asset.uri,
          fileName: asset.fileName || `${slot}_id_${Date.now()}.jpg`,
        };
        if (slot === 'face') setFaceDoc(doc);
        else if (slot === 'front') setFrontDoc(doc);
        else setBackDoc(doc);
      }
    } catch {
      Alert.alert('Error', 'Could not open camera.');
    }
  };

  // Image selection via photo library
  const handleLaunchLibrary = async () => {
    const slot = activePickerSlot;
    setActivePickerSlot(null);
    if (!slot) return;

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission Required', 'Photo library permission is required to select your ID document.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const asset = result.assets[0];
        const doc: UploadedDoc = {
          uri: asset.uri,
          fileName: asset.fileName || `${slot}_id_${Date.now()}.jpg`,
        };
        if (slot === 'face') setFaceDoc(doc);
        else if (slot === 'front') setFrontDoc(doc);
        else setBackDoc(doc);
      }
    } catch {
      Alert.alert('Error', 'Could not open photo library.');
    }
  };

  const handleClearDoc = (slot: DocSlot) => {
    if (slot === 'face') setFaceDoc(null);
    else if (slot === 'front') setFrontDoc(null);
    else setBackDoc(null);
  };

  const getMethodTitle = () => {
    if (verificationType === 'national_id' && idSubType === 'passport') return 'Passport';
    if (verificationType === 'national_id') return 'National ID';
    if (verificationType === 'drivers_license') return "Driver's License";
    if (verificationType === 'student_id') return 'Student ID';
    if (verificationType === 'guardian') {
      const rel = guardianRelation === 'biological_parent' ? 'Biological Parent' : 'Legal Guardian';
      return `Guardian (${rel})`;
    }
    return 'Identity Verification';
  };

  return (
    <View>
      {/* ── SUBSTEP 0: Benefits View ── */}
      {subStep === 0 && (
        <View style={{ alignItems: 'center' }}>
          <View style={styles.topBackContainer}>
            <TouchableOpacity onPress={onBackToInterests} style={styles.backRow}>
              <Ionicons name="arrow-back" size={16} color="#94a3b8" />
              <Text style={styles.backRowText}>Back to Interests</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.shieldIconBox}>
            <Ionicons name="shield-checkmark" size={38} color={GREEN} />
          </View>
          <Text style={styles.stepTitleCenter}>✨ Get Your Verified Lime Badge</Text>
          <Text style={styles.stepSubtitleCenter}>
            Help keep Ourlime safe and unlock the full experience!
          </Text>

          {/* Benefits Card */}
          <View style={styles.benefitsCard}>
            <Text style={styles.benefitsTitle}>Benefits of verification:</Text>
            <View style={{ gap: 10 }}>
              {[
                'Build trust with others',
                'Access private communities',
                'Create your own communities',
                'Unlock additional platform features',
                'Help reduce fake accounts',
              ].map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={18} color={GREEN} />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Warning Banner */}
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={20} color="#facc15" style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.warningTitle}>Some features require verification</Text>
              <Text style={styles.warningDesc}>
                Access to the Marketplace, creating events, and posting in certain communities will be restricted to verified members only. If you skip now, you can always verify later from your profile settings.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => setSubStep(1)}
            style={styles.primaryButton}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryButtonText}>Get Verified Now</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSkipVerification}
            disabled={isSubmitting}
            style={styles.secondaryButton}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#94a3b8" />
            ) : (
              <Text style={styles.secondaryButtonText}>I&apos;ll do this later</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── SUBSTEP 1: Choose Method ── */}
      {subStep === 1 && (
        <View>
          <View style={styles.topBackContainer}>
            <TouchableOpacity onPress={() => setSubStep(0)} style={styles.backRow}>
              <Ionicons name="arrow-back" size={16} color="#94a3b8" />
              <Text style={styles.backRowText}>Back</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.stepTitle}>Choose Verification Method</Text>
          <Text style={styles.stepSubtitle}>Select how you&apos;d like to verify your identity.</Text>

          <View style={{ gap: 12, marginVertical: 14 }}>
            {/* National ID */}
            {age >= 16 && (
              <TouchableOpacity
                onPress={() => handleIdSubTypeSelect('national_id')}
                style={[styles.typeCard, idSubType === 'national_id' && styles.typeCardActive]}
                activeOpacity={0.8}
              >
                <View style={[styles.typeIconBox, idSubType === 'national_id' && { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
                  <Ionicons name="card-outline" size={24} color={idSubType === 'national_id' ? GREEN : '#94a3b8'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeCardTitle, idSubType === 'national_id' && { color: GREEN }]}>National ID</Text>
                  <Text style={styles.typeCardDesc}>Government-issued National ID Card</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Passport */}
            {age >= 16 && (
              <TouchableOpacity
                onPress={() => handleIdSubTypeSelect('passport')}
                style={[styles.typeCard, idSubType === 'passport' && styles.typeCardActive]}
                activeOpacity={0.8}
              >
                <View style={[styles.typeIconBox, idSubType === 'passport' && { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
                  <Ionicons name="book-outline" size={24} color={idSubType === 'passport' ? GREEN : '#94a3b8'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeCardTitle, idSubType === 'passport' && { color: GREEN }]}>Passport</Text>
                  <Text style={styles.typeCardDesc}>International passport (front/data page only)</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Driver's License */}
            {age >= 17 && (
              <TouchableOpacity
                onPress={() => handleMethodSelect('drivers_license')}
                style={[styles.typeCard, verificationType === 'drivers_license' && styles.typeCardActive]}
                activeOpacity={0.8}
              >
                <View style={[styles.typeIconBox, verificationType === 'drivers_license' && { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
                  <Ionicons name="car-outline" size={24} color={verificationType === 'drivers_license' ? GREEN : '#94a3b8'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeCardTitle, verificationType === 'drivers_license' && { color: GREEN }]}>Driver&apos;s License</Text>
                  <Text style={styles.typeCardDesc}>Valid Government Driver&apos;s License</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Student ID */}
            {accountType === 'student' && (
              <TouchableOpacity
                onPress={() => handleMethodSelect('student_id')}
                style={[styles.typeCard, verificationType === 'student_id' && styles.typeCardActive]}
                activeOpacity={0.8}
              >
                <View style={[styles.typeIconBox, verificationType === 'student_id' && { backgroundColor: 'rgba(59,130,246,0.2)' }]}>
                  <Ionicons name="school-outline" size={24} color={verificationType === 'student_id' ? '#60a5fa' : '#94a3b8'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeCardTitle, verificationType === 'student_id' && { color: '#60a5fa' }]}>Student ID</Text>
                  <Text style={styles.typeCardDesc}>Current valid School or University ID</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Guardian Verification */}
            {age < 18 && (
              <TouchableOpacity
                onPress={() => handleMethodSelect('guardian')}
                style={[styles.typeCard, verificationType === 'guardian' && styles.typeCardActive]}
                activeOpacity={0.8}
              >
                <View style={[styles.typeIconBox, verificationType === 'guardian' && { backgroundColor: 'rgba(168,85,247,0.2)' }]}>
                  <Ionicons name="people-outline" size={24} color={verificationType === 'guardian' ? '#c084fc' : '#94a3b8'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.typeCardTitle, verificationType === 'guardian' && { color: '#c084fc' }]}>Guardian Verification</Text>
                  <Text style={styles.typeCardDesc}>Requires Parent/Guardian ID and consent</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          {/* Guardian Relationship Selector */}
          {verificationType === 'guardian' && (
            <View style={{ marginTop: 10, marginBottom: 20 }}>
              <Text style={styles.label}>Are you the biological parent or legal guardian of this child?</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  onPress={() => setGuardianRelation('biological_parent')}
                  style={[styles.guardianOption, guardianRelation === 'biological_parent' && styles.guardianOptionActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.guardianOptionText, guardianRelation === 'biological_parent' && styles.guardianOptionTextActive]}>
                    Biological Parent
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setGuardianRelation('legal_guardian')}
                  style={[styles.guardianOption, guardianRelation === 'legal_guardian' && styles.guardianOptionActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.guardianOptionText, guardianRelation === 'legal_guardian' && styles.guardianOptionTextActive]}>
                    Legal Guardian
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Continue Button */}
          <TouchableOpacity
            onPress={handleNextToUpload}
            disabled={
              !verificationType ||
              (verificationType === 'guardian' && !guardianRelation) ||
              (verificationType === 'national_id' && !idSubType)
            }
            style={[
              styles.primaryButton,
              (!verificationType ||
                (verificationType === 'guardian' && !guardianRelation) ||
                (verificationType === 'national_id' && !idSubType)) && { opacity: 0.4 },
              { marginTop: 16 },
            ]}
          >
            <Text style={styles.primaryButtonText}>Continue →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── SUBSTEP 2: Upload Documents ── */}
      {subStep === 2 && (
        <View>
          <View style={styles.topBackContainer}>
            <TouchableOpacity onPress={() => setSubStep(1)} style={styles.backRow}>
              <Ionicons name="arrow-back" size={16} color="#94a3b8" />
              <Text style={styles.backRowText}>Back</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.stepTitle}>Upload Documents</Text>
          <Text style={styles.stepSubtitle}>
            {verificationType === 'guardian'
              ? "Please provide your parent/guardian's details and ID."
              : verificationType === 'national_id' && idSubType === 'passport'
              ? 'Please upload a clear photo of your passport.'
              : verificationType === 'drivers_license'
              ? "Please upload clear photos of your Driver's License."
              : 'Please upload clear photos of your ID.'}
          </Text>

          {/* Guardian Email Field */}
          {verificationType === 'guardian' && (
            <View style={styles.guardianEmailCard}>
              <Text style={styles.label}>
                Parent or Guardian Email <Text style={{ color: '#f87171' }}>*</Text>
              </Text>
              <Text style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                A parent or guardian must verify this account.
              </Text>
              <TextInput
                autoCapitalize="none"
                keyboardType="email-address"
                value={guardianEmail}
                onChangeText={(text) => {
                  setGuardianEmail(text);
                  setEmailError('');
                }}
                placeholder="guardian@example.com"
                placeholderTextColor="#64748b"
                style={styles.input}
              />
              {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
            </View>
          )}

          {/* Upload Slots */}
          <View style={{ gap: 14, marginVertical: 14 }}>
            {/* Slot 1: Face + ID */}
            <UploadBox
              title={
                verificationType === 'guardian'
                  ? 'Photo of Guardian holding their ID (face + ID visible)'
                  : 'Photo of you holding your ID (face + ID visible)'
              }
              doc={faceDoc}
              onPressUpload={() => setActivePickerSlot('face')}
              onPressPreview={(uri) => setLightboxUri(uri)}
              onPressRemove={() => handleClearDoc('face')}
            />

            {/* Slot 2: Front ID */}
            <UploadBox
              title={
                verificationType === 'guardian'
                  ? "Clear photo of Guardian's ID (front)"
                  : 'Clear photo of your ID (front)'
              }
              doc={frontDoc}
              onPressUpload={() => setActivePickerSlot('front')}
              onPressPreview={(uri) => setLightboxUri(uri)}
              onPressRemove={() => handleClearDoc('front')}
            />

            {/* Slot 3: Back ID (Omitted for Passport) */}
            {!(verificationType === 'national_id' && idSubType === 'passport') && (
              <UploadBox
                title={
                  verificationType === 'guardian'
                    ? "Clear photo of Guardian's ID (back)"
                    : 'Clear photo of your ID (back)'
                }
                doc={backDoc}
                onPressUpload={() => setActivePickerSlot('back')}
                onPressPreview={(uri) => setLightboxUri(uri)}
                onPressRemove={() => handleClearDoc('back')}
              />
            )}
          </View>

          {uploadError ? <Text style={[styles.fieldError, { marginBottom: 12 }]}>{uploadError}</Text> : null}

          <TouchableOpacity onPress={handleNextToReview} style={[styles.primaryButton, { marginTop: 10 }]}>
            <Text style={styles.primaryButtonText}>Review Details →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── SUBSTEP 3: Review & Submit ── */}
      {subStep === 3 && (
        <View style={{ alignItems: 'center' }}>
          <View style={styles.topBackContainer}>
            <TouchableOpacity onPress={() => setSubStep(2)} style={styles.backRow}>
              <Ionicons name="arrow-back" size={16} color="#94a3b8" />
              <Text style={styles.backRowText}>Back to Uploads</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.checkIconBox}>
            <Ionicons name="checkmark-circle" size={42} color={GREEN} />
          </View>
          <Text style={styles.stepTitleCenter}>Review & Submit</Text>
          <Text style={styles.stepSubtitleCenter}>
            You&apos;re almost done! Please review your verification details.
          </Text>

          {/* Details Summary Card */}
          <View style={styles.reviewCard}>
            <View style={styles.reviewItem}>
              <Text style={styles.reviewLabel}>Verification Method</Text>
              <Text style={styles.reviewValue}>{getMethodTitle()}</Text>
            </View>

            {verificationType === 'guardian' && (
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Guardian Email</Text>
                <Text style={styles.reviewValue}>{guardianEmail}</Text>
              </View>
            )}

            <View style={{ marginTop: 4 }}>
              <Text style={[styles.reviewLabel, { marginBottom: 8 }]}>Uploaded Documents</Text>
              <View style={{ gap: 8 }}>
                {faceDoc && (
                  <ReviewDocItem
                    title="Face + ID Photo"
                    doc={faceDoc}
                    onPreview={(uri) => setLightboxUri(uri)}
                  />
                )}
                {frontDoc && (
                  <ReviewDocItem
                    title="ID (Front)"
                    doc={frontDoc}
                    onPreview={(uri) => setLightboxUri(uri)}
                  />
                )}
                {backDoc && !(verificationType === 'national_id' && idSubType === 'passport') && (
                  <ReviewDocItem
                    title="ID (Back)"
                    doc={backDoc}
                    onPreview={(uri) => setLightboxUri(uri)}
                  />
                )}
              </View>
            </View>
          </View>

          {submissionError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color="#ef4444" style={{ marginTop: 1 }} />
              <Text style={styles.errorBoxText}>{submissionError}</Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 }}>
            <TouchableOpacity
              onPress={() => setSubStep(2)}
              disabled={isSubmitting}
              style={[styles.secondaryButton, { flex: 1, paddingVertical: 14 }]}
            >
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleFinalSubmit}
              disabled={isSubmitting}
              style={[styles.primaryButton, { flex: 2 }]}
            >
              {isSubmitting ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.primaryButtonText}>Uploading...</Text>
                </View>
              ) : (
                <Text style={styles.primaryButtonText}>Complete Registration 🎉</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Photo Picker Action Modal ── */}
      <Modal visible={activePickerSlot !== null} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActivePickerSlot(null)}
        >
          <View style={styles.actionSheet}>
            <Text style={styles.actionSheetTitle}>Select ID Document</Text>
            <TouchableOpacity onPress={handleLaunchCamera} style={styles.actionSheetOption}>
              <Ionicons name="camera-outline" size={22} color={GREEN} style={{ marginRight: 12 }} />
              <Text style={styles.actionSheetText}>Take Photo with Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLaunchLibrary} style={styles.actionSheetOption}>
              <Ionicons name="images-outline" size={22} color="#60a5fa" style={{ marginRight: 12 }} />
              <Text style={styles.actionSheetText}>Choose from Photo Library</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActivePickerSlot(null)}
              style={[styles.actionSheetOption, { borderBottomWidth: 0, marginTop: 4 }]}
            >
              <Text style={[styles.actionSheetText, { color: '#94a3b8', textAlign: 'center', width: '100%' }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Fullscreen Lightbox Modal ── */}
      <Modal visible={lightboxUri !== null} transparent animationType="fade">
        <View style={styles.lightboxContainer}>
          <TouchableOpacity onPress={() => setLightboxUri(null)} style={styles.lightboxCloseButton}>
            <Ionicons name="close" size={28} color="#ffffff" />
          </TouchableOpacity>
          {lightboxUri ? (
            <Image
              source={{ uri: lightboxUri }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function UploadBox({
  title,
  doc,
  onPressUpload,
  onPressPreview,
  onPressRemove,
}: {
  title: string;
  doc: UploadedDoc | null;
  onPressUpload: () => void;
  onPressPreview: (uri: string) => void;
  onPressRemove: () => void;
}) {
  return (
    <View style={[styles.uploadBox, doc && styles.uploadBoxUploaded]}>
      {doc ? (
        <TouchableOpacity onPress={() => onPressPreview(doc.uri)} style={styles.thumbnailContainer}>
          <Image source={{ uri: doc.uri }} style={styles.thumbnailImage} resizeMode="cover" />
          <View style={styles.thumbnailOverlay}>
            <Ionicons name="eye-outline" size={14} color="#ffffff" />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.uploadIconContainer}>
          <Ionicons name="cloud-upload-outline" size={22} color="#94a3b8" />
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.uploadBoxTitle, doc && { color: GREEN }]} numberOfLines={2}>
          {title}
        </Text>
        {doc ? (
          <Text style={styles.uploadBoxFileName} numberOfLines={1}>
            {doc.fileName}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TouchableOpacity
          onPress={onPressUpload}
          style={[styles.uploadActionButton, doc && styles.uploadActionButtonChange]}
        >
          <Text style={[styles.uploadActionText, doc && styles.uploadActionTextChange]}>
            {doc ? 'Change' : 'Upload'}
          </Text>
        </TouchableOpacity>
        {doc ? (
          <TouchableOpacity onPress={onPressRemove} style={styles.removeButton}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function ReviewDocItem({
  title,
  doc,
  onPreview,
}: {
  title: string;
  doc: UploadedDoc;
  onPreview: (uri: string) => void;
}) {
  return (
    <View style={styles.reviewDocRow}>
      <TouchableOpacity onPress={() => onPreview(doc.uri)} style={styles.reviewDocThumb}>
        <Image source={{ uri: doc.uri }} style={styles.reviewDocThumbImg} resizeMode="cover" />
      </TouchableOpacity>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.reviewDocTitle}>{title}</Text>
        <Text style={styles.reviewDocName} numberOfLines={1}>
          {doc.fileName}
        </Text>
      </View>
      <Ionicons name="checkmark-circle" size={20} color={GREEN} />
    </View>
  );
}

const styles = StyleSheet.create({
  topBackContainer: {
    width: '100%',
    marginBottom: 12,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  backRowText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  stepTitleCenter: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 12,
  },
  stepSubtitleCenter: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  shieldIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
  },
  checkIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  benefitsCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 18,
    marginBottom: 16,
  },
  benefitsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    fontSize: 14,
    color: '#cbd5e1',
    flex: 1,
  },
  warningBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(234,179,8,0.12)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(234,179,8,0.3)',
    padding: 14,
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fde047',
    marginBottom: 4,
  },
  warningDesc: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
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
  secondaryButton: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  typeCardActive: {
    borderColor: GREEN_DARK,
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  typeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  typeCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  typeCardDesc: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  guardianOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  guardianOptionActive: {
    borderColor: GREEN_DARK,
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  guardianOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
  },
  guardianOptionTextActive: {
    color: GREEN,
    fontWeight: '700',
  },
  guardianEmailCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 14,
    marginBottom: 14,
  },
  input: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 14,
  },
  fieldError: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  uploadBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  uploadBoxUploaded: {
    borderStyle: 'solid',
    borderColor: 'rgba(16,185,129,0.4)',
    backgroundColor: 'rgba(16,185,129,0.06)',
  },
  uploadIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailContainer: {
    width: 50,
    height: 50,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBoxTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  uploadBoxFileName: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  uploadActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  uploadActionButtonChange: {
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  uploadActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  uploadActionTextChange: {
    color: GREEN,
  },
  removeButton: {
    padding: 6,
  },
  reviewCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  reviewItem: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 10,
  },
  reviewLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 3,
  },
  reviewValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  reviewDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  reviewDocThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
    overflow: 'hidden',
  },
  reviewDocThumbImg: {
    width: '100%',
    height: '100%',
  },
  reviewDocTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  reviewDocName: {
    fontSize: 10,
    color: '#94a3b8',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    marginBottom: 12,
  },
  errorBoxText: {
    fontSize: 12,
    color: '#fca5a5',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionSheetTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
  },
  actionSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  actionSheetText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  lightboxContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  lightboxImage: {
    width: '90%',
    height: '75%',
  },
});
