import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { voiceNotePlaybackService } from '@/lib/services/VoiceNotePlaybackService';
import { MAX_VOICE_NOTE_SECONDS, MIN_VOICE_NOTE_SECONDS } from '@/lib/messaging/ChatAttachmentPolicy';

type VoiceNoteRecorderProps = {
  onCancel: () => void;
  /** Called with the recorded .m4a file and its length in seconds. */
  onSend: (uri: string, durationSeconds: number) => void;
  /** Shown when recording can't start (permission denied, mic busy) or the clip is too short. */
  onError: (message: string) => void;
};

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

const restoreAudioMode = (): Promise<void> => setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch((error: unknown) => {
  console.warn('[VoiceNoteRecorder.restoreAudioMode] Error:', error instanceof Error ? error.message : String(error));
});

/** WhatsApp-style recording bar: starts recording when shown, with Cancel and Send. Records AAC (.m4a). */
export default function VoiceNoteRecorder({ onCancel, onSend, onError }: VoiceNoteRecorderProps) {
  const { colors } = useAppTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [starting, setStarting] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const finishedRef = useRef(false);
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const elapsedSeconds = recorderState.durationMillis / 1000;

  // Callbacks are read from a ref so the start effect only runs once.
  const callbacksRef = useRef({ onCancel, onSend, onError });
  callbacksRef.current = { onCancel, onSend, onError };

  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.25, { duration: 700 }), -1, true);
    let cancelled = false;
    const start = async (): Promise<void> => {
      try {
        voiceNotePlaybackService.stop();
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          callbacksRef.current.onError('Allow microphone access in your phone settings to record voice notes.');
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        if (cancelled) return;
        recorder.record();
      } catch (error: unknown) {
        console.error('[VoiceNoteRecorder.start] Error:', error);
        callbacksRef.current.onError('Recording could not start. Another app may be using the microphone.');
      } finally {
        if (!cancelled) setStarting(false);
      }
    };
    void start();
    return () => {
      cancelled = true;
      if (!finishedRef.current) {
        finishedRef.current = true;
        void recorder.stop().catch(() => undefined).finally(() => void restoreAudioMode());
      }
    };
    // recorder is stable for the component's lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async (send: boolean): Promise<void> => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinishing(true);
    const seconds = recorder.getStatus().durationMillis / 1000;
    try {
      await recorder.stop();
    } catch (error: unknown) {
      console.warn('[VoiceNoteRecorder.finish] Error:', error instanceof Error ? error.message : String(error));
    }
    await restoreAudioMode();
    if (!send) { callbacksRef.current.onCancel(); return; }
    const uri = recorder.uri;
    if (!uri || seconds < MIN_VOICE_NOTE_SECONDS) {
      callbacksRef.current.onError('Voice note is too short. Hold on a little longer.');
      return;
    }
    callbacksRef.current.onSend(uri, Math.min(seconds, MAX_VOICE_NOTE_SECONDS));
  };

  // Auto-send at the 5-minute limit.
  useEffect(() => {
    if (recorderState.isRecording && elapsedSeconds >= MAX_VOICE_NOTE_SECONDS) void finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsedSeconds, recorderState.isRecording]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 24, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.border }}>
      <TouchableOpacity onPress={() => void finish(false)} disabled={finishing} accessibilityLabel="Cancel voice note" style={{ padding: 8 }}>
        <Icon name="trash-2" size={20} color="#c64d53" />
      </TouchableOpacity>
      <Animated.View style={[{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' }, pulseStyle]} />
      <Text style={{ flex: 1, color: colors.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
        {starting ? 'Starting…' : `${formatClock(elapsedSeconds)}  ·  Recording`}
      </Text>
      <Text style={{ color: colors.mutedText, fontSize: 11 }}>max {formatClock(MAX_VOICE_NOTE_SECONDS)}</Text>
      <TouchableOpacity
        onPress={() => void finish(true)}
        disabled={finishing || starting}
        accessibilityLabel="Send voice note"
        style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', opacity: starting ? 0.6 : 1 }}
      >
        {finishing ? <ActivityIndicator size="small" color="#ffffff" /> : <Icon name="send" size={18} color="#ffffff" />}
      </TouchableOpacity>
    </View>
  );
}
