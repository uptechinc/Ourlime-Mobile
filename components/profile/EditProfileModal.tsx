import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { AuthService, type UserProfile } from '@/lib/services/AuthService';
import { profileResourceService } from '@/lib/services/ProfileResourceService';
import { feedResourceService } from '@/lib/services/FeedResourceService';
import { ProfileMediaService } from '@/lib/services/ProfileMediaService';
import CustomModal from '@/components/ui/CustomModal';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';

const authService = AuthService.getInstance();
const profileMediaService = ProfileMediaService.getInstance();

type EditProfileModalProps = {
  visible: boolean;
  profile: UserProfile;
  onClose: () => void;
  onProfileUpdated: () => void;
};

export default function EditProfileModal({
  visible,
  profile,
  onClose,
  onProfileUpdated,
}: EditProfileModalProps) {
  const { colors } = useAppTheme();
  const [firstName, setFirstName] = useState(profile.firstName || '');
  const [lastName, setLastName] = useState(profile.lastName || '');
  const [userName, setUserName] = useState(profile.userName || '');
  const [bio, setBio] = useState(profile.bio || '');
  const [location, setLocation] = useState(profile.location || '');
  const [profilePicture, setProfilePicture] = useState(profile.profilePicture || '');
  const [coverPhoto, setCoverPhoto] = useState(profile.coverPhoto || profile.coverImage || '');
  const [saving, setSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(profile.firstName || '');
    setLastName(profile.lastName || '');
    setUserName(profile.userName || '');
    setBio(profile.bio || '');
    setLocation(profile.location || '');
    setProfilePicture(profile.profilePicture || '');
    setCoverPhoto(profile.coverPhoto || profile.coverImage || '');
  }, [profile]);

  const handlePickImage = async (type: 'avatar' | 'cover') => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setErrorMessage('Photo access is required to update your profile images. You can enable it in device settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: true,
        aspect: type === 'avatar' ? [1, 1] : [16, 9],
      });
      if (!result.canceled && result.assets[0]?.uri) {
        if (type === 'avatar') setProfilePicture(result.assets[0].uri);
        else setCoverPhoto(result.assets[0].uri);
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'The photo picker could not be opened.');
    }
  };

  const handleSave = async () => {
    if (!profile.uid) return;
    setSaving(true);
    try {
      let finalAvatar = profilePicture;
      let finalCover = coverPhoto;

      if (profilePicture && !/^https?:/i.test(profilePicture)) {
        finalAvatar = (await profileMediaService.uploadAndAssign(profile.uid, profilePicture, 'avatar')).imageUrl;
      }
      if (coverPhoto && !/^https?:/i.test(coverPhoto)) {
        finalCover = (await profileMediaService.uploadAndAssign(profile.uid, coverPhoto, 'cover')).imageUrl;
      }

      await authService.updateUserProfile(profile.uid, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        userName: userName.trim().toLowerCase(),
        bio: bio.trim(),
        location: location.trim(),
        profilePicture: finalAvatar || null,
        coverPhoto: finalCover || undefined,
      });

      const immediateUpdates = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        userName: userName.trim().toLowerCase(),
        bio: bio.trim(),
        location: location.trim(),
        profilePicture: finalAvatar || null,
        coverPhoto: finalCover || undefined,
      };
      await Promise.all([
        profileResourceService.patchOwnProfile(profile.uid, immediateUpdates),
        feedResourceService.patchAuthor(profile.uid, {
          firstName: immediateUpdates.firstName,
          lastName: immediateUpdates.lastName,
          userName: immediateUpdates.userName,
          profilePicture: immediateUpdates.profilePicture,
        }),
      ]);

      setShowSuccessModal(true);
    } catch (error: unknown) {
      console.error('[EditProfileModal] Save error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    onProfileUpdated();
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.modalScrim }]}>
        <SwipeDismissSurface visible={visible} onDismiss={onClose} handleColor={colors.mutedText} disabled={saving} accessibilityLabel="Swipe down to close profile editor" style={[styles.card, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} disabled={saving} style={styles.closeBtn}>
              <Icon name="x" size={22} color={colors.icon} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: saving ? colors.disabled : colors.accent }]}>
              {saving ? <ActivityIndicator size="small" color={colors.disabledText} /> : <Text style={[styles.saveText, { color: colors.onAccent }]}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* Cover Photo Picker */}
            <View style={styles.imagePickerSection}>
              <Text style={[styles.label, { color: colors.secondaryText }]}>Cover Banner</Text>
              <TouchableOpacity onPress={() => handlePickImage('cover')} style={[styles.coverFrame, { backgroundColor: colors.control, borderColor: colors.border }]}>
                {coverPhoto ? (
                  <Image source={{ uri: coverPhoto }} style={styles.coverPreview} />
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <Icon name="image" size={24} color={colors.mutedText} />
                    <Text style={[styles.placeholderText, { color: colors.mutedText }]}>Choose Cover Photo</Text>
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Icon name="camera" size={14} color="#ffffff" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Profile Avatar Picker */}
            <View style={styles.avatarSection}>
              <Text style={[styles.label, { color: colors.secondaryText }]}>Profile Avatar</Text>
              <TouchableOpacity onPress={() => handlePickImage('avatar')} style={[styles.avatarFrame, { backgroundColor: colors.control, borderColor: colors.border }]}>
                {profilePicture ? (
                  <Image source={{ uri: profilePicture }} style={styles.avatarPreview} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="user" size={32} color={colors.mutedText} />
                  </View>
                )}
                <View style={[styles.cameraBadgeAvatar, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
                  <Icon name="camera" size={12} color={colors.onAccent} />
                </View>
              </TouchableOpacity>
            </View>

            {/* First Name */}
            <View>
              <Text style={[styles.label, { color: colors.secondaryText }]}>First Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={colors.mutedText}
              />
            </View>

            {/* Last Name */}
            <View>
              <Text style={[styles.label, { color: colors.secondaryText }]}>Last Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={colors.mutedText}
              />
            </View>

            {/* Username */}
            <View>
              <Text style={[styles.label, { color: colors.secondaryText }]}>Username</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                value={userName}
                onChangeText={setUserName}
                placeholder="Username"
                placeholderTextColor={colors.mutedText}
                autoCapitalize="none"
              />
            </View>

            {/* Bio */}
            <View>
              <Text style={[styles.label, { color: colors.secondaryText }]}>Bio</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell others about yourself..."
                placeholderTextColor={colors.mutedText}
                multiline
              />
            </View>

            {/* Location */}
            <View>
              <Text style={[styles.label, { color: colors.secondaryText }]}>Location</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. San Francisco, CA"
                placeholderTextColor={colors.mutedText}
              />
            </View>
          </ScrollView>
        </SwipeDismissSurface>

        <CustomModal
          visible={showSuccessModal}
          type="success"
          title="Profile updated!"
          message="Your profile information and images were saved successfully."
          confirmText="Great!"
          onClose={handleSuccessClose}
        />
        <CustomModal visible={Boolean(errorMessage)} type="error" title="Profile not updated" message={errorMessage ?? ''} onClose={() => setErrorMessage(null)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '88%',
    width: '100%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  saveBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
  },
  imagePickerSection: {
    gap: 6,
  },
  coverFrame: {
    height: 110,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  coverPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  placeholderText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSection: {
    alignItems: 'flex-start',
  },
  avatarFrame: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f1f5f9',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  avatarPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadgeAvatar: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#10b981',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  /* Modern Success Modal Styles */
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  successBtn: {
    width: '100%',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
  },
  successBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
