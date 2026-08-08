import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { X, Upload, Globe, Users, Lock, Film, Sparkles, Laugh, Lightbulb, Video as VideoIcon, Music2, Compass, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from '@/lib/firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORIES = [
  { name: 'Comedy', icon: Laugh, color: '#f59e0b' },
  { name: 'Educational', icon: Lightbulb, color: '#eab308' },
  { name: 'DIY', icon: VideoIcon, color: '#ef4444' },
  { name: 'Music', icon: Music2, color: '#6366f1' },
  { name: 'Explore', icon: Compass, color: '#06b6d4' },
  { name: 'Lifestyle', icon: Sparkles, color: '#10b981' },
];

const PRIVACY_OPTIONS = [
  { key: 'public', label: 'Public', icon: Globe },
  { key: 'friends', label: 'Friends', icon: Users },
  { key: 'private', label: 'Only me', icon: Lock },
];

interface CreateLimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateLimeModal({ isOpen, onClose, onSuccess }: CreateLimeModalProps) {
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [category, setCategory] = useState('Lifestyle');
  const [caption, setCaption] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handlePickVideo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please grant media library access to pick a video for your Lime.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedAsset(result.assets[0]);
      }
    } catch (error) {
      console.error('[CreateLimeModal] Video pick error:', error);
      Alert.alert('Error', 'Could not select video file.');
    }
  };

  const handleRemoveVideo = () => {
    setSelectedAsset(null);
  };

  const handleSubmit = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Authentication required', 'Please sign in to post a Lime.');
      return;
    }

    if (!selectedAsset) {
      Alert.alert('Video required', 'Please select a video file to post.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // 1. Fetch blob from picked URI
      const response = await fetch(selectedAsset.uri);
      const blob = await response.blob();

      // 2. Upload video file to Firebase Storage
      const fileName = `limes/${user.uid}/${Date.now()}_reel.mp4`;
      const storageRef = ref(storage, fileName);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 80 + 10;
            setUploadProgress(Math.round(progress));
          },
          (error) => reject(error),
          () => resolve()
        );
      });

      const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

      // 3. Create document in Firestore 'reels' collection
      await addDoc(collection(db, 'reels'), {
        userId: user.uid,
        media: {
          type: 'video',
          typeUrl: downloadUrl,
          fileName: fileName,
          duration: selectedAsset.duration ? Math.round(selectedAsset.duration / 1000) : 15,
        },
        visibility: visibility,
        category: category,
        caption: caption.trim(),
        createdAt: serverTimestamp(),
        stats: { likes: 0, comments: 0, shares: 0 },
        likes: [],
      });

      setUploadProgress(100);
      Alert.alert('Success 🎉', 'Your Lime reel was posted successfully!');
      
      // Reset form state
      setSelectedAsset(null);
      setCaption('');
      setCategory('Lifestyle');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[CreateLimeModal] Submit error:', error);
      Alert.alert('Upload Failed', error?.message || 'Could not upload your Lime reel. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Film size={22} color="#10b981" />
              <Text style={styles.modalTitle}>Create a Lime</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={isUploading}>
              <X size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Audience Privacy Selector */}
            <Text style={styles.sectionLabel}>Who can see your Lime?</Text>
            <View style={styles.privacyRow}>
              {PRIVACY_OPTIONS.map((opt) => {
                const IconComponent = opt.icon;
                const active = visibility === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setVisibility(opt.key as any)}
                    style={[styles.privacyPill, active && styles.privacyPillActive]}
                  >
                    <IconComponent size={15} color={active ? '#ffffff' : '#64748b'} />
                    <Text style={[styles.privacyText, active && styles.privacyTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Category Chips */}
            <Text style={styles.sectionLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map((cat) => {
                const IconComp = cat.icon;
                const active = category === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    onPress={() => setCategory(cat.name)}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                  >
                    <IconComp size={16} color={active ? '#ffffff' : cat.color} />
                    <Text style={[styles.categoryText, active && styles.categoryTextActive]}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Caption Input Area */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 6 }}>
              <Text style={styles.sectionLabel}>Caption</Text>
              <Text style={styles.charCount}>{caption.length}/150</Text>
            </View>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Add a caption to your lime… #Lime #Trinidad"
              placeholderTextColor="#94a3b8"
              maxLength={150}
              multiline
              numberOfLines={3}
              style={styles.captionInput}
            />

            {/* Video Picker Drop Zone */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Upload video</Text>
            {selectedAsset ? (
              <View style={styles.previewContainer}>
                <View style={styles.previewBadge}>
                  <Film size={28} color="#10b981" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewFileName} numberOfLines={1}>
                      {selectedAsset.fileName || 'Selected Video'}
                    </Text>
                    <Text style={styles.previewMeta}>
                      {selectedAsset.duration ? `${Math.round(selectedAsset.duration / 1000)}s` : 'Video Reel'} • Ready to upload
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleRemoveVideo} style={styles.removeBtn}>
                    <X size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={handlePickVideo} style={styles.uploadDropZone} activeOpacity={0.8}>
                <View style={styles.uploadCircle}>
                  <Upload size={24} color="#10b981" />
                </View>
                <Text style={styles.uploadTitle}>Tap to select a video</Text>
                <Text style={styles.uploadSubtitle}>MP4, MOV up to 60 seconds</Text>
              </TouchableOpacity>
            )}

            {/* Upload Progress Bar */}
            {isUploading && (
              <View style={styles.progressContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={styles.progressText}>Posting Lime reel…</Text>
                  <Text style={styles.progressText}>{uploadProgress}%</Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                </View>
              </View>
            )}

          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footerRow}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn} disabled={isUploading}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.submitBtn, (!selectedAsset || isUploading) && styles.submitBtnDisabled]}
              disabled={!selectedAsset || isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.submitBtnText}>Post Lime</Text>
                  <Sparkles size={16} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    minHeight: '75%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    paddingVertical: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  privacyPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  privacyPillActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  privacyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  privacyTextActive: {
    color: '#ffffff',
  },
  categoryScroll: {
    marginBottom: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryChipActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  categoryTextActive: {
    color: '#ffffff',
  },
  charCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  captionInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#0f172a',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  uploadDropZone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#10b981',
    borderRadius: 20,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    marginTop: 4,
  },
  uploadCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#10b981',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065f46',
  },
  uploadSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
    marginTop: 2,
  },
  previewContainer: {
    marginTop: 4,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 18,
    padding: 14,
  },
  previewFileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
  },
  previewMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16a34a',
    marginTop: 2,
  },
  removeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
  },
  progressContainer: {
    marginTop: 16,
  },
  progressText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10b981',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748b',
  },
  submitBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
});