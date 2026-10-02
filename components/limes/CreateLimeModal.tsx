import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import CustomModal from '@/components/ui/CustomModal';
import Animated from 'react-native-reanimated';
import { X, Upload, Globe, Users, Lock, Film, Sparkles, Laugh, Lightbulb, Video as VideoIcon, Music2, Compass, Image as ImageIcon } from 'lucide-react-native';
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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { limeThumbnailService, type LimeCoverFrame } from '@/lib/services/LimeThumbnailService';
import VideoThumbnailPicker from '@/components/media/VideoThumbnailPicker';
import { CoverFramePreview, CoverFrameScrubber } from '@/components/media/CoverFrameScrubber';
import VideoTrimModal, { type TrimmedVideoResult } from '@/components/media/VideoTrimModal';
import { videoTrimService } from '@/lib/services/VideoTrimService';
import DraftsSheet from '@/components/drafts/DraftsSheet';
import DraftDiscardSheet from '@/components/drafts/DraftDiscardSheet';
import { creationDraftService, DraftLimitError, MAX_DRAFTS_PER_KIND, type CreationDraft } from '@/lib/services/CreationDraftService';
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
  /** Open on the drafts list (tapping a draft reminder). */
  initialShowDrafts?: boolean;
};

/** Playable preview of the chosen Lime on the compose screen. */
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

type LimeVideoConfirmationModalProps = {
  asset: ImagePicker.ImagePickerAsset | null;
  selectedThumbnailUri?: string;
  onThumbnailChange?: (uri: string) => void;
  onCancel: () => void;
  onFinish: () => void;
};

