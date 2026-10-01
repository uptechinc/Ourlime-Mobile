import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import CustomModal from '@/components/ui/CustomModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import {
  limeThumbnailService,
  type LimeCoverFrame,
  type LimeCoverSelection,
} from '@/lib/services/LimeThumbnailService';
import { CoverFramePreview, CoverFrameScrubber } from '@/components/media/CoverFrameScrubber';

type VideoThumbnailPickerProps = {
  videoUri: string;
  durationSeconds: number;
  selectedThumbnailUri?: string;
  onThumbnailChange: (thumbnailUri: string) => void;
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
  openEditorOnMount?: boolean;
};

type ExtractionState =
  | { status: 'loading'; message: string }
  | { status: 'ready' }
  | { status: 'error'; message: string };

const FRAME_COUNT = 10;

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function VideoThumbnailPicker({
  videoUri,
  durationSeconds,
  selectedThumbnailUri,
  onThumbnailChange,
  openEditorOnMount = false,
}: VideoThumbnailPickerProps) {
  const { colors } = useAppTheme();
  const [frames, setFrames] = useState<LimeCoverFrame[]>([]);
  const [selection, setSelection] = useState<LimeCoverSelection | null>(null);
  const [extractionState, setExtractionState] = useState<ExtractionState>({ status: 'loading', message: 'Preparing cover…' });
  const [editorVisible, setEditorVisible] = useState(openEditorOnMount);
  // Cover time in seconds; the selector slides through the whole video, not just the 10 strip frames.
  const [coverSeconds, setCoverSeconds] = useState(0);
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
  const generationIdRef = useRef(0);

  const handleGenerateFrames = useCallback(async () => {
    if (!videoUri || durationSeconds <= 0) return;
    const generationId = generationIdRef.current + 1;
    generationIdRef.current = generationId;
    setExtractionState({ status: 'loading', message: 'Preparing cover…' });
    setFrames([]);
    try {
      const generatedFrames = await limeThumbnailService.createTimelineFrames(videoUri, durationSeconds, FRAME_COUNT);
      if (generationIdRef.current !== generationId) return;
      const defaultIndex = Math.min(2, generatedFrames.length - 1);
      const defaultFrame = generatedFrames[defaultIndex];
      setFrames(generatedFrames);
      setCoverSeconds(defaultFrame.timestampSeconds);
      setSelection({ source: 'video-frame', timestampSeconds: defaultFrame.timestampSeconds, previewUri: defaultFrame.previewUri, finalUri: defaultFrame.previewUri });
      onThumbnailChange(defaultFrame.previewUri);
      setExtractionState({ status: 'ready' });
    } catch (error: unknown) {
      if (generationIdRef.current !== generationId) return;
      setExtractionState({ status: 'error', message: error instanceof Error ? error.message : 'The cover could not be prepared.' });
    }
  }, [durationSeconds, onThumbnailChange, videoUri]);

  useEffect(() => {
    if (selectedThumbnailUri && selectedThumbnailUri !== selection?.finalUri) {
      setSelection({ source: 'custom-image', timestampSeconds: null, previewUri: selectedThumbnailUri, finalUri: selectedThumbnailUri });
      setExtractionState({ status: 'ready' });
      return;
    }
    if (!selection) void handleGenerateFrames();
    return () => {
      generationIdRef.current += 1;
    };
  }, [handleGenerateFrames, selectedThumbnailUri, selection]);

  const handleSaveFrame = async () => {
    if (frames.length === 0) return;
    setExtractionState({ status: 'loading', message: 'Saving cover…' });
    try {
      const finalUri = await limeThumbnailService.createThumbnailAtTime(videoUri, coverSeconds);
      setSelection({ source: 'video-frame', timestampSeconds: coverSeconds, previewUri: finalUri, finalUri });
      onThumbnailChange(finalUri);
      setExtractionState({ status: 'ready' });
      setEditorVisible(false);
    } catch (error: unknown) {
      setExtractionState({ status: 'error', message: error instanceof Error ? error.message : 'The selected cover could not be saved.' });
    }
  };

  const handlePickCustomImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setDialogState({
          visible: true,
          type: 'warning',
          title: 'Permission required',
          message: 'Please grant media access to choose a cover image.',
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [9, 16], quality: 0.86 });
      const customUri = result.canceled ? null : result.assets[0]?.uri;
      if (!customUri) return;
      setSelection({ source: 'custom-image', timestampSeconds: null, previewUri: customUri, finalUri: customUri });
      onThumbnailChange(customUri);
      setExtractionState({ status: 'ready' });
      setEditorVisible(false);
    } catch (error: unknown) {
      setDialogState({
        visible: true,
        type: 'error',
        title: 'Cover not selected',
        message: error instanceof Error ? error.message : 'Please try another image.',
      });
    }
  };

  return (
    <>
      <View style={[styles.coverCard, { borderColor: colors.border, backgroundColor: colors.control }]}>
        <View style={styles.coverCardHeader}>
          <View>
            <Text style={[styles.coverCardTitle, { color: colors.text }]}>Lime cover</Text>
            <Text style={[styles.coverCardSubtitle, { color: colors.mutedText }]}>Choose the frame people see before playback.</Text>
          </View>
          {selection?.previewUri ? (
            <TouchableOpacity onPress={() => setEditorVisible(true)} accessibilityRole="button" accessibilityLabel="Edit Lime cover from timeline" style={[styles.coverCardAction, { borderColor: colors.border }]}>
              <Text style={{ color: colors.accentText, fontWeight: '900' }}>Edit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.coverPreview}>
          {selection?.previewUri ? <Image source={{ uri: selection.previewUri }} style={styles.coverImage} resizeMode="cover" /> : (
            <View style={[styles.coverPlaceholder, { backgroundColor: colors.elevated }]}>
              {extractionState.status === 'loading' ? <ActivityIndicator color={colors.accent} /> : <Icon name="image" size={30} color={colors.mutedText} />}
            </View>
          )}
          {selection?.previewUri ? (
            <TouchableOpacity onPress={() => setEditorVisible(true)} style={styles.editCoverButton} accessibilityRole="button" accessibilityLabel="Edit Lime cover">
              <Text style={styles.editCoverText}>Edit cover</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        {extractionState.status === 'error' ? (
          <View style={styles.errorRow}>
            <Text style={[styles.errorText, { color: colors.destructiveText }]} numberOfLines={2}>{extractionState.message}</Text>
            <TouchableOpacity onPress={() => void handleGenerateFrames()} style={[styles.retryButton, { borderColor: colors.border }]}>
              <Text style={{ color: colors.accentText, fontWeight: '800' }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <Modal visible={editorVisible} animationType="slide" onRequestClose={() => setEditorVisible(false)}>
        <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.editor, { backgroundColor: colors.canvas }]}>
          <View style={[styles.editorHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setEditorVisible(false)} accessibilityRole="button" accessibilityLabel="Close cover editor" style={styles.headerAction}>
              <Icon name="chevron-left" size={26} color={colors.icon} />
            </TouchableOpacity>
            <Text style={[styles.editorTitle, { color: colors.text }]}>Edit cover</Text>
            <TouchableOpacity onPress={() => void handleSaveFrame()} disabled={frames.length === 0 || extractionState.status === 'loading'} style={styles.headerAction}>
              <Text style={[styles.doneText, { color: colors.accentText }, extractionState.status === 'loading' && { opacity: 0.5 }]}>Finish</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.editorBody}>
            <Text style={[styles.editorHelp, { color: colors.secondaryText }]}>Choose a frame from your video or add a cover from your camera roll.</Text>
            {/* The exact video frame at the chosen time (no player controls). */}
            <View style={[styles.largePreviewShell, { backgroundColor: colors.control }]}>
              {frames.length > 0 ? (
                <CoverFramePreview uri={videoUri} timeSeconds={coverSeconds} style={styles.largePreview} />
              ) : selection?.previewUri ? (
                <Image source={{ uri: selection.previewUri }} style={styles.largePreview} resizeMode="cover" />
              ) : <ActivityIndicator color={colors.accent} />}
            </View>
            <Text style={[styles.timestamp, { color: colors.mutedText }]}>Frame {formatSeconds(coverSeconds)}</Text>

            {frames.length > 0 || extractionState.status === 'loading' ? (
              <CoverFrameScrubber
                durationSeconds={durationSeconds}
                frames={frames}
                valueSeconds={coverSeconds}
                loading={extractionState.status === 'loading'}
                onChange={setCoverSeconds}
              />
            ) : (
              <TouchableOpacity onPress={() => void handleGenerateFrames()} style={[styles.retryWide, { backgroundColor: colors.control }]}>
                <Text style={{ color: colors.accentText, fontWeight: '900' }}>Retry frame extraction</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity onPress={() => void handlePickCustomImage()} style={[styles.cameraRollButton, { backgroundColor: colors.accent }]}>
              <Icon name="image" size={20} color={colors.onAccent} />
              <Text style={[styles.cameraRollText, { color: colors.onAccent }]}>Add from camera roll</Text>
            </TouchableOpacity>
          </View>

          {extractionState.status === 'loading' ? <View style={styles.busyOverlay} pointerEvents="none"><ActivityIndicator size="large" color="#ffffff" /><Text style={styles.busyText}>{extractionState.message}</Text></View> : null}
        </SafeAreaView>
      </Modal>

      <CustomModal
        visible={dialogState.visible}
        type={dialogState.type}
        title={dialogState.title}
        message={dialogState.message}
        onClose={() => setDialogState((prev) => ({ ...prev, visible: false }))}
      />
    </>
  );
}

const styles = StyleSheet.create({
  coverCard: { borderWidth: 1, borderRadius: 18, marginTop: 12, marginBottom: 14, overflow: 'hidden' },
  coverCardHeader: { minHeight: 68, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  coverCardTitle: { fontSize: 15, fontWeight: '900' },
  coverCardSubtitle: { marginTop: 3, fontSize: 11, lineHeight: 15 },
  coverCardAction: { minWidth: 58, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  coverPreview: { height: 260, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' },
  coverImage: { width: 146, height: 260, borderRadius: 22 },
  coverPlaceholder: { width: 146, height: 260, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  editCoverButton: { position: 'absolute', left: '50%', bottom: 12, marginLeft: -58, minWidth: 116, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.68)' },
  editCoverText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17 },
  retryButton: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  editor: { flex: 1 },
  editorHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10 },
  headerAction: { minWidth: 54, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  editorTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '900' },
  doneText: { fontSize: 15, fontWeight: '900' },
  editorBody: { flex: 1, padding: 20, alignItems: 'center' },
  editorHelp: { maxWidth: 330, textAlign: 'center', lineHeight: 20, marginTop: 12, marginBottom: 20 },
  largePreviewShell: { width: 230, height: 408, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  largePreview: { width: '100%', height: '100%' },
  timestamp: { marginTop: 10, marginBottom: 18, fontSize: 12, fontWeight: '700' },
  frameTrack: { width: '100%', height: 82, flexDirection: 'row', overflow: 'hidden', borderRadius: 10, backgroundColor: '#111827' },
  frameImage: { flex: 1, height: 82 },
  frameSelector: { position: 'absolute', top: 0, bottom: 0, borderWidth: 4, borderColor: '#ffffff', borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.05)' },
  timelineLoading: { height: 82, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  retryWide: { width: '100%', minHeight: 52, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cameraRollButton: { width: '100%', minHeight: 54, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', borderRadius: 17, marginTop: 22 },
  cameraRollText: { fontSize: 16, fontWeight: '900' },
  busyOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: 'rgba(2,6,23,0.72)' },
  busyText: { color: '#ffffff', fontWeight: '800' },
});
