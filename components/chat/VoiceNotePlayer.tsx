import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { toast } from 'sonner-native';
import { voiceNotePlaybackService, type VoiceNotePlaybackState } from '@/lib/services/VoiceNotePlaybackService';
import { chatFileShareService } from '@/lib/services/ChatFileShareService';

type VoiceNotePlayerProps = {
  audioUrl: string;
  /** Stored length in seconds (the player's own duration is used when this is missing). */
  duration: number;
  isSentByMe: boolean;
  /** Unique per bubble; defaults to the URL. */
  playbackId?: string;
  /** Audio file attachments show their name instead of the mic icon. */
  fileName?: string;
};

const BAR_HEIGHTS = [8, 16, 12, 24, 18, 10, 22, 14, 20, 8, 16, 26, 12, 18, 10, 24, 14, 20, 8, 16];

function formatDuration(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const remainder = Math.floor(safe % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

/** Plays a voice note or audio file inside the app (no browser). */
export function VoiceNotePlayer({ audioUrl, duration, isSentByMe, playbackId, fileName }: VoiceNotePlayerProps) {
  const id = playbackId ?? audioUrl;
  const [state, setState] = useState<VoiceNotePlaybackState>(voiceNotePlaybackService.getState());
  const [waveWidth, setWaveWidth] = useState(0);
  useEffect(() => voiceNotePlaybackService.subscribe(setState), []);

  const isActive = state.activeId === id;
  const playing = isActive && state.playing;
  const loading = isActive && state.loading;
  const error = isActive ? state.error : null;
  const total = duration > 0 ? duration : isActive ? state.duration : 0;
  const elapsed = isActive ? state.currentTime : 0;
  const progress = total > 0 ? Math.min(1, elapsed / total) : 0;

  const primary = isSentByMe ? '#ffffff' : '#10b981';
  const secondaryColor = isSentByMe ? 'rgba(255,255,255,0.75)' : '#94a3b8';
  const barColor = isSentByMe ? 'rgba(255,255,255,0.45)' : '#cbd5e1';
  const playedColor = isSentByMe ? '#ffffff' : '#10b981';

  const handleToggle = (): void => {
    void voiceNotePlaybackService.toggle(id, audioUrl);
  };

  const handleSeek = (locationX: number): void => {
    if (!isActive || waveWidth <= 0) return;
    void voiceNotePlaybackService.seek(id, locationX / waveWidth);
  };

  const handleShare = (): void => {
    void chatFileShareService.share(audioUrl, fileName || 'voice-note.m4a').catch((shareError: unknown) => {
      console.error('[VoiceNotePlayer.handleShare] Error:', shareError);
      toast.error('The audio file could not be saved.');
    });
  };

  return (
    <View style={{ paddingVertical: 4, minWidth: 210 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <TouchableOpacity
          onPress={handleToggle}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause audio' : 'Play audio'}
          style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isSentByMe ? 'rgba(255,255,255,0.25)' : '#10b981', alignItems: 'center', justifyContent: 'center' }}
        >
          {loading ? <ActivityIndicator size="small" color="#ffffff" /> : <Icon name={playing ? 'pause' : 'play'} size={16} color="#fff" />}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          {fileName ? <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: isSentByMe ? '#ffffff' : '#0f172a', marginBottom: 2 }}>{fileName}</Text> : null}
          <Pressable
            onLayout={(event: LayoutChangeEvent) => setWaveWidth(event.nativeEvent.layout.width)}
            onPress={(event) => handleSeek(event.nativeEvent.locationX)}
            accessibilityLabel="Seek audio"
            style={{ flexDirection: 'row', alignItems: 'center', height: 28, gap: 2 }}
          >
            {BAR_HEIGHTS.map((height, index) => (
              <View key={index} style={{ width: 3, height, borderRadius: 2, backgroundColor: (index + 0.5) / BAR_HEIGHTS.length <= progress ? playedColor : barColor }} />
            ))}
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={{ fontSize: 11, color: secondaryColor }}>{isActive && (playing || elapsed > 0) ? `${formatDuration(elapsed)} / ${formatDuration(total)}` : formatDuration(total)}</Text>
            {isActive && !error ? (
              <TouchableOpacity onPress={() => voiceNotePlaybackService.cycleRate(id)} hitSlop={8} accessibilityLabel="Change playback speed">
                <Text style={{ fontSize: 11, fontWeight: '800', color: primary }}>{state.rate}x</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
        <Icon name={fileName ? 'music' : 'mic'} size={14} color={secondaryColor} />
      </View>
      {error ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <Text style={{ flex: 1, fontSize: 11, color: isSentByMe ? '#fee2e2' : '#c64d53' }}>{error}</Text>
          <TouchableOpacity onPress={handleShare} hitSlop={6} accessibilityLabel="Save audio file">
            <Text style={{ fontSize: 11, fontWeight: '800', color: primary }}>Save</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