function LimeVideoConfirmationModal({
  asset,
  selectedThumbnailUri,
  onThumbnailChange,
  onCancel,
  onFinish,
}: LimeVideoConfirmationModalProps) {
  const { colors } = useAppTheme();
  const [frames, setFrames] = useState<LimeCoverFrame[]>([]);
  const [framesLoading, setFramesLoading] = useState(false);
  // Cover time in seconds; the selector slides through the whole video, not just the 10 strip frames.
  const [coverSeconds, setCoverSeconds] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [customCoverUri, setCustomCoverUri] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  const durationSeconds = typeof asset?.duration === 'number' ? asset.duration / 1000 : 0;

  useEffect(() => {
    if (!asset || durationSeconds <= 0) {
      setFrames([]);
      setCustomCoverUri(null);
      return;
    }
    let active = true;
    setFramesLoading(true);
    setCustomCoverUri(null);
    void (async () => {
      try {
        const generated = await limeThumbnailService.createTimelineFrames(asset.uri, durationSeconds, 10);
        if (active) {
          setFrames(generated);
          setCoverSeconds(generated[Math.min(2, Math.max(0, generated.length - 1))]?.timestampSeconds ?? 0);
          setFramesLoading(false);
        }
      } catch (err) {
        if (active) {
          console.warn('[LimeVideoConfirmationModal] Failed to extract timeline frames:', err);
          setFramesLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [asset, durationSeconds]);

  const handleCoverChange = useCallback((seconds: number) => {
    setCoverSeconds(seconds);
    setCustomCoverUri(null);
  }, []);

  const handlePickCustomCover = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.86,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        setCustomCoverUri(uri);
        if (onThumbnailChange) {
          onThumbnailChange(uri);
        }
      }
    } catch (err) {
      console.warn('[LimeVideoConfirmationModal] Custom cover pick failed:', err);
    }
  };

  const handleFinish = async () => {
    if (!asset) return;
    if (customCoverUri) {
      if (onThumbnailChange) onThumbnailChange(customCoverUri);
      onFinish();
      return;
    }
    setIsExtracting(true);
    try {
      const finalUri = await limeThumbnailService.createThumbnailAtTime(asset.uri, coverSeconds);
      if (onThumbnailChange) onThumbnailChange(finalUri);
    } catch {
      // Closest strip frame as a fallback cover.
      const nearest = frames.reduce<LimeCoverFrame | null>((best, frame) => (
        !best || Math.abs(frame.timestampSeconds - coverSeconds) < Math.abs(best.timestampSeconds - coverSeconds) ? frame : best
      ), null);
      if (nearest && onThumbnailChange) onThumbnailChange(nearest.previewUri);
    } finally {
      setIsExtracting(false);
    }
    onFinish();
  };

  const frameMinutes = Math.floor(coverSeconds / 60);
  const frameSeconds = Math.floor(coverSeconds % 60);
  const formattedFrameTime = `${frameMinutes.toString().padStart(2, '0')}:${frameSeconds.toString().padStart(2, '0')}`;

  return (
    <Modal visible={Boolean(asset)} animationType="slide" presentationStyle="fullScreen" onRequestClose={onCancel}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.confirmationScreen, { backgroundColor: colors.canvas }]}>
        <View style={[styles.confirmationHeader, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel selected Lime video" style={styles.confirmationHeaderAction}>
            <Text style={[styles.confirmationCancelText, { color: colors.secondaryText }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.confirmationTitle, { color: colors.text }]}>Confirm video</Text>
          <TouchableOpacity onPress={() => void handleFinish()} disabled={isExtracting} accessibilityRole="button" accessibilityLabel="Finish selecting Lime video" style={styles.confirmationHeaderAction}>
            {isExtracting ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <Text style={[styles.confirmationFinishText, { color: colors.accentText }]}>Finish</Text>
            )}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.confirmationBody} keyboardShouldPersistTaps="handled" scrollEnabled={!isScrubbing}>
          {/* Big preview of the chosen cover: the exact video frame (or the custom photo). */}
          {customCoverUri ? (
            <Image source={{ uri: customCoverUri }} style={styles.selectedVideoPreview} resizeMode="cover" />
          ) : asset ? (
            <CoverFramePreview uri={asset.uri} timeSeconds={coverSeconds} style={styles.selectedVideoPreview} />
          ) : null}

          {/* 10-Frame Thumbnail Scrubber Strip */}
          <View style={[styles.confirmationCoverSection, { backgroundColor: colors.control, borderColor: colors.border }]}>
            <View style={styles.confirmationCoverHeader}>
              <Text style={[styles.confirmationCoverTitle, { color: colors.text }]}>Choose cover frame</Text>
              <Text style={[styles.confirmationCoverSubtitle, { color: colors.mutedText }]}>
                {customCoverUri ? 'Custom photo cover' : `Frame ${formattedFrameTime}`}
              </Text>
            </View>

            <CoverFrameScrubber
              durationSeconds={durationSeconds}
              frames={frames}
              valueSeconds={coverSeconds}
              loading={framesLoading}
              onChange={handleCoverChange}
              onDraggingChange={setIsScrubbing}
            />

                        {/* Custom Cover Upload Button */}
            <TouchableOpacity onPress={() => void handlePickCustomCover()} style={[styles.confirmationCustomCoverBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ImageIcon size={18} color={colors.accent} />
              <Text style={[styles.confirmationCustomCoverText, { color: colors.text }]}>
                {customCoverUri ? 'Change cover photo' : 'Add cover from camera roll'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.confirmationHelp, { color: colors.secondaryText }]}>Review the edited video, then tap Finish to return to your Lime.</Text>
          {asset?.duration ? <Text style={[styles.confirmationMeta, { color: colors.mutedText }]}>{Math.round(asset.duration / 1000)} seconds</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function CreateLimeModal({ isOpen, onClose, onSuccess, initialShowDrafts = false }: CreateLimeModalProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const [visibility, setVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [category, setCategory] = useState('For You');
  const [caption, setCaption] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pendingAsset, setPendingAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  // A picked video longer than the Lime limit: the trimmer opens so the user can keep the best part.
  const [trimSourceAsset, setTrimSourceAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [selectedThumbnailUri, setSelectedThumbnailUri] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  /* ── Mention Autocomplete State ── */
  const [userSuggestions, setUserSuggestions] = useState<UserSuggestion[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [, setMentionQuery] = useState('');

  // ── Lime drafts (shared with the website): up to 5, each deleted 7 days after it was created ──
  const [drafts, setDrafts] = useState<CreationDraft[]>([]);
  const [isDraftsLoading, setIsDraftsLoading] = useState(false);
  const [isDraftsSheetVisible, setIsDraftsSheetVisible] = useState(false);
  const [draftsNotice, setDraftsNotice] = useState<string | null>(null);
  const [openingDraftId, setOpeningDraftId] = useState<string | null>(null);
  const [openedDraftId, setOpenedDraftId] = useState<string | null>(null);
  const [isDraftBusy, setIsDraftBusy] = useState(false);
  const [isLeaveSheetVisible, setIsLeaveSheetVisible] = useState(false);
  const hasLimeContent = Boolean(selectedAsset) || caption.trim().length > 0;
  const currentUserId = authService.getCurrentUser()?.uid;

  const refreshDrafts = async (): Promise<void> => {
    if (!currentUserId) return;
    setIsDraftsLoading(true);
    try {
      setDrafts(await creationDraftService.list(currentUserId, 'lime'));
    } catch (error: unknown) {
      console.warn('[CreateLimeModal.refreshDrafts]', error instanceof Error ? error.message : 'Could not load drafts');
    } finally {
      setIsDraftsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void refreshDrafts();
    if (initialShowDrafts) setIsDraftsSheetVisible(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload whenever the composer opens
  }, [isOpen, initialShowDrafts]);

  const resetLimeForm = (): void => {
    setSelectedAsset(null);
    setPendingAsset(null);
    setSelectedThumbnailUri('');
    setCaption('');
    setCategory('For You');
    setVisibility('public');
    setOpenedDraftId(null);
  };

  const saveLimeDraft = async (): Promise<boolean> => {
    if (!currentUserId || !hasLimeContent || isDraftBusy) return false;
    setIsDraftBusy(true);
    try {
      const durationSeconds = typeof selectedAsset?.duration === 'number' ? selectedAsset.duration / 1000 : 0;
      const draftId = await creationDraftService.save(currentUserId, 'lime', {
        caption,
        visibility,
        hashtags: [],
        media: selectedAsset ? [{
          uri: selectedAsset.uri,
          type: 'video',
          fileName: selectedAsset.fileName ?? 'lime.mp4',
          mimeType: selectedAsset.mimeType ?? 'video/mp4',
          width: selectedAsset.width,
          height: selectedAsset.height,
          fileSize: selectedAsset.fileSize,
          durationSeconds,
          thumbnailUri: selectedThumbnailUri || undefined,
        }] : [],
        lime: { category, privacy: visibility, durationSeconds },
      }, openedDraftId ?? undefined);
      setOpenedDraftId(draftId);
      void refreshDrafts();
      return true;
    } catch (error: unknown) {
      if (error instanceof DraftLimitError) {
        setIsLeaveSheetVisible(false);
        setDraftsNotice(error.message);
        setIsDraftsSheetVisible(true);
        void refreshDrafts();
        return false;
      }
      setDialogState({ visible: true, type: 'error', title: 'Draft not saved', message: error instanceof Error ? error.message : 'Please check your connection and try again.' });
      return false;
    } finally {
      setIsDraftBusy(false);
    }
  };

  const openLimeDraft = async (draft: CreationDraft): Promise<void> => {
    if (openingDraftId) return;
    setOpeningDraftId(draft.id);
    try {
      const opened = await creationDraftService.open(draft);
      const video = opened.content.media[0];
      setCaption(opened.content.caption);
      const privacy = draft.lime?.privacy;
      setVisibility(privacy === 'friends' || privacy === 'private' ? privacy : 'public');
      setCategory(draft.lime?.category || 'For You');
      if (video) {
        setSelectedAsset({
          uri: video.uri,
          width: video.width ?? 1080,
          height: video.height ?? 1920,
          type: 'video',
          fileName: video.fileName,
          mimeType: video.mimeType,
          fileSize: video.fileSize,
          duration: Math.round((video.durationSeconds ?? draft.lime?.durationSeconds ?? 0) * 1000),
        });
        setSelectedThumbnailUri(video.thumbnailUri ?? '');
      } else {
        setSelectedAsset(null);
        setSelectedThumbnailUri('');
      }
      setOpenedDraftId(draft.id);
      setIsDraftsSheetVisible(false);
      setDraftsNotice(null);
      if (opened.failedMedia > 0) {
        setDialogState({ visible: true, type: 'warning', title: 'Video missing', message: 'The draft opened without its video. Choose it again.' });
      }
    } catch (error: unknown) {
      setDialogState({ visible: true, type: 'error', title: 'Draft not opened', message: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setOpeningDraftId(null);
    }
  };

  const deleteLimeDraft = async (draft: CreationDraft): Promise<void> => {
    if (!currentUserId) return;
    try {
      await creationDraftService.remove(currentUserId, draft.id);
      if (openedDraftId === draft.id) setOpenedDraftId(null);
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      setDraftsNotice(null);
    } catch (error: unknown) {
      setDialogState({ visible: true, type: 'error', title: 'Draft not deleted', message: error instanceof Error ? error.message : 'Please try again.' });
    }
  };

  /** Closing with something unsaved asks first (X, Cancel, swipe down, Android back). */
  const shouldDismissLime = (): boolean => {
    if (isUploading || !hasLimeContent) return true;
    setIsLeaveSheetVisible(true);
    return false;
  };
  const swipeDismiss = useSwipeDismiss({ visible: isOpen, onDismiss: onClose, disabled: isUploading, shouldDismiss: shouldDismissLime });

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
  const [dialogState, setDialogState] = useState<{
    visible: boolean;
    type: 'error' | 'warning' | 'info' | 'success';
    title: string;
    message: string;
  }>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
  });

  const handleTrimmedLimeVideo = (result: TrimmedVideoResult) => {
    const source = trimSourceAsset;
    setTrimSourceAsset(null);
    if (!source) return;
    if (result.fileSize > MAX_LIME_VIDEO_SIZE_BYTES) {
      setDialogState({ visible: true, type: 'warning', title: 'Video too large', message: 'Lime videos can be up to 100 MB. Try a shorter part.' });
      return;
    }
    // Continue into the usual cover-frame step with the shortened file.
    setPendingAsset({
      ...source,
      uri: result.uri,
      // A cut can land a few milliseconds over the limit (frame timing); the Lime itself is within it.
      duration: Math.round(Math.min(result.durationSeconds, MAX_LIME_VIDEO_DURATION_SECONDS) * 1000),
      fileSize: result.fileSize,
      mimeType: 'video/mp4',
      fileName: `${(source.fileName ?? 'lime').replace(/\.[^.]+$/, '')}.mp4`,
    });
  };

  const handleTrimLimeError = (message: string) => {
    setTrimSourceAsset(null);
    setDialogState({ visible: true, type: 'error', title: 'Video trimming', message });
  };

  /* ── Video Picker with 9:16 Instagram Crop Aspect Ratio (Non-deprecated) ── */
  const handlePickVideo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setDialogState({
          visible: true,
          type: 'warning',
          title: 'Permission required',
          message: 'Please grant media library access to pick a video.',
        });
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
          setDialogState({
            visible: true,
            type: 'warning',
            title: 'Unsupported video',
            message: 'Please select an MP4, MOV, or WebM video.',
          });
          return;
        }
        if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
          setDialogState({
            visible: true,
            type: 'error',
            title: 'Unreadable video',
            message: 'The video duration could not be read. Please select another video.',
          });
          return;
        }
        if (durationSeconds > MAX_LIME_VIDEO_DURATION_SECONDS) {
          // Too long: open the trimmer (the file is really cut on the device, then the 100 MB check runs on the result).
          if (videoTrimService.isAvailable()) {
            setTrimSourceAsset(asset);
            return;
          }
          setDialogState({
            visible: true,
            type: 'warning',
            title: 'Video too long',
            message: `Limes can be up to ${MAX_LIME_VIDEO_DURATION_SECONDS} seconds.`,
          });
          return;
        }
        if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_LIME_VIDEO_SIZE_BYTES) {
          setDialogState({
            visible: true,
            type: 'warning',
            title: 'Video too large',
            message: 'Lime videos can be up to 100 MB.',
          });
          return;
        }
        setPendingAsset(asset);
      }
    } catch (error) {
      console.error('[CreateLimeModal] Video pick error:', error);
      setDialogState({
        visible: true,
        type: 'error',
        title: 'Error',
        message: 'Could not select video file.',
      });
    }
  };

  const handleRemoveVideo = () => {
    setSelectedAsset(null);
    setSelectedThumbnailUri('');
  };

  const handleCancelPendingVideo = () => {
    setPendingAsset(null);
  };

  const handleFinishPendingVideo = () => {
    if (!pendingAsset) return;
    setSelectedAsset(pendingAsset);
    setPendingAsset(null);
  };

  const handleSubmit = async () => {
    const user = authService.getCurrentUser();
    if (!user) {
      setDialogState({
        visible: true,
        type: 'warning',
        title: 'Authentication required',
        message: 'Please sign in to post a Lime.',
      });
      return;
    }

    if (!selectedAsset) {
      setDialogState({
        visible: true,
        type: 'warning',
        title: 'Video required',
        message: 'Please select a video file to post.',
      });
      return;
    }

    const durationSeconds = typeof selectedAsset.duration === 'number' ? selectedAsset.duration / 1000 : 0;
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_LIME_VIDEO_DURATION_SECONDS) {
      setDialogState({
        visible: true,
        type: 'warning',
        title: 'Invalid video',
        message: `Choose a readable video that is ${MAX_LIME_VIDEO_DURATION_SECONDS} seconds or shorter.`,
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Extract @mentions from caption
      const mentions = (caption.match(/@([a-zA-Z0-9._]+)/g) || []).map((m) => m.replace('@', ''));
      let thumbnailUri: string | undefined = selectedThumbnailUri;
      if (!thumbnailUri) {
        try {
          thumbnailUri = await limeThumbnailService.createThumbnail(selectedAsset.uri, durationSeconds);
        } catch (thumbnailError: unknown) {
          setIsUploading(false);
          setUploadProgress(0);
          setDialogState({
            visible: true,
            type: 'error',
            title: 'Cover not prepared',
            message: thumbnailError instanceof Error ? thumbnailError.message : 'A video cover is required before posting a Lime.',
          });
          return;
        }
      }

      if (!thumbnailUri) {
        setIsUploading(false);
        setUploadProgress(0);
        setDialogState({
          visible: true,
          type: 'error',
          title: 'Cover not prepared',
          message: 'A video cover is required before posting a Lime.',
        });
        return;
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
      if (openedDraftId) {
        const publishedDraftId = openedDraftId;
        setOpenedDraftId(null);
        void creationDraftService.remove(user.uid, publishedDraftId).then(() => refreshDrafts()).catch(() => undefined);
      }
      void interactionFeedbackService.play('success');
      setShowSuccessModal(true);
    } catch (error: unknown) {
      console.error('[CreateLimeModal] Submit error:', error);
      setIsUploading(false);
      setUploadProgress(0);
      setDialogState({
        visible: true,
        type: 'error',
        title: 'Upload Failed',
        message: error instanceof Error ? error.message : 'Could not upload your Lime reel.',
      });
    }
  };

  const handleFinishSuccess = () => {
    setShowSuccessModal(false);
    setSelectedAsset(null);
    setPendingAsset(null);
    setSelectedThumbnailUri('');
    setCaption('');
    setCategory('For You');
    onSuccess();
    onClose();
  };

  return (
    <>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity onPress={() => { setDraftsNotice(null); setIsDraftsSheetVisible(true); void refreshDrafts(); }} style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.control }} accessibilityLabel="View Lime drafts">
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 12 }}>Drafts ({drafts.length}/{MAX_DRAFTS_PER_KIND})</Text>
              </TouchableOpacity>
              {hasLimeContent ? (
                <TouchableOpacity onPress={() => void saveLimeDraft().then((saved) => { if (saved) setDialogState({ visible: true, type: 'success', title: 'Draft saved', message: 'Drafts are kept for 7 days. You can finish this Lime here or on the website.' }); })} disabled={isDraftBusy || isUploading} style={{ paddingHorizontal: 8, paddingVertical: 7 }} accessibilityLabel="Save Lime draft">
                  {isDraftBusy ? <ActivityIndicator size="small" color={colors.accent} /> : <Text style={{ color: colors.accentText, fontWeight: '800', fontSize: 12 }}>Save draft</Text>}
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={swipeDismiss.dismissWithAnimation} style={[styles.closeBtn, { backgroundColor: colors.control }]} disabled={isUploading} accessibilityLabel="Close Lime creation">
                <X size={20} color={colors.icon} />
              </TouchableOpacity>
            </View>
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
              <>
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

                {/* Video Thumbnail Frame Selector & Custom Cover Upload */}
                <VideoThumbnailPicker
                  key={selectedAsset.uri}
                  videoUri={selectedAsset.uri}
                  durationSeconds={typeof selectedAsset.duration === 'number' ? selectedAsset.duration / 1000 : 0}
                  selectedThumbnailUri={selectedThumbnailUri}
                  onThumbnailChange={setSelectedThumbnailUri}
                  aspectRatio="9:16"
                  openEditorOnMount
                />
              </>
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
            <TouchableOpacity onPress={swipeDismiss.dismissWithAnimation} style={[styles.cancelBtn, { backgroundColor: colors.control, borderColor: colors.border }]} disabled={isUploading}>
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

      <CustomModal
        visible={dialogState.visible}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        onClose={() => setDialogState((prev) => ({ ...prev, visible: false }))}
      />
    </Modal>
    {trimSourceAsset ? (
      <VideoTrimModal
        source={{
          uri: trimSourceAsset.uri,
          durationSeconds: (trimSourceAsset.duration ?? 0) / 1000,
          fileSize: trimSourceAsset.fileSize ?? 0,
        }}
        maxDurationSeconds={MAX_LIME_VIDEO_DURATION_SECONDS}
        title="Trim your Lime"
        requireCut
        onCancel={() => setTrimSourceAsset(null)}
        onComplete={handleTrimmedLimeVideo}
        onError={handleTrimLimeError}
      />
    ) : null}
    <DraftsSheet
      visible={isDraftsSheetVisible}
      kind="lime"
      drafts={drafts}
      loading={isDraftsLoading}
      notice={draftsNotice}
      openingDraftId={openingDraftId}
      onOpenDraft={(draft) => void openLimeDraft(draft)}
      onDeleteDraft={deleteLimeDraft}
      onClose={() => { setIsDraftsSheetVisible(false); setDraftsNotice(null); }}
    />
    <DraftDiscardSheet
      visible={isLeaveSheetVisible}
      title="Leave your Lime?"
      message="Save it as a draft to finish later (drafts are kept for 7 days), or discard it."
      isSaving={isDraftBusy}
      onSaveDraft={() => void saveLimeDraft().then((saved) => { if (saved) { setIsLeaveSheetVisible(false); resetLimeForm(); onClose(); } })}
      onDiscard={() => { setIsLeaveSheetVisible(false); resetLimeForm(); onClose(); }}
      onContinue={() => setIsLeaveSheetVisible(false)}
    />
    <LimeVideoConfirmationModal
      asset={pendingAsset}
      selectedThumbnailUri={selectedThumbnailUri}
      onThumbnailChange={setSelectedThumbnailUri}
      onCancel={handleCancelPendingVideo}
      onFinish={handleFinishPendingVideo}
    />
    </>
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
    height: 240,
    borderRadius: 18,
    backgroundColor: '#000000',
  },
  confirmationScreen: { flex: 1 },
  confirmationHeader: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  confirmationHeaderAction: { minWidth: 72, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  confirmationCancelText: { fontSize: 15, fontWeight: '700' },
  confirmationFinishText: { fontSize: 15, fontWeight: '900' },
  confirmationTitle: { fontSize: 17, fontWeight: '900' },
  confirmationBody: { padding: 18, paddingBottom: 36, alignItems: 'center' },
  confirmationCoverSection: {
    width: '100%',
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  confirmationCoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmationCoverTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  confirmationCoverSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmationFrameTrack: {
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    flexDirection: 'row',
    position: 'relative',
    backgroundColor: '#000000',
  },
  confirmationFrameThumb: {
    flex: 1,
    height: '100%',
  },
  confirmationFrameSelector: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderWidth: 2.5,
    borderColor: '#10b981',
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  confirmationFramesLoading: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmationCustomCoverBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  confirmationCustomCoverText: {
    fontSize: 13,
    fontWeight: '700',
  },
  confirmationHelp: { marginTop: 14, fontSize: 13, lineHeight: 18, textAlign: 'center', fontWeight: '600' },
  confirmationMeta: { marginTop: 6, fontSize: 12, textAlign: 'center' },
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
