import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, PanResponder, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import type { LimeCoverFrame } from '@/lib/services/LimeThumbnailService';

type CoverFrameScrubberProps = {
  durationSeconds: number;
  frames: LimeCoverFrame[];
  valueSeconds: number;
  loading?: boolean;
  onChange: (seconds: number) => void;
  /** Lets a parent ScrollView stop scrolling while the user drags the selector. */
  onDraggingChange?: (dragging: boolean) => void;
};

type CoverFramePreviewProps = {
  uri: string;
  timeSeconds: number;
  style?: StyleProp<ViewStyle>;
};

const MIN_SELECTOR_WIDTH = 36;

/**
 * Cover-frame picker strip (Limes and feed videos): the filmstrip with a selector box that slides smoothly through
 * the whole video. Positions come from the finger's page X against the measured strip (not the thumbnail under the
 * finger), and the gesture can't be stolen by a parent scroll view, so the selection never jumps back.
 */
export function CoverFrameScrubber({ durationSeconds, frames, valueSeconds, loading = false, onChange, onDraggingChange }: CoverFrameScrubberProps) {
  const trackRef = useRef<View>(null);
  const trackPageXRef = useRef(0);
  const grabOffsetRef = useRef(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const safeDuration = Math.max(durationSeconds, 0.1);
  const selectorWidth = trackWidth > 0 ? Math.max(MIN_SELECTOR_WIDTH, trackWidth / Math.max(frames.length, 1)) : 0;
  const travel = Math.max(trackWidth - selectorWidth, 1);
  const selectorLeft = (Math.min(Math.max(valueSeconds, 0), safeDuration) / safeDuration) * travel;

  // Latest geometry for the gesture handlers (created once).
  const geometryRef = useRef({ travel, selectorLeft, safeDuration, selectorWidth });
  geometryRef.current = { travel, selectorLeft, safeDuration, selectorWidth };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onDraggingChangeRef = useRef(onDraggingChange);
  onDraggingChangeRef.current = onDraggingChange;

  const measureTrack = (): void => {
    trackRef.current?.measureInWindow((pageX) => { trackPageXRef.current = pageX; });
  };

  const handleLayout = (event: LayoutChangeEvent): void => {
    setTrackWidth(event.nativeEvent.layout.width);
    measureTrack();
  };

  const panResponder = useMemo(() => {
    const secondsAtPageX = (pageX: number): number => {
      const { travel: currentTravel, safeDuration: duration } = geometryRef.current;
      const left = Math.min(Math.max(pageX - trackPageXRef.current - grabOffsetRef.current, 0), currentTravel);
      return (left / currentTravel) * duration;
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (event) => {
        measureTrack();
        const { selectorLeft: left, selectorWidth: width } = geometryRef.current;
        const touchX = event.nativeEvent.pageX - trackPageXRef.current;
        // Grabbing the box keeps the finger where it touched it; tapping elsewhere centres the box on the finger.
        grabOffsetRef.current = touchX >= left && touchX <= left + width ? touchX - left : width / 2;
        onDraggingChangeRef.current?.(true);
        onChangeRef.current(secondsAtPageX(event.nativeEvent.pageX));
      },
      onPanResponderMove: (event) => onChangeRef.current(secondsAtPageX(event.nativeEvent.pageX)),
      onPanResponderRelease: () => onDraggingChangeRef.current?.(false),
      onPanResponderTerminate: () => onDraggingChangeRef.current?.(false),
    });
  }, []);

  if (frames.length === 0) {
    return <View style={styles.loadingTrack}>{loading ? <ActivityIndicator color="#10b981" /> : null}</View>;
  }

  return (
    <View ref={trackRef} onLayout={handleLayout} style={styles.track} {...panResponder.panHandlers}>
      {frames.map((frame) => <Image key={frame.id} source={{ uri: frame.previewUri }} style={styles.frame} resizeMode="cover" />)}
      {selectorWidth > 0 ? (
        <>
          <View pointerEvents="none" style={[styles.scrim, { left: 0, width: selectorLeft }]} />
          <View pointerEvents="none" style={[styles.scrim, { left: selectorLeft + selectorWidth, right: 0 }]} />
          <View pointerEvents="none" style={[styles.selector, { left: selectorLeft, width: selectorWidth }]} />
        </>
      ) : null}
    </View>
  );
}

/** Big cover preview: the video paused exactly at the chosen time (no player controls). */
export function CoverFramePreview({ uri, timeSeconds, style }: CoverFramePreviewProps) {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.muted = true;
    videoPlayer.loop = false;
    videoPlayer.pause();
  });

  useEffect(() => {
    try {
      player.pause();
      player.currentTime = Math.max(timeSeconds, 0);
    } catch {
      // The player may not be ready yet; the next change seeks again.
    }
  }, [player, timeSeconds]);

  return <VideoView player={player} style={style} nativeControls={false} contentFit="cover" surfaceType="textureView" />;
}

const styles = StyleSheet.create({
  track: { width: '100%', height: 64, flexDirection: 'row', borderRadius: 10, overflow: 'hidden', backgroundColor: '#111827' },
  frame: { flex: 1, height: '100%' },
  scrim: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  selector: { position: 'absolute', top: 0, bottom: 0, borderWidth: 3, borderColor: '#ffffff', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)' },
  loadingTrack: { width: '100%', height: 64, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827' },
});
