import { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { authService, type UserProfile } from '@/lib/services/AuthService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';

const GREEN = '#01eb53';
const GREEN_DARK = '#10b981';

export type VerificationUploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUploaded?: () => void;
};

type IdType = 'national_id' | 'student_id' | 'passport' | 'guardian' | 'drivers_license';

type IdTypeConfig = {
  value: IdType;
  label: string;
  description: string;
  minAge?: number;
  maxAge?: number;
};

const ID_TYPES: IdTypeConfig[] = [
  { value: 'national_id', label: 'National ID', description: 'Government-issued National ID Card', minAge: 16 },
  { value: 'passport', label: 'Passport', description: 'International passport', minAge: 16 },
  { value: 'drivers_license', label: "Driver's License", description: "Valid Driver's License", minAge: 17 },
  { value: 'student_id', label: 'Student ID', description: 'School or university ID card', maxAge: 25 },
  { value: 'guardian', label: 'Guardian', description: 'Parent or guardian verification', maxAge: 17 },
];

const UPLOAD_LABELS: Record<IdType, { face: string; front: string; back?: string }> = {
  national_id: {
    face: 'Photo of you holding your ID (face + ID visible)',
    front: 'Clear photo of your ID (front)',
    back: 'Clear photo of your ID (back)',
  },
  student_id: {
    face: 'Photo of you holding your Student ID (face + ID visible)',
    front: 'Clear photo of your Student ID (front)',
    back: 'Clear photo of your Student ID (back)',
  },
  passport: {
    face: 'Photo of you holding your passport (face + passport visible)',
    front: 'Clear photo of your passport data page',
  },
  drivers_license: {
    face: "Photo of you holding your Driver's License (face + license visible)",
    front: "Clear photo of your Driver's License (front)",
    back: "Clear photo of your Driver's License (back)",
  },
  guardian: {
    face: 'Photo of Guardian holding their ID (face + ID visible)',
    front: "Clear photo of Guardian's ID (front)",
    back: "Clear photo of Guardian's ID (back)",
  },
};

type DocSlot = 'face' | 'front' | 'back';

type UploadedDoc = {
  uri: string;
  fileName: string;
};

