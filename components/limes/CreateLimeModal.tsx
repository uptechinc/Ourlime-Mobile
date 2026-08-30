import { useState } from 'react';
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
  Image,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { X, Upload, Globe, Users, Lock, Film, Sparkles, Laugh, Lightbulb, Video as VideoIcon, Music2, Compass } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { AuthService } from '@/lib/services/AuthService';
import { SearchService } from '@/lib/services/SearchService';
import { limeService } from '@/lib/services/LimeService';
import SwipeDismissHandle from '@/components/ui/SwipeDismissHandle';
import { useSwipeDismiss } from '@/lib/hooks/useSwipeDismiss';
import AnimatedActionButton from '@/components/ui/AnimatedActionButton';
import { interactionFeedbackService } from '@/lib/services/InteractionFeedbackService';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { limeThumbnailService } from '@/lib/services/LimeThumbnailService';
const authService = AuthService.getInstance();
const searchService = SearchService.getInstance();
const MAX_LIME_VIDEO_DURATION_SECONDS = 30;
const MAX_LIME_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const ALLOWED_LIME_VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

const CATEGORIES = [
  { name: 'For You', icon: Sparkles, color: '#10b981' },
  { name: 'Following', icon: Users, color: '#10b981' },
  { name: 'Comedy', icon: Laugh, color: '#f59e0b' },
  { name: 'Academic', icon: Lightbulb, color: '#eab308' },
  { name: 'DIY', icon: VideoIcon, color: '#ef4444' },
  { name: 'Music', icon: Music2, color: '#6366f1' },
  { name: 'Explore', icon: Compass, color: '#06b6d4' },
];

const PRIVACY_OPTIONS = [
  { key: 'public', label: 'Public', icon: Globe },
  { key: 'friends', label: 'Friends', icon: Users },
  { key: 'private', label: 'Only me', icon: Lock },
] as const;

type UserSuggestion = {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
};

type CreateLimeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

function SelectedVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
    videoPlayer.pause();
  });

  return (
    <VideoView
      player={player}
      style={styles.selectedVideoPreview}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
    />
  );
}

