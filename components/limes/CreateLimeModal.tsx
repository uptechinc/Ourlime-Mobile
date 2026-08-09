import React, { useState, useRef, useEffect } from 'react';
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
  Animated,
  PanResponder,
  Image,
} from 'react-native';
import { X, Upload, Globe, Users, Lock, Film, Sparkles, Laugh, Lightbulb, Video as VideoIcon, Music2, Compass, AtSign } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { auth, db, storage } from '@/lib/firebaseConfig';
import { collection, addDoc, serverTimestamp, getDocs, query, limit } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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

interface UserSuggestion {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
}

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

  /* ── Mention Autocomplete State ── */
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  /* ── Swipe-Down PanResponder ── */
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  /* Reset translateY when modal opens */
  useEffect(() => {
    if (isOpen) translateY.setValue(0);
  }, [isOpen, translateY]);

  /* ── Mention Search Handler ── */
  const handleCaptionChange = async (text: string) => {
    setCaption(text);
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const queryText = text.slice(lastAtIndex + 1);
      if (!queryText.includes(' ')) {
        setMentionQuery(queryText.toLowerCase());
        setShowMentionDropdown(true);

        try {
          const snap = await getDocs(query(collection(db, 'users'), limit(20)));
          const users: UserSuggestion[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userName: data.userName || data.username || 'user',
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              profileImage: data.profileImage || undefined,
            };
          });

          const filtered = users
            .filter((u) => u.userName.toLowerCase().includes(queryText.toLowerCase()) || u.firstName.toLowerCase().includes(queryText.toLowerCase()))
            .slice(0, 8);

          setUserSuggestions(filtered);
        } catch {
          // ignore
        }
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const handleSelectMentionUser = (username: string) => {
    const lastAtIndex = caption.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const newCaption = caption.slice(0, lastAtIndex) + `@${username} `;
      setCaption(newCaption);
    }
    setShowMentionDropdown(false);
  };

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  /* ── Video Picker with 9:16 Instagram Crop Aspect Ratio (Non-deprecated) ── */
  const handlePickVideo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please grant media library access to pick a video.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        aspect: [9, 16], // Instagram Reels standard 9:16 portrait ratio
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
      const response = await fetch(selectedAsset.uri);
      const blob = await response.blob();

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

      // Extract @mentions from caption
      const mentions = (caption.match(/@([a-zA-Z0-9._]+)/g) || []).map((m) => m.replace('@', ''));

      await addDoc(collection(db, 'reels'), {
        userId: user.uid,
        media: {
          type: 'video',
          typeUrl: downloadUrl,
          fileName: fileName,
          duration: selectedAsset.duration ? Math.round(selectedAsset.duration / 1000) : 15,
          aspectRatio: '9:16',
        },
        visibility: visibility,
        category: category,
        caption: caption.trim(),
        mentions: mentions,
        createdAt: serverTimestamp(),
        stats: { likes: 0, comments: 0, shares: 0 },
        likes: [],
      });

      setUploadProgress(100);
      setIsUploading(false);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('[CreateLimeModal] Submit error:', error);
      setIsUploading(false);
      setUploadProgress(0);
      Alert.alert('Upload Failed', error?.message || 'Could not upload your Lime reel.');
    }
  };

  const handleFinishSuccess = () => {
    setShowSuccessModal(false);
    setSelectedAsset(null);
    setCaption('');
    setCategory('Lifestyle');
    onSuccess();
    onClose();
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.modalCard, { transform: [{ translateY }] }]}>
          
          {/* Top Drag Handle Bar for Swipe-Down to Dismiss */}
          <View style={styles.dragHandleWrapper} {...panResponder.panHandlers}>
            <View style={styles.dragHandleBar} />
          </View>

          {/* Header */}
          <View style={styles.headerRow} {...panResponder.panHandlers}>
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

            {/* Category Chips with Fixed Readable Contrast */}
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

            {/* Caption Input Area & Mention Autocomplete */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 6 }}>
              <Text style={styles.sectionLabel}>Caption</Text>
              <Text style={styles.charCount}>{caption.length}/150</Text>
            </View>
            
            <View style={{ position: 'relative' }}>
              <TextInput
                value={caption}
                onChangeText={handleCaptionChange}
                placeholder="Add a caption to your lime… Use @username to mention #Lime"
                placeholderTextColor="#94a3b8"
                maxLength={150}
                multiline
                numberOfLines={3}
                style={styles.captionInput}
              />

              {/* Mention Suggestions Dropdown */}
              {showMentionDropdown && userSuggestions.length > 0 && (
                <View style={styles.mentionDropdown}>
                  <Text style={styles.mentionDropdownHeader}>Mention user</Text>
                  {userSuggestions.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => handleSelectMentionUser(u.userName)}
                      style={styles.mentionItem}
                    >
                      <Image
                        source={{ uri: u.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }}
                        style={styles.mentionAvatar}
                      />
                      <View>
                        <Text style={styles.mentionUsername}>@{u.userName}</Text>
                        <Text style={styles.mentionName}>{u.firstName} {u.lastName}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Video Picker Drop Zone (Instagram 9:16 Portrait Ratio) */}
            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Upload video (9:16 Portrait)</Text>
            {selectedAsset ? (
              <View style={styles.previewContainer}>
                <View style={styles.previewBadge}>
                  <Film size={28} color="#10b981" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewFileName} numberOfLines={1}>
                      {selectedAsset.fileName || 'Selected Video (9:16)'}
                    </Text>
                    <Text style={styles.previewMeta}>
                      {selectedAsset.duration ? `${Math.round(selectedAsset.duration / 1000)}s` : 'Video Reel'} • Instagram 9:16 ratio
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
                <Text style={styles.uploadSubtitle}>Instagram 9:16 Portrait • Up to 60s</Text>
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

        </Animated.View>
      </View>

      {/* Modern Custom Success Overlay Card */}
      {showSuccessModal && (
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Sparkles size={36} color="#10b981" />
            </View>
            <Text style={styles.successTitle}>Lime Reel Live! 🚀 🎉</Text>
            <Text style={styles.successSubtitle}>Your Lime has been published and is now available in your feed!</Text>
            <TouchableOpacity onPress={handleFinishSuccess} style={styles.successBtn}>
              <Text style={styles.successBtnText}>View My Lime</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    minHeight: '75%',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 24,
  },
  dragHandleWrapper: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  dragHandleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
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
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    fontWeight: '800',
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
  mentionDropdown: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    marginTop: 6,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  mentionDropdownHeader: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  mentionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 10,
  },
  mentionAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  mentionUsername: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10b981',
  },
  mentionName: {
    fontSize: 10,
    color: '#64748b',
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
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 9999,
  },
  successCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  successBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#10b981',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  successBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
});