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
  const [coverPhoto, setCoverPhoto] = useState((profile as any).coverPhoto || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFirstName(profile.firstName || '');
    setLastName(profile.lastName || '');
    setUserName(profile.userName || '');
    setBio((profile as any).bio || '');
    setLocation((profile as any).location || '');
    setProfilePicture(profile.profilePicture || '');
    setCoverPhoto((profile as any).coverPhoto || '');
  }, [profile]);

  const handlePickImage = async (type: 'avatar' | 'cover') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      const response = await fetch(uri);
      const blob = await response.blob();
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

      if (profilePicture && profilePicture.startsWith('file:')) {
        finalAvatar = await uploadToStorage(profilePicture, `users/${profile.uid}/avatar_${Date.now()}.jpg`);
      }
      if (coverPhoto && coverPhoto.startsWith('file:')) {
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

      Alert.alert('Profile Updated', 'Your profile details have been saved successfully.');
      onProfileUpdated();
      onClose();
    } catch (err) {
      console.error('[EditProfileModal] Save error:', err);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
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
                  <Image source={{ uri: coverPhoto }} style={styles.coverImage} />
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <Icon name="image" size={24} color="#94a3b8" />
                    <Text style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Add Cover Photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Profile Avatar Picker */}
            <View style={styles.imagePickerSection}>
              <Text style={styles.label}>Profile Picture</Text>
              <TouchableOpacity onPress={() => handlePickImage('avatar')} style={styles.avatarRow}>
                <Image
                  source={{ uri: profilePicture || 'https://via.placeholder.com/150' }}
                  style={styles.avatarImage}
                />
                <View style={styles.changeBadge}>
                  <Icon name="camera" size={14} color="#ffffff" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#ffffff', marginLeft: 6 }}>Change Photo</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* First Name & Last Name */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>First Name</Text>
                <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput value={lastName} onChangeText={setLastName} style={styles.input} />
              </View>
            </View>

            {/* Username */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput value={userName} onChangeText={setUserName} autoCapitalize="none" style={styles.input} />
            </View>

            {/* Bio */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={3}
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              />
            </View>

            {/* Location */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location</Text>
              <TextInput value={location} onChangeText={setLocation} placeholder="e.g. Port of Spain, Trinidad" style={styles.input} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
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
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#10b981',
  },
  saveText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  body: {
    flexGrow: 0,
  },
  imagePickerSection: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  coverFrame: {
    height: 120,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#cbd5e1',
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#10b981',
  },
  inputGroup: {
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
  },
});
