import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Icon from 'react-native-vector-icons/Feather';
import { createVideoPlayer } from 'expo-video';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { limeThumbnailService } from '@/lib/services/LimeThumbnailService';

type VideoThumbnailPickerProps = {
  videoUri: string;
  durationSeconds: number;
  selectedThumbnailUri?: string;
  onThumbnailChange: (thumbnailUri: string) => void;
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
};

const formatSeconds = (totalSeconds: number): string => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export default function VideoThumbnailPicker({
  videoUri,
  durationSeconds,
  selectedThumbnailUri,
  onThumbnailChange,
  aspectRatio = '9:16',
}: VideoThumbnailPickerProps) {
  const { colors } = useAppTheme();
  const [currentThumbnail, setCurrentThumbnail] = useState<string>(selectedThumbnailUri || '');
  const [scrubTime, setScrubTime] = useState<number>(
    Math.min(Math.max(durationSeconds * 0.2, 0.1), Math.max(durationSeconds - 0.1, 0.1))
  );
  const [isExtractingFrame, setIsExtractingFrame] = useState(false);
  const [isCustomUpload, setIsCustomUpload] = useState(false);
  const [showScrubber, setShowScrubber] = useState(false);
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const extractDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate initial default thumbnail if not present
  useEffect(() => {
    if (selectedThumbnailUri) {
      setCurrentThumbnail(selectedThumbnailUri);
      return;
    }
    if (!videoUri || durationSeconds <= 0) return;

    let isMounted = true;
    setIsExtractingFrame(true);
    limeThumbnailService
      .createThumbnail(videoUri, durationSeconds)
      .then((uri: string) => {
        if (isMounted && uri) {
          setCurrentThumbnail(uri);
          onThumbnailChange(uri);
        }
      })
      .catch((err: unknown) => {
        console.warn('[VideoThumbnailPicker] Default thumbnail failed:', err);
      })
      .finally(() => {
        if (isMounted) setIsExtractingFrame(false);
      });

    return () => {
      isMounted = false;
    };
  }, [videoUri, durationSeconds, selectedThumbnailUri, onThumbnailChange]);

  // Extract a specific frame at timestamp
  const extractFrameAtTime = useCallback(
    async (timestamp: number) => {
      if (!videoUri) return;
      setIsExtractingFrame(true);
      try {
        const videoPlayer = createVideoPlayer(videoUri);
        try {
          const boundedTime = Math.min(Math.max(timestamp, 0.05), Math.max(durationSeconds - 0.05, 0.05));
          const thumbnails = await videoPlayer.generateThumbnailsAsync(boundedTime, {
            maxWidth: aspectRatio === '9:16' ? 720 : 1280,
            maxHeight: aspectRatio === '9:16' ? 1280 : 720,
          });
          const thumbnail = thumbnails[0];
          if (thumbnail) {
            const imageContext = ImageManipulator.manipulate(thumbnail);
            const image = await imageContext.renderAsync();
            const savedImage = await image.saveAsync({
              compress: 0.85,
              format: SaveFormat.JPEG,
            });
            setCurrentThumbnail(savedImage.uri);
            setIsCustomUpload(false);
            onThumbnailChange(savedImage.uri);
          }
        } finally {
          videoPlayer.release();
        }
      } catch (error) {
        console.warn('[VideoThumbnailPicker] Frame extraction failed:', error);
      } finally {
        setIsExtractingFrame(false);
      }
    },
    [videoUri, durationSeconds, aspectRatio, onThumbnailChange]
  );

  const scheduleFrameExtraction = (time: number) => {
    const bounded = Math.min(Math.max(time, 0.1), Math.max(durationSeconds, 0.1));
    setScrubTime(bounded);
    if (extractDebounceRef.current) clearTimeout(extractDebounceRef.current);
    extractDebounceRef.current = setTimeout(() => {
      void extractFrameAtTime(bounded);
    }, 200);
  };

  const handleTrackTouch = (event: GestureResponderEvent) => {
    if (trackWidth <= 0 || durationSeconds <= 0) return;
    const locationX = event.nativeEvent.locationX;
    const fraction = Math.max(0, Math.min(locationX / trackWidth, 1));
    const targetSeconds = fraction * durationSeconds;
    scheduleFrameExtraction(targetSeconds);
  };

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const handlePickCustomImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission required', 'Please grant media access to pick a thumbnail image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: aspectRatio === '9:16' ? [9, 16] : aspectRatio === '16:9' ? [16, 9] : [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const customUri = result.assets[0].uri;
        setCurrentThumbnail(customUri);
        setIsCustomUpload(true);
        setShowScrubber(false);
        onThumbnailChange(customUri);
      }
    } catch (error) {
      console.error('[VideoThumbnailPicker] Pick image error:', error);
      Alert.alert('Error', 'Could not select custom thumbnail image.');
    }
  };

  const scrubberPercentage = durationSeconds > 0 ? (scrubTime / durationSeconds) * 100 : 20;

  // Preset time jump points
  const timePresets = [
    { label: 'Start', fraction: 0.05 },
    { label: '25%', fraction: 0.25 },
    { label: '50%', fraction: 0.5 },
    { label: '75%', fraction: 0.75 },
    { label: 'End', fraction: 0.95 },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.control, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="image" size={16} color="#10b981" />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Video Thumbnail (Cover)</Text>
        </View>
        <Text style={[styles.durationBadge, { color: colors.mutedText }]}>
          {isCustomUpload ? 'Custom Image' : `Frame @ ${formatSeconds(scrubTime)}`}
        </Text>
      </View>

      <View style={styles.contentRow}>
        {/* Thumbnail Preview Card */}
        <View style={styles.previewContainer}>
          {currentThumbnail ? (
            <Image
              source={{ uri: currentThumbnail }}
              style={[
                styles.previewImage,
                aspectRatio === '9:16' ? styles.aspect916 : styles.aspect169,
              ]}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.previewPlaceholder,
                aspectRatio === '9:16' ? styles.aspect916 : styles.aspect169,
                { backgroundColor: colors.surface },
              ]}
            >
              <ActivityIndicator size="small" color="#10b981" />
            </View>
          )}

          {isExtractingFrame ? (
            <View style={styles.extractingOverlay}>
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          ) : null}

          <View style={styles.coverBadge}>
            <Text style={styles.coverBadgeText}>Cover</Text>
          </View>
        </View>

        {/* Control Actions */}
        <View style={styles.controlsColumn}>
          <Text style={[styles.helperText, { color: colors.secondaryText }]}>
            Select the frame or upload a custom image for OpenGraph link previews and feed cards.
          </Text>

          <View style={styles.buttonsRow}>
            <TouchableOpacity
              onPress={() => setShowScrubber((prev) => !prev)}
              style={[
                styles.actionButton,
                {
                  backgroundColor: showScrubber ? 'rgba(16, 185, 129, 0.15)' : colors.surface,
                  borderColor: showScrubber ? '#10b981' : colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Icon name="sliders" size={14} color={showScrubber ? '#10b981' : colors.text} />
              <Text style={[styles.actionButtonText, { color: showScrubber ? '#10b981' : colors.text }]}>
                {showScrubber ? 'Hide Scrubber' : 'Scrub Frame'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePickCustomImage}
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.7}
            >
              <Icon name="upload" size={14} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text }]}>Upload Cover</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Frame Scrubber Interactive Timeline */}
      {showScrubber ? (
        <View style={[styles.scrubberContainer, { borderTopColor: colors.border }]}>
          <View style={styles.scrubberHeader}>
            <Text style={[styles.scrubberLabel, { color: colors.text }]}>
              Tap or drag timeline to select cover frame:
            </Text>
            <Text style={styles.scrubberTime}>
              {formatSeconds(scrubTime)} / {formatSeconds(durationSeconds)}
            </Text>
          </View>

          {/* Interactive Scrub Track */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleTrackTouch}
            onLayout={handleTrackLayout}
            style={[styles.trackContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View
              style={[
                styles.trackFill,
                {
                  width: `${Math.max(0, Math.min(100, scrubberPercentage))}%`,
                  backgroundColor: '#10b981',
                },
              ]}
            />
            <View
              style={[
                styles.trackThumb,
                {
                  left: `${Math.max(0, Math.min(96, scrubberPercentage))}%`,
                },
              ]}
            />
          </TouchableOpacity>

          {/* Quick preset frame jump buttons */}
          <View style={styles.presetButtonsRow}>
            {timePresets.map((preset) => (
              <TouchableOpacity
                key={preset.label}
                onPress={() => scheduleFrameExtraction(preset.fraction * durationSeconds)}
                style={[
                  styles.presetChip,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.presetChipText, { color: colors.secondaryText }]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  durationBadge: {
    fontSize: 12,
    fontWeight: '600',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  previewContainer: {
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewImage: {
    borderRadius: 10,
  },
  previewPlaceholder: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aspect916: {
    width: 60,
    height: 106,
  },
  aspect169: {
    width: 106,
    height: 60,
  },
  extractingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#10b981',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  controlsColumn: {
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 10,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrubberContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  scrubberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  scrubberLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrubberTime: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '800',
  },
  trackContainer: {
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    marginVertical: 4,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.3,
  },
  trackThumb: {
    position: 'absolute',
    width: 14,
    height: 20,
    borderRadius: 7,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  presetButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 6,
  },
  presetChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
