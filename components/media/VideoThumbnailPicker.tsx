import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import {
  limeThumbnailService,
  type LimeCoverFrame,
  type LimeCoverSelection,
} from '@/lib/services/LimeThumbnailService';
import { limeCoverTimelineService } from '@/lib/services/LimeCoverTimelineService';

type VideoThumbnailPickerProps = {
  videoUri: string;
  durationSeconds: number;
  selectedThumbnailUri?: string;
  onThumbnailChange: (thumbnailUri: string) => void;
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
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
}: VideoThumbnailPickerProps) {
  const { colors } = useAppTheme();
  const [frames, setFrames] = useState<LimeCoverFrame[]>([]);
  const [selection, setSelection] = useState<LimeCoverSelection | null>(null);
  const [extractionState, setExtractionState] = useState<ExtractionState>({ status: 'loading', message: 'Preparing cover…' });
  const [editorVisible, setEditorVisible] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const generationIdRef = useRef(0);
  const dragStartXRef = useRef(0);

  const selectedFrame = frames[selectedFrameIndex] ?? null;
  const selectorWidth = frames.length > 0 && trackWidth > 0 ? trackWidth / frames.length : 0;
  const selectorLeft = selectorWidth * selectedFrameIndex;

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
      setSelectedFrameIndex(defaultIndex);
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

  const handleSelectFrame = useCallback((frameIndex: number) => {
    if (frames.length === 0) return;
    setSelectedFrameIndex(Math.min(Math.max(frameIndex, 0), frames.length - 1));
  }, [frames.length]);

  const handleSelectFromTrackX = useCallback((trackX: number) => {
    if (selectorWidth <= 0 || frames.length === 0) return;
    handleSelectFrame(limeCoverTimelineService.getFrameIndex(trackX, trackWidth, frames.length));
  }, [frames.length, handleSelectFrame, selectorWidth, trackWidth]);

  const framePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      dragStartXRef.current = event.nativeEvent.locationX;
      handleSelectFromTrackX(event.nativeEvent.locationX);
    },
    onPanResponderMove: (_event, gestureState) => {
      handleSelectFromTrackX(dragStartXRef.current + gestureState.dx);
    },
  }), [handleSelectFromTrackX]);

  const handleTrackLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);

  const handleSaveFrame = async () => {
    if (!selectedFrame) return;
    setExtractionState({ status: 'loading', message: 'Saving cover…' });
    try {
      const finalUri = await limeThumbnailService.createThumbnailAtTime(videoUri, selectedFrame.timestampSeconds);
      setSelection({ source: 'video-frame', timestampSeconds: selectedFrame.timestampSeconds, previewUri: selectedFrame.previewUri, finalUri });
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
        Alert.alert('Permission required', 'Please grant media access to choose a cover image.');
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
      Alert.alert('Cover not selected', error instanceof Error ? error.message : 'Please try another image.');
    }
  };

  return (
    <>
      <View style={[styles.coverCard, { borderColor: colors.border, backgroundColor: colors.control }]}>
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
            <TouchableOpacity onPress={() => void handleSaveFrame()} disabled={!selectedFrame || extractionState.status === 'loading'} style={styles.headerAction}>
              <Text style={[styles.doneText, { color: colors.accentText }, extractionState.status === 'loading' && { opacity: 0.5 }]}>Done</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.editorBody}>
            <Text style={[styles.editorHelp, { color: colors.secondaryText }]}>Choose a frame from your video or add a cover from your camera roll.</Text>
            <View style={[styles.largePreviewShell, { backgroundColor: colors.control }]}>
              {selectedFrame?.previewUri || selection?.previewUri ? <Image source={{ uri: selectedFrame?.previewUri ?? selection?.previewUri }} style={styles.largePreview} resizeMode="cover" /> : <ActivityIndicator color={colors.accent} />}
            </View>
            <Text style={[styles.timestamp, { color: colors.mutedText }]}>Frame {formatSeconds(selectedFrame?.timestampSeconds ?? 0)}</Text>

            {frames.length > 0 ? (
              <View onLayout={handleTrackLayout} style={styles.frameTrack} {...framePanResponder.panHandlers}>
                {frames.map((frame) => <Image key={frame.id} source={{ uri: frame.previewUri }} style={styles.frameImage} resizeMode="cover" />)}
                {selectorWidth > 0 ? <View pointerEvents="none" style={[styles.frameSelector, { width: selectorWidth, left: selectorLeft }]} /> : null}
              </View>
            ) : extractionState.status === 'loading' ? (
              <View style={styles.timelineLoading}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.mutedText }}>{extractionState.message}</Text></View>
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
    </>
  );
}

const styles = StyleSheet.create({
  coverCard: { borderWidth: 1, borderRadius: 18, marginTop: 12, marginBottom: 14, overflow: 'hidden' },
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
