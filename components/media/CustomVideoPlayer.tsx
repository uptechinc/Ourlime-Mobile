import { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoContentFit } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { usePlaybackInteraction } from '@/lib/hooks/usePlaybackInteraction';
import { PlaybackSeekBar } from '@/components/media/PlaybackSeekBar';
import { ensureMediaUrl } from '@/lib/helpers/mediaUrl';
import type { PlaybackSpeed } from '@/lib/services/PlaybackInteractionService';

type CustomVideoPlayerProps = {
  url: string;
  autoPlay?: boolean;
  startMuted?: boolean;
  loop?: boolean;
  contentFit?: VideoContentFit;
  /** Shows the playback speed chip (0.5x-2x). */
  showSpeed?: boolean;
};

const SPEEDS: PlaybackSpeed[] = [1, 1.5, 2, 0.5];

const overlayButton = {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: 'rgba(0, 0, 0, 0.65)',
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.2)',
};

/**
 * The app's video player (same look and gestures as feed videos): tap to play/pause, hold for 2x, drag the seek bar,
 * mute and speed buttons. Used everywhere a video is played outside the feed instead of the system controls.
 */
export default function CustomVideoPlayer({ url, autoPlay = true, startMuted = false, loop = false, contentFit = 'contain', showSpeed = true }: CustomVideoPlayerProps) {
  const [isMuted, setIsMuted] = useState(startMuted);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'readyToPlay' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [flashIcon, setFlashIcon] = useState<'play' | 'pause' | null>(null);
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const heldRef = useRef(false);
  const touchStartRef = useRef({ x: 0, y: 0 });

  const player = useVideoPlayer(ensureMediaUrl(url) || url, (instance) => {
    instance.loop = loop;
    instance.muted = startMuted;
    if (autoPlay) instance.play();
  });

  useEventListener(player, 'playingChange', ({ isPlaying: playing }) => setIsPlaying(playing));
  useEventListener(player, 'statusChange', ({ status: nextStatus, error }) => {
    setStatus(nextStatus);
    setErrorMessage(nextStatus === 'error' ? error?.message ?? 'This video could not be played.' : null);
  });

  const { session, snapshot, refresh } = usePlaybackInteraction(player, true, speed);

  const flash = (icon: 'play' | 'pause'): void => {
    setFlashIcon(icon);
    flashOpacity.setValue(1);
    Animated.sequence([Animated.delay(400), Animated.timing(flashOpacity, { toValue: 0, duration: 250, useNativeDriver: true })]).start(() => setFlashIcon(null));
  };

  const handleTogglePlay = (): void => {
    if (heldRef.current || session.snapshot().status !== 'idle') return;
    try {
      if (player.playing) {
        player.pause();
        flash('pause');
      } else {
        // Restart from the beginning when the video already finished.
        if (player.duration > 0 && player.currentTime >= player.duration - 0.25) player.currentTime = 0;
        player.play();
        flash('play');
      }
    } catch (error: unknown) {
      console.warn('[CustomVideoPlayer.handleTogglePlay] Error:', error instanceof Error ? error.message : String(error));
    }
  };

  const handleRetry = (): void => {
    setErrorMessage(null);
    setStatus('loading');
    try {
      player.replace(ensureMediaUrl(url) || url);
      player.play();
    } catch (error: unknown) {
      console.warn('[CustomVideoPlayer.handleRetry] Error:', error instanceof Error ? error.message : String(error));
    }
  };

  const handleToggleMute = (): void => {
    try {
      player.muted = !player.muted;
      setIsMuted(player.muted);
    } catch (error: unknown) {
      console.warn('[CustomVideoPlayer.handleToggleMute] Error:', error instanceof Error ? error.message : String(error));
    }
  };

  const handleCycleSpeed = (): void => {
    setSpeed((current) => SPEEDS[(SPEEDS.indexOf(current) + 1) % SPEEDS.length]);
  };

  return (
    <View style={{ flex: 1, width: '100%', backgroundColor: '#000000' }}>
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        nativeControls={false}
        contentFit={contentFit}
        surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 44, alignItems: 'center', justifyContent: 'center' }}
        onPress={handleTogglePlay}
        onLongPress={() => {
          heldRef.current = true;
          session.beginHold();
          refresh();
        }}
        onPressOut={() => {
          session.endHold();
          refresh();
        }}
        delayLongPress={300}
        onTouchStart={(event) => {
          heldRef.current = false;
          touchStartRef.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
        }}
        onTouchMove={(event) => {
          if (Math.hypot(event.nativeEvent.pageX - touchStartRef.current.x, event.nativeEvent.pageY - touchStartRef.current.y) > 10) {
            heldRef.current = true;
            session.endHold();
            refresh();
          }
        }}
      >
        {status === 'error' ? (
          <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 24 }}>
            <Ionicons name="alert-circle" size={36} color="#f87171" />
            <Text style={{ color: '#ffffff', textAlign: 'center' }}>{errorMessage}</Text>
            <TouchableOpacity onPress={handleRetry} style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 18, backgroundColor: '#10b981' }}>
              <Text style={{ color: '#ffffff', fontWeight: '800' }}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : status === 'loading' ? (
          <View style={{ ...overlayButton, width: 56, height: 56, borderRadius: 28 }}>
            <ActivityIndicator color="#ffffff" />
          </View>
        ) : !isPlaying && !flashIcon ? (
          <View style={{ ...overlayButton, width: 60, height: 60, borderRadius: 30 }}>
            <Ionicons name="play" size={30} color="#ffffff" style={{ marginLeft: 3 }} />
          </View>
        ) : null}

        {snapshot.holding ? (
          <View style={{ position: 'absolute', top: 14, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0, 0, 0, 0.8)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 }}>
            <Ionicons name="play-forward" size={14} color="#10b981" />
            <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '800' }}>2x Speed</Text>
          </View>
        ) : null}

        {flashIcon ? (
          <Animated.View pointerEvents="none" style={{ position: 'absolute', alignSelf: 'center', ...overlayButton, width: 56, height: 56, borderRadius: 28, opacity: flashOpacity }}>
            <Ionicons name={flashIcon} size={28} color="#ffffff" />
          </Animated.View>
        ) : null}
      </Pressable>

      <View style={{ position: 'absolute', right: 12, bottom: 52, flexDirection: 'row', gap: 8, zIndex: 200 }}>
        {showSpeed ? (
          <TouchableOpacity onPress={handleCycleSpeed} accessibilityRole="button" accessibilityLabel={`Playback speed ${speed}x`} style={{ ...overlayButton, width: 44 }}>
            <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>{speed}x</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={handleToggleMute} accessibilityRole="button" accessibilityLabel={isMuted ? 'Unmute video' : 'Mute video'} style={overlayButton}>
          <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <PlaybackSeekBar session={session} snapshot={snapshot} onChange={refresh} />
    </View>
  );
}