function calculateAge(dateOfBirth: string): number {
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return 18;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export default function VerificationUploadModal({
  isOpen,
  onClose,
  onUploaded,
}: VerificationUploadModalProps) {
  const { colors, isDark } = useAppTheme();

  const [selectedType, setSelectedType] = useState<IdType | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Docs
  const [faceDoc, setFaceDoc] = useState<UploadedDoc | null>(null);
  const [frontDoc, setFrontDoc] = useState<UploadedDoc | null>(null);
  const [backDoc, setBackDoc] = useState<UploadedDoc | null>(null);

  // Modals & status
  const [activePickerSlot, setActivePickerSlot] = useState<DocSlot | null>(null);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch current user age
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const loadProfile = async () => {
      const user = authService.getCurrentUser();
      if (!user) return;
      setLoadingProfile(true);
      try {
        const profile = await authService.getUserProfile(user.uid);
        if (isMounted && profile) {
          setUserProfile(profile);
        }
      } catch (err) {
        console.warn('Failed to load profile for verification:', err);
      } finally {
        if (isMounted) setLoadingProfile(false);
      }
    };

    void loadProfile();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const userDateOfBirth = userProfile?.dateOfBirth;
  const userAge = useMemo(() => {
    if (!userDateOfBirth) return 18;
    return calculateAge(userDateOfBirth);
  }, [userDateOfBirth]);

  const availableTypes = useMemo(() => {
    return ID_TYPES.filter((t) => {
      if (t.minAge !== undefined && userAge < t.minAge) return false;
      if (t.maxAge !== undefined && userAge > t.maxAge) return false;
      return true;
    });
  }, [userAge]);

  const needsBackSlot = selectedType !== 'passport';

  const canSubmit = useMemo(() => {
    if (!selectedType || !faceDoc || !frontDoc) return false;
    if (needsBackSlot && !backDoc) return false;
    return true;
  }, [selectedType, faceDoc, frontDoc, backDoc, needsBackSlot]);

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
        setErrorMessage('');
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
        setErrorMessage('');
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

  const handleSubmit = async () => {
    if (!selectedType || !faceDoc || !frontDoc) {
      setErrorMessage('Please upload all required ID document photos.');
      return;
    }
    if (needsBackSlot && !backDoc) {
      setErrorMessage('Please upload the back photo of your ID.');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');
    try {
      const isPassport = selectedType === 'passport';
      const resolvedVerificationType = isPassport ? 'national_id' : selectedType;
      const resolvedIdSubType = isPassport ? 'passport' : selectedType === 'national_id' ? 'national_id' : null;

      await authService.uploadVerificationDocuments({
        files: {
          faceUri: faceDoc.uri,
          frontUri: frontDoc.uri,
          backUri: needsBackSlot && backDoc ? backDoc.uri : undefined,
        },
        verificationType: resolvedVerificationType,
        idSubType: resolvedIdSubType,
      });

      setIsSuccess(true);
      onUploaded?.();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to upload documents. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetAndClose = () => {
    setSelectedType(null);
    setFaceDoc(null);
    setFrontDoc(null);
    setBackDoc(null);
    setIsSuccess(false);
    setErrorMessage('');
    onClose();
  };

  if (!isOpen) return null;

  const uploadLabels = selectedType ? UPLOAD_LABELS[selectedType] : null;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleResetAndClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.dialog,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {/* ── Dialog Header ── */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.shieldBadge}>
                <Ionicons name="shield-checkmark" size={20} color={GREEN} />
              </View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Verify Your Account</Text>
            </View>
            <TouchableOpacity onPress={handleResetAndClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </TouchableOpacity>
          </View>

          {/* ── Success View ── */}
          {isSuccess ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <View style={styles.successIconBox}>
                <Ionicons name="checkmark-circle" size={44} color={GREEN} />
              </View>
              <Text style={[styles.successTitle, { color: colors.text }]}>Documents Uploaded!</Text>
              <Text style={[styles.successDesc, { color: colors.mutedText }]}>
                Your verification documents have been submitted securely. An administrator will review them within 1-2 business days.
              </Text>
              <TouchableOpacity
                onPress={handleResetAndClose}
                style={[styles.primaryButton, { width: '100%', marginTop: 20 }]}
              >
                <Text style={styles.primaryButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 20, gap: 16 }}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.introText, { color: colors.mutedText }]}>
                Select your ID type and upload clear photos of your document. This protects our community and unlocks full posting privileges.
              </Text>

              {/* ── ID Type Selector ── */}
              <View>
                <Text style={[styles.sectionLabel, { color: colors.text }]}>Choose ID Type</Text>
                {loadingProfile ? (
                  <ActivityIndicator color={GREEN} style={{ marginVertical: 10 }} />
                ) : (
                  <View style={{ gap: 8, marginTop: 6 }}>
                    {availableTypes.map((type) => {
                      const isSelected = selectedType === type.value;
                      return (
                        <TouchableOpacity
                          key={type.value}
                          onPress={() => {
                            setSelectedType(type.value);
                            setBackDoc(null);
                            setErrorMessage('');
                          }}
                          style={[
                            styles.typeCard,
                            { borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                            isSelected && styles.typeCardSelected,
                          ]}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                            size={18}
                            color={isSelected ? GREEN : colors.mutedText}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.typeTitle, { color: isSelected ? GREEN : colors.text }]}>
                              {type.label}
                            </Text>
                            <Text style={[styles.typeDesc, { color: colors.mutedText }]}>
                              {type.description}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>

              {/* ── Upload Slots ── */}
              {selectedType && uploadLabels ? (
                <View style={{ gap: 12 }}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Supporting Photos</Text>

                  {/* Slot 1: Face holding ID */}
                  <UploadSlotItem
                    title={uploadLabels.face}
                    doc={faceDoc}
                    onPressUpload={() => setActivePickerSlot('face')}
                    onPressPreview={(uri) => setLightboxUri(uri)}
                    onPressRemove={() => handleClearDoc('face')}
                    colors={colors}
                    isDark={isDark}
                  />

                  {/* Slot 2: Front ID */}
                  <UploadSlotItem
                    title={uploadLabels.front}
                    doc={frontDoc}
                    onPressUpload={() => setActivePickerSlot('front')}
                    onPressPreview={(uri) => setLightboxUri(uri)}
                    onPressRemove={() => handleClearDoc('front')}
                    colors={colors}
                    isDark={isDark}
                  />

                  {/* Slot 3: Back ID (Omitted for passport) */}
                  {needsBackSlot && (
                    <UploadSlotItem
                      title={uploadLabels.back ?? 'Clear photo of your ID (back)'}
                      doc={backDoc}
                      onPressUpload={() => setActivePickerSlot('back')}
                      onPressPreview={(uri) => setLightboxUri(uri)}
                      onPressRemove={() => handleClearDoc('back')}
                      colors={colors}
                      isDark={isDark}
                    />
                  )}
                </View>
              ) : null}

              {/* ── Error Banner ── */}
              {errorMessage ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={18} color="#ef4444" style={{ marginTop: 1 }} />
                  <Text style={styles.errorBoxText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* ── Action Buttons ── */}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  onPress={handleResetAndClose}
                  disabled={isUploading}
                  style={[styles.secondaryButton, { borderColor: colors.border }]}
                >
                  <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={isUploading || !canSubmit}
                  style={[
                    styles.primaryButton,
                    { flex: 2 },
                    (!canSubmit || isUploading) && { opacity: 0.5 },
                  ]}
                >
                  {isUploading ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator color="#ffffff" size="small" />
                      <Text style={styles.primaryButtonText}>Uploading...</Text>
                    </View>
                  ) : (
                    <Text style={styles.primaryButtonText}>Submit Verification</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>

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

      {/* ── Lightbox Preview Modal ── */}
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
    </Modal>
  );
}

function UploadSlotItem({
  title,
  doc,
  onPressUpload,
  onPressPreview,
  onPressRemove,
  colors,
  isDark,
}: {
  title: string;
  doc: UploadedDoc | null;
  onPressUpload: () => void;
  onPressPreview: (uri: string) => void;
  onPressRemove: () => void;
  colors: { surface: string; border: string; text: string; mutedText: string };
  isDark: boolean;
}) {
  return (
    <View
      style={[
        styles.uploadSlot,
        { borderColor: doc ? 'rgba(16,185,129,0.4)' : colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
        doc && styles.uploadSlotUploaded,
      ]}
    >
      {doc ? (
        <TouchableOpacity onPress={() => onPressPreview(doc.uri)} style={styles.thumbBox}>
          <Image source={{ uri: doc.uri }} style={styles.thumbImage} resizeMode="cover" />
          <View style={styles.thumbOverlay}>
            <Ionicons name="eye-outline" size={13} color="#ffffff" />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.slotIconBox}>
          <Ionicons name="cloud-upload-outline" size={20} color={colors.mutedText} />
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.slotTitle, { color: doc ? GREEN : colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        {doc ? (
          <Text style={[styles.slotFileName, { color: colors.mutedText }]} numberOfLines={1}>
            {doc.fileName}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <TouchableOpacity
          onPress={onPressUpload}
          style={[styles.uploadButton, doc && styles.uploadButtonChange]}
        >
          <Text style={[styles.uploadButtonText, doc && styles.uploadButtonTextChange]}>
            {doc ? 'Change' : 'Upload'}
          </Text>
        </TouchableOpacity>
        {doc ? (
          <TouchableOpacity onPress={onPressRemove} style={{ padding: 4 }}>
            <Ionicons name="trash-outline" size={16} color="#ef4444" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  shieldBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  closeButton: {
    padding: 6,
  },
  introText: {
    fontSize: 13,
    lineHeight: 19,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  typeCardSelected: {
    borderColor: GREEN_DARK,
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  typeDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  uploadSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  uploadSlotUploaded: {
    borderStyle: 'solid',
    backgroundColor: 'rgba(16,185,129,0.06)',
  },
  slotIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  slotFileName: {
    fontSize: 10,
    marginTop: 2,
  },
  uploadButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  uploadButtonChange: {
    backgroundColor: 'rgba(16,185,129,0.2)',
  },
  uploadButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  uploadButtonTextChange: {
    color: GREEN,
  },
  primaryButton: {
    backgroundColor: GREEN_DARK,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  successIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  successDesc: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
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
