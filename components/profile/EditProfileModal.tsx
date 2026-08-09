import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { db } from '@/lib/firebaseConfig';
import { doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { UserProfile } from '@/lib/services/AuthService';

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
  const [firstName, setFirstName] = useState(profile.firstName || '');
  const [lastName, setLastName] = useState(profile.lastName || '');
  const [userName, setUserName] = useState(profile.userName || '');
  const [bio, setBio] = useState((profile as any).bio || '');
  const [location, setLocation] = useState((profile as any).location || '');
  const [profilePicture, setProfilePicture] = useState(profile.profilePicture || '');
  const [coverPhoto, setCoverPhoto] = useState((profile as any).coverPhoto || (profile as any).coverImage || '');
  const [saving, setSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    setFirstName(profile.firstName || '');
    setLastName(profile.lastName || '');
    setUserName(profile.userName || '');
    setBio((profile as any).bio || '');
    setLocation((profile as any).location || '');
    setProfilePicture(profile.profilePicture || '');
    setCoverPhoto((profile as any).coverPhoto || (profile as any).coverImage || '');
  }, [profile]);

  const handlePickImage = async (type: 'avatar' | 'cover') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: type === 'avatar' ? [1, 1] : [16, 9],
    });

    if (!result.canceled && result.assets[0]?.uri) {
      if (type === 'avatar') setProfilePicture(result.assets[0].uri);
      else setCoverPhoto(result.assets[0].uri);
    }
  };

  const uploadToStorage = async (uri: string, path: string): Promise<string> => {
    if (!uri || uri.startsWith('http://') || uri.startsWith('https://')) return uri;
    try {
      // Use XMLHttpRequest to construct a clean Blob without Expo/RN Response.blob() warnings
      const blob = await new Promise<Blob>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = () => resolve(xhr.response);
        xhr.onerror = () => reject(new TypeError('Network request failed'));
        xhr.responseType = 'blob';
        xhr.open('GET', uri, true);
        xhr.send(null);
      });

      const storageInstance = getStorage();
      const storageRef = ref(storageInstance, path);
      await uploadBytes(storageRef, blob);
      return await getDownloadURL(storageRef);
    } catch (err) {
      console.error('[EditProfileModal] Storage upload error:', err);
      return uri;
    }
  };

  const handleSave = async () => {
    if (!profile.uid) return;
    setSaving(true);
    try {
      let finalAvatar = profilePicture;
      let finalCover = coverPhoto;

      if (profilePicture && (profilePicture.startsWith('file:') || profilePicture.startsWith('content:'))) {
        finalAvatar = await uploadToStorage(profilePicture, `users/${profile.uid}/avatar_${Date.now()}.jpg`);
      }
      if (coverPhoto && (coverPhoto.startsWith('file:') || coverPhoto.startsWith('content:'))) {
        finalCover = await uploadToStorage(coverPhoto, `users/${profile.uid}/cover_${Date.now()}.jpg`);
      }

      await updateDoc(doc(db, 'users', profile.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        userName: userName.trim().toLowerCase(),
        bio: bio.trim(),
        location: location.trim(),
        profilePicture: finalAvatar || null,
        coverPhoto: finalCover || null,
        coverImage: finalCover || null,
        coverPicture: finalCover || null,
      });

      setShowSuccessModal(true);
    } catch (err) {
      console.error('[EditProfileModal] Save error:', err);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} disabled={saving} style={styles.closeBtn}>
              <Icon name="x" size={22} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.title}>Edit Profile</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
              {saving ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.saveText}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ padding: 20, gap: 16 }}>
            {/* Cover Photo Picker */}
            <View style={styles.imagePickerSection}>
              <Text style={styles.label}>Cover Banner</Text>
              <TouchableOpacity onPress={() => handlePickImage('cover')} style={styles.coverFrame}>
                {coverPhoto ? (
                  <Image source={{ uri: coverPhoto }} style={styles.coverPreview} />
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <Icon name="image" size={24} color="#94a3b8" />
                    <Text style={styles.placeholderText}>Choose Cover Photo</Text>
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Icon name="camera" size={14} color="#ffffff" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Profile Avatar Picker */}
            <View style={styles.avatarSection}>
              <Text style={styles.label}>Profile Avatar</Text>
              <TouchableOpacity onPress={() => handlePickImage('avatar')} style={styles.avatarFrame}>
                {profilePicture ? (
                  <Image source={{ uri: profilePicture }} style={styles.avatarPreview} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="user" size={32} color="#94a3b8" />
                  </View>
                )}
                <View style={styles.cameraBadgeAvatar}>
                  <Icon name="camera" size={12} color="#ffffff" />
                </View>
              </TouchableOpacity>
            </View>

            {/* First Name */}
            <View>
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* Last Name */}
            <View>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* Username */}
            <View>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                value={userName}
                onChangeText={setUserName}
                placeholder="Username"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
            </View>

            {/* Bio */}
            <View>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell others about yourself..."
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>

            {/* Location */}
            <View>
              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="e.g. San Francisco, CA"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </ScrollView>
        </View>

        {/* Modern Success Dialog Modal */}
        <Modal visible={showSuccessModal} transparent animationType="fade" onRequestClose={handleSuccessClose}>
          <View style={styles.successOverlay}>
            <View style={styles.successCard}>
              <View style={styles.successIconBadge}>
                <Icon name="check" size={32} color="#ffffff" />
              </View>
              <Text style={styles.successTitle}>Profile Updated!</Text>
              <Text style={styles.successMessage}>Your profile information and images have been saved successfully.</Text>
              <TouchableOpacity onPress={handleSuccessClose} style={styles.successBtn}>
                <Text style={styles.successBtnText}>Great!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    overflow: 'hidden',
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