export default function CreateLimeModal({ isOpen, onClose, onSuccess }: CreateLimeModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [category, setCategory] = useState('For You');
  const [caption, setCaption] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /* ── Mention Autocomplete State ── */
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [, setMentionQuery] = useState('');

  const swipeDismiss = useSwipeDismiss({ visible: isOpen, onDismiss: onClose, disabled: isUploading });

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
          const profiles = await searchService.searchUsers(queryText, 8);
          const users: UserSuggestion[] = profiles.map((profile) => ({
            id: profile.uid,
            userName: profile.userName || 'user',
            firstName: profile.firstName || '',
            lastName: profile.lastName || '',
            profileImage: profile.profilePicture || undefined,
          }));

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
        videoMaxDuration: MAX_LIME_VIDEO_DURATION_SECONDS,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const durationSeconds = typeof asset.duration === 'number' ? asset.duration / 1000 : 0;
        if (asset.mimeType && !ALLOWED_LIME_VIDEO_TYPES.has(asset.mimeType.toLowerCase())) {
          Alert.alert('Unsupported video', 'Please select an MP4, MOV, or WebM video.');
          return;
        }
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
          Alert.alert('Unreadable video', 'The video duration could not be read. Please select another video.');
          return;
        }
        if (durationSeconds > MAX_LIME_VIDEO_DURATION_SECONDS) {
          Alert.alert('Video too long', `Limes can be up to ${MAX_LIME_VIDEO_DURATION_SECONDS} seconds.`);
          return;
        }
        if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_LIME_VIDEO_SIZE_BYTES) {
          Alert.alert('Video too large', 'Lime videos can be up to 100 MB.');
          return;
        }
        setSelectedAsset(asset);
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
    const user = authService.getCurrentUser();
    if (!user) {
      Alert.alert('Authentication required', 'Please sign in to post a Lime.');
      return;
    }

    if (!selectedAsset) {
      Alert.alert('Video required', 'Please select a video file to post.');
      return;
    }

    const durationSeconds = typeof selectedAsset.duration === 'number' ? selectedAsset.duration / 1000 : 0;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_LIME_VIDEO_DURATION_SECONDS) {
      Alert.alert('Invalid video', `Choose a readable video that is ${MAX_LIME_VIDEO_DURATION_SECONDS} seconds or shorter.`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Extract @mentions from caption
      const mentions = (caption.match(/@([a-zA-Z0-9._]+)/g) || []).map((m) => m.replace('@', ''));
      let thumbnailUri: string | undefined;
      try {
        thumbnailUri = await limeThumbnailService.createThumbnail(selectedAsset.uri, durationSeconds);
      } catch (thumbnailError: unknown) {
        console.warn(
          '[CreateLimeModal] Thumbnail generation failed:',
          thumbnailError instanceof Error ? thumbnailError.message : 'Unknown error'
        );
      }

      await limeService.createLime({
        userId: user.uid,
        uri: selectedAsset.uri,
        thumbnailUri,
        durationSeconds: Math.round(durationSeconds),
        visibility,
        category,
        caption: caption.trim(),
        mentions,
      }, (progress) => setUploadProgress(Math.round(progress * 0.9 + 10)));

      setUploadProgress(100);
      setIsUploading(false);
      void interactionFeedbackService.play('success');
      setShowSuccessModal(true);
    } catch (error: unknown) {
      console.error('[CreateLimeModal] Submit error:', error);
      setIsUploading(false);
      setUploadProgress(0);
      Alert.alert('Upload Failed', error instanceof Error ? error.message : 'Could not upload your Lime reel.');
    }
  };

  const handleFinishSuccess = () => {
    setShowSuccessModal(false);
    setSelectedAsset(null);
    setCaption('');
    setCategory('For You');
    onSuccess();
    onClose();
  };

  return (
    <Modal visible={isOpen} animationType="none" transparent onRequestClose={swipeDismiss.dismissWithAnimation}>
      <View style={[styles.overlay, { backgroundColor: colors.modalScrim }]}>
        <Animated.View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: Math.max(24, insets.bottom) }, swipeDismiss.animatedStyle]}>
          
          {/* Top Drag Handle Bar for Swipe-Down to Dismiss */}
          <SwipeDismissHandle gesture={swipeDismiss.gesture} color={colors.mutedText} animatedStyle={swipeDismiss.handleAnimatedStyle} accessibilityLabel="Swipe down to close Lime creation" />

          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Film size={22} color="#10b981" />
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create a Lime</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.control }]} disabled={isUploading}>
              <X size={20} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            
            {/* Audience Privacy Selector */}
            <Text style={[styles.sectionLabel, { color: colors.secondaryText }]}>Who can see your Lime?</Text>
            <View style={styles.privacyRow}>
              {PRIVACY_OPTIONS.map((opt) => {
                const IconComponent = opt.icon;
                const active = visibility === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setVisibility(opt.key)}
                    style={[styles.privacyPill, { backgroundColor: colors.control, borderColor: colors.border }, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                  >
                    <IconComponent size={15} color={active ? colors.onAccent : colors.icon} />
                    <Text style={[styles.privacyText, { color: colors.mutedText }, active && { color: colors.onAccent }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Category Chips with Fixed Readable Contrast */}
            <Text style={[styles.sectionLabel, { color: colors.secondaryText }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={{ gap: 8 }}>
              {CATEGORIES.map((cat) => {
                const IconComp = cat.icon;
                const active = category === cat.name;
                return (
                  <TouchableOpacity
                    key={cat.name}
                    onPress={() => setCategory(cat.name)}
                    style={[styles.categoryChip, { backgroundColor: colors.control, borderColor: colors.border }, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}
                  >
                    <IconComp size={16} color={active ? colors.onAccent : cat.color} />
                    <Text style={[styles.categoryText, { color: colors.secondaryText }, active && { color: colors.onAccent }]}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Caption Input Area & Mention Autocomplete */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 6 }}>
              <Text style={[styles.sectionLabel, { color: colors.secondaryText }]}>Caption</Text>
              <Text style={[styles.charCount, { color: colors.mutedText }]}>{caption.length}/150</Text>
            </View>
            
            <View style={{ position: 'relative' }}>
              <TextInput
                value={caption}
                onChangeText={handleCaptionChange}
                placeholder="Add a caption to your lime… Use @username to mention #Lime"
                placeholderTextColor={colors.mutedText}
                maxLength={150}
                multiline
                numberOfLines={3}
                style={[styles.captionInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              />

              {/* Mention Suggestions Dropdown */}
              {showMentionDropdown && userSuggestions.length > 0 && (
                <View style={[styles.mentionDropdown, { backgroundColor: colors.elevated, borderColor: colors.border }]}>
                  <Text style={[styles.mentionDropdownHeader, { color: colors.mutedText }]}>Mention user</Text>
                  {userSuggestions.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      onPress={() => handleSelectMentionUser(u.userName)}
                      style={[styles.mentionItem, { borderBottomColor: colors.border }]}
                    >
                      <Image
                        source={{ uri: u.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' }}
                        style={styles.mentionAvatar}
                      />
                      <View>
                        <Text style={styles.mentionUsername}>@{u.userName}</Text>
                        <Text style={[styles.mentionName, { color: colors.mutedText }]}>{u.firstName} {u.lastName}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Video Picker Drop Zone (Instagram 9:16 Portrait Ratio) */}
            <Text style={[styles.sectionLabel, { marginTop: 16, color: colors.secondaryText }]}>Upload video (9:16 Portrait)</Text>
            {selectedAsset ? (
              <View style={[styles.previewContainer, { backgroundColor: colors.successSurface, borderColor: colors.accent }]}>
                <SelectedVideoPreview uri={selectedAsset.uri} />
                <View style={[styles.previewBadge, { backgroundColor: colors.successSurface, borderColor: colors.border }]}>
                  <Film size={28} color="#10b981" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewFileName, { color: colors.text }]} numberOfLines={1}>
                      {selectedAsset.fileName || 'Selected Video (9:16)'}
                    </Text>
                    <Text style={[styles.previewMeta, { color: colors.mutedText }]}>
                      {selectedAsset.duration ? `${Math.round(selectedAsset.duration / 1000)}s` : 'Video Reel'} • Instagram 9:16 ratio
                    </Text>
                  </View>
                  <TouchableOpacity onPress={handleRemoveVideo} style={[styles.removeBtn, { backgroundColor: colors.destructiveSurface }]}>
                    <X size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={handlePickVideo} style={[styles.uploadDropZone, { backgroundColor: colors.successSurface, borderColor: colors.accent }]} activeOpacity={0.8}>
                <View style={[styles.uploadCircle, { backgroundColor: colors.elevated }]}>
                  <Upload size={24} color="#10b981" />
                </View>
                <Text style={[styles.uploadTitle, { color: colors.successText }]}>Tap to select a video</Text>
                <Text style={[styles.uploadSubtitle, { color: colors.mutedText }]}>MP4, MOV, or WebM • Up to {MAX_LIME_VIDEO_DURATION_SECONDS}s • Max 100 MB</Text>
              </TouchableOpacity>
            )}

            {/* Upload Progress Bar */}
            {isUploading && (
              <View style={styles.progressContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={[styles.progressText, { color: colors.secondaryText }]}>Posting Lime reel…</Text>
                  <Text style={[styles.progressText, { color: colors.secondaryText }]}>{uploadProgress}%</Text>
                </View>
                <View style={[styles.progressBarTrack, { backgroundColor: colors.control }]}>
                  <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                </View>
              </View>
            )}

          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.footerRow, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { backgroundColor: colors.control, borderColor: colors.border }]} disabled={isUploading}>
              <Text style={[styles.cancelBtnText, { color: colors.secondaryText }]}>Cancel</Text>
            </TouchableOpacity>

            <AnimatedActionButton
              feedback="post"
              accessibilityLabel="Post Lime"
              onPress={handleSubmit}
              style={[styles.submitBtn, { backgroundColor: colors.accent }, (!selectedAsset || isUploading) && { backgroundColor: colors.disabled }]}
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
            </AnimatedActionButton>
          </View>

        </Animated.View>
      </View>

      {/* Modern Custom Success Overlay Card */}
      {showSuccessModal && (
        <View style={[styles.successOverlay, { backgroundColor: colors.modalScrim }]}>
          <View style={[styles.successCard, { backgroundColor: colors.elevated }]}>
            <View style={[styles.successIconCircle, { backgroundColor: colors.successSurface }]}>
              <Sparkles size={36} color="#10b981" />
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>Lime Reel Live! 🚀 🎉</Text>
            <Text style={[styles.successSubtitle, { color: colors.mutedText }]}>Your Lime has been published and is now available in your feed!</Text>
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
  selectedVideoPreview: {
    width: '100%',
    height: 260,
    borderRadius: 18,
    backgroundColor: '#000000',
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
