import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import Icon from 'react-native-vector-icons/Feather';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  MAX_POST_VIDEO_DURATION_SECONDS,
  type PendingVideoTrim,
} from '@/lib/services/PostMediaService';
import type { PostMediaDraft } from '@/lib/services/PostService';
import { limeThumbnailService, type LimeCoverFrame } from '@/lib/services/LimeThumbnailService';

type VideoTrimModalProps = {
  pending: PendingVideoTrim;
  queueLength: number;
  onCancel: () => void;
  onComplete: (media: PostMediaDraft) => void;
};

const FILMSTRIP_FRAME_COUNT = 10;
const HANDLE_WIDTH = 18;

function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

export default function VideoTrimModal({
  pending,
  queueLength,
  onCancel,
  onComplete,
}: VideoTrimModalProps) {
  const totalDuration = Math.max(0.5, pending.durationSeconds);
  const maxAllowedDuration = Math.min(totalDuration, MAX_POST_VIDEO_DURATION_SECONDS);

  const [frames, setFrames] = useState<LimeCoverFrame[]>([]);
  const [framesLoading, setFramesLoading] = useState(true);
  const [trackWidth, setTrackWidth] = useState(0);

  // Trim range in seconds [startSeconds, endSeconds]
  const [startSeconds, setStartSeconds] = useState(0);
  const [endSeconds, setEndSeconds] = useState(maxAllowedDuration);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showToast, setShowToast] = useState(true);

  const startSecondsRef = useRef(0);
  const endSecondsRef = useRef(maxAllowedDuration);
  const trackWidthRef = useRef(0);
  const isDraggingRef = useRef(false);

  startSecondsRef.current = startSeconds;
  endSecondsRef.current = endSeconds;
  trackWidthRef.current = trackWidth;

  const toastOpacity = useRef(new Animated.Value(1)).current;

  // Auto-hide toast after 4 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setShowToast(false));
    }, 4000);
    return () => clearTimeout(timer);
  }, [toastOpacity]);

  // Video player configuration
  const player = useVideoPlayer(pending.asset.uri, (p) => {
    p.loop = false;
    p.muted = true;
    p.play();
  });

  // Track playback time and loop within [startSeconds, endSeconds]
  useEffect(() => {
    const timeSub = player.addListener('timeUpdate', (event) => {
      if (isDraggingRef.current) return;
      const currentStart = startSecondsRef.current;
      const currentEnd = endSecondsRef.current;
      if (event.currentTime >= currentEnd || event.currentTime < currentStart) {
        try {
          player.currentTime = currentStart;
          player.play();
        } catch {
          // ignore
        }
      }
    });
    const playingSub = player.addListener('playingChange', (event) => {
      setIsPlaying(event.isPlaying);
    });
    return () => {
      timeSub.remove();
      playingSub.remove();
    };
  }, [player]);

  // Extract filmstrip frames for the timeline
  useEffect(() => {
    let active = true;
    setFramesLoading(true);
    void (async () => {
      try {
        const generated = await limeThumbnailService.createTimelineFrames(
          pending.asset.uri,
          pending.durationSeconds,
          FILMSTRIP_FRAME_COUNT
        );
        if (active) {
          setFrames(generated);
          setFramesLoading(false);
        }
      } catch (error) {
        if (active) {
          console.warn('[VideoTrimModal] Failed to extract timeline frames:', error);
          setFramesLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [pending.asset.uri, pending.durationSeconds]);

  const handleTrackLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (w > 0 && w !== trackWidth) {
      setTrackWidth(w);
    }
  };

  // Convert seconds to pixel position and vice versa
  const secondsToPx = useCallback((sec: number): number => {
    if (trackWidthRef.current <= 0 || totalDuration <= 0) return 0;
    return (sec / totalDuration) * trackWidthRef.current;
  }, [totalDuration]);

  const pxToSeconds = useCallback((px: number): number => {
    if (trackWidthRef.current <= 0 || totalDuration <= 0) return 0;
    const clampedPx = Math.max(0, Math.min(px, trackWidthRef.current));
    return (clampedPx / trackWidthRef.current) * totalDuration;
  }, [totalDuration]);

  // Left (start) handle pan responder
  const startDragOffsetRef = useRef(0);
  const leftHandlePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      isDraggingRef.current = true;
      startDragOffsetRef.current = secondsToPx(startSecondsRef.current);
      try {
        player.pause();
      } catch {
        // ignore
      }
    },
    onPanResponderMove: (_event, gestureState) => {
      const newPx = startDragOffsetRef.current + gestureState.dx;
      let newSec = pxToSeconds(newPx);
      const currentEnd = endSecondsRef.current;
      newSec = Math.max(0, Math.min(newSec, currentEnd - 1));
      if (currentEnd - newSec > MAX_POST_VIDEO_DURATION_SECONDS) {
        newSec = currentEnd - MAX_POST_VIDEO_DURATION_SECONDS;
      }
      setStartSeconds(newSec);
      try {
        player.currentTime = newSec;
      } catch {
        // ignore
      }
    },
    onPanResponderRelease: () => {
      isDraggingRef.current = false;
      try {
        player.currentTime = startSecondsRef.current;
        player.play();
      } catch {
        // ignore
      }
    },
    onPanResponderTerminate: () => {
      isDraggingRef.current = false;
    },
  }), [player, pxToSeconds, secondsToPx]);

  // Right (end) handle pan responder
  const endDragOffsetRef = useRef(0);
  const rightHandlePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      isDraggingRef.current = true;
      endDragOffsetRef.current = secondsToPx(endSecondsRef.current);
      try {
        player.pause();
      } catch {
        // ignore
      }
    },
    onPanResponderMove: (_event, gestureState) => {
      const newPx = endDragOffsetRef.current + gestureState.dx;
      let newSec = pxToSeconds(newPx);
      const currentStart = startSecondsRef.current;
      newSec = Math.min(totalDuration, Math.max(newSec, currentStart + 1));
      if (newSec - currentStart > MAX_POST_VIDEO_DURATION_SECONDS) {
        newSec = currentStart + MAX_POST_VIDEO_DURATION_SECONDS;
      }
      setEndSeconds(newSec);
      try {
        player.currentTime = newSec;
      } catch {
        // ignore
      }
    },
    onPanResponderRelease: () => {
      isDraggingRef.current = false;
      try {
        player.currentTime = startSecondsRef.current;
        player.play();
      } catch {
        // ignore
      }
    },
    onPanResponderTerminate: () => {
      isDraggingRef.current = false;
    },
  }), [player, pxToSeconds, secondsToPx, totalDuration]);

  // Window pan responder (drag whole window)
  const windowDragStartRef = useRef({ startSec: 0, endSec: 0, startPx: 0 });
  const windowPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gestureState) => Math.abs(gestureState.dx) > 3,
    onPanResponderGrant: (event) => {
      isDraggingRef.current = true;
      windowDragStartRef.current = {
        startSec: startSecondsRef.current,
        endSec: endSecondsRef.current,
        startPx: event.nativeEvent.pageX,
      };
      try {
        player.pause();
      } catch {
        // ignore
      }
    },
    onPanResponderMove: (_event, gestureState) => {
      const windowDuration = windowDragStartRef.current.endSec - windowDragStartRef.current.startSec;
      const initialStartPx = secondsToPx(windowDragStartRef.current.startSec);
      const newStartPx = initialStartPx + gestureState.dx;
      let newStartSec = pxToSeconds(newStartPx);
      if (newStartSec < 0) newStartSec = 0;
      if (newStartSec + windowDuration > totalDuration) {
        newStartSec = totalDuration - windowDuration;
      }
      const newEndSec = newStartSec + windowDuration;
      setStartSeconds(newStartSec);
      setEndSeconds(newEndSec);
      try {
        player.currentTime = newStartSec;
      } catch {
        // ignore
      }
    },
    onPanResponderRelease: () => {
      isDraggingRef.current = false;
      try {
        player.currentTime = startSecondsRef.current;
        player.play();
      } catch {
        // ignore
      }
    },
    onPanResponderTerminate: () => {
      isDraggingRef.current = false;
    },
  }), [player, pxToSeconds, secondsToPx, totalDuration]);

  const togglePlayPause = () => {
    try {
      if (isPlaying) player.pause();
      else player.play();
    } catch {
      // ignore
    }
  };

  const toggleMute = () => {
    try {
      player.muted = !player.muted;
      setIsMuted(player.muted);
    } catch {
      // ignore
    }
  };

  const selectedDuration = Math.max(1, endSeconds - startSeconds);
  const estimatedBytes = Math.round((selectedDuration / totalDuration) * pending.fileSize);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      try {
        player.pause();
      } catch {
        // ignore
      }
      const thumbnailUri = await limeThumbnailService.createThumbnailAtTime(
        pending.asset.uri,
        startSeconds
      );
      onComplete({
        uri: pending.asset.uri,
        type: 'video',
        fileName: pending.fileName,
        mimeType: pending.mimeType,
        width: pending.asset.width,
        height: pending.asset.height,
        fileSize: estimatedBytes,
        durationSeconds: Math.round(selectedDuration),
        trimStartSeconds: Math.round(startSeconds * 100) / 100,
        trimEndSeconds: Math.round(endSeconds * 100) / 100,
        thumbnailUri,
      });
    } catch (error) {
      console.error('[VideoTrimModal] Error finishing video trim:', error);
      onComplete({
        uri: pending.asset.uri,
        type: 'video',
        fileName: pending.fileName,
        mimeType: pending.mimeType,
        width: pending.asset.width,
        height: pending.asset.height,
        fileSize: estimatedBytes,
        durationSeconds: Math.round(selectedDuration),
        trimStartSeconds: Math.round(startSeconds * 100) / 100,
        trimEndSeconds: Math.round(endSeconds * 100) / 100,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const leftPx = secondsToPx(startSeconds);
  const rightPx = secondsToPx(endSeconds);
  const windowWidthPx = Math.max(HANDLE_WIDTH * 2, rightPx - leftPx);

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      presentationStyle="overFullScreen"
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
          {/* Top Bar: Close Button, Title, and Aux controls */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={isProcessing}
              style={styles.circleIconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="x" size={20} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.topCenter}>
              {queueLength > 1 ? (
                <Text style={styles.queueText}>{queueLength} videos</Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={toggleMute}
              style={styles.circleIconButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name={isMuted ? 'volume-x' : 'volume-2'} size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Filmstrip Timeline Section */}
          <View style={styles.timelineSection}>
            <View style={styles.trackContainer} onLayout={handleTrackLayout}>
              {/* Background Filmstrip Frames */}
              <View style={styles.framesRow}>
                {frames.length > 0 ? (
                  frames.map((f) => (
                    <Image
                      key={f.id}
                      source={{ uri: f.previewUri }}
                      style={styles.frameThumbnail}
                      resizeMode="cover"
                    />
                  ))
                ) : (
                  <View style={styles.framePlaceholder}>
                    {framesLoading ? (
                      <ActivityIndicator size="small" color="#10b981" />
                    ) : null}
                  </View>
                )}
              </View>

              {/* Dimmed left scrim */}
              {trackWidth > 0 ? (
                <View
                  style={[styles.scrim, { left: 0, width: Math.max(0, leftPx) }]}
                  pointerEvents="none"
                />
              ) : null}

              {/* Dimmed right scrim */}
              {trackWidth > 0 ? (
                <View
                  style={[
                    styles.scrim,
                    { left: rightPx, width: Math.max(0, trackWidth - rightPx) },
                  ]}
                  pointerEvents="none"
                />
              ) : null}

              {/* Active selection box with top & bottom borders */}
              {trackWidth > 0 ? (
                <View
                  style={[
                    styles.selectionWindow,
                    { left: leftPx, width: windowWidthPx },
                  ]}
                  {...windowPanResponder.panHandlers}
                >
                  <View style={styles.windowTopBorder} />
                  <View style={styles.windowBottomBorder} />

                  {/* Left Handle */}
                  <View
                    style={styles.leftHandle}
                    {...leftHandlePanResponder.panHandlers}
                  >
                    <View style={styles.handlePillGrip} />
                  </View>

                  {/* Right Handle */}
                  <View
                    style={styles.rightHandle}
                    {...rightHandlePanResponder.panHandlers}
                  >
                    <View style={styles.handlePillGrip} />
                  </View>
                </View>
              ) : null}
            </View>

            {/* Stats row below filmstrip: duration & file size */}
            <View style={styles.statsRow}>
              <View style={styles.statsLeft}>
                <Icon
                  name={isMuted ? 'volume-x' : 'volume-2'}
                  size={15}
                  color="#9ca3af"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.statsText}>
                  {formatSeconds(selectedDuration)} • {formatBytes(estimatedBytes)}
                </Text>
              </View>
              <Text style={styles.statsMaxNotice}>2:00 max</Text>
            </View>
          </View>

          {/* Video Preview in Center */}
          <View style={styles.previewContainer}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={togglePlayPause}
              style={styles.videoTouchWrapper}
            >
              <VideoView
                player={player}
                style={styles.videoView}
                contentFit="contain"
                surfaceType="textureView"
                nativeControls={false}
              />
              {!isPlaying ? (
                <View style={styles.playIconOverlay} pointerEvents="none">
                  <View style={styles.playIconCircle}>
                    <Icon name="play" size={32} color="#ffffff" style={{ marginLeft: 3 }} />
                  </View>
                </View>
              ) : null}
            </TouchableOpacity>

            {/* WhatsApp-style Floating Toast Banner */}
            {showToast ? (
              <Animated.View
                style={[styles.toastBanner, { opacity: toastOpacity }]}
                pointerEvents="none"
              >
                <View style={styles.toastIconWrapper}>
                  <Icon name="scissors" size={14} color="#ffffff" />
                </View>
                <Text style={styles.toastText}>
                  Video trimmed to first 120 seconds
                </Text>
              </Animated.View>
            ) : null}
          </View>

          {/* Bottom Bar with Confirm Send Button */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={isProcessing}
              style={styles.bottomCancelButton}
            >
              <Text style={styles.bottomCancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => void handleConfirm()}
              disabled={isProcessing}
              style={styles.confirmButton}
              activeOpacity={0.85}
            >
              {isProcessing ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Icon name="check" size={26} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    zIndex: 20,
  },
  circleIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  timelineSection: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
  },
  trackContainer: {
    height: 48,
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1f2937',
  },
  framesRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  frameThumbnail: {
    flex: 1,
    height: '100%',
  },
  framePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  selectionWindow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  windowTopBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#ffffff',
  },
  windowBottomBorder: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#ffffff',
  },
  leftHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: HANDLE_WIDTH,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  rightHandle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: HANDLE_WIDTH,
    backgroundColor: '#ffffff',
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  handlePillGrip: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#1f2937',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  statsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsText: {
    color: '#f3f4f6',
    fontSize: 13,
    fontWeight: '700',
  },
  statsMaxNotice: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  previewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 8,
  },
  videoTouchWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoView: {
    width: '100%',
    height: '100%',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastBanner: {
    position: 'absolute',
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(30, 41, 59, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  toastIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
  },
  bottomCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomCancelText: {
    color: '#e5e7eb',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});