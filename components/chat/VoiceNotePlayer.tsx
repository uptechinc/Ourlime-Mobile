import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

type VoiceNotePlayerProps = {
  audioUrl: string;
  duration: number; // seconds
  isSentByMe: boolean;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceNotePlayer({ audioUrl, duration, isSentByMe }: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0–1

  // NOTE: Full expo-av integration requires installing expo-av.
  // This renders the player UI matching the web design.
  // When expo-av is available, swap in Audio.Sound.

  const handlePlayPause = () => {
    setIsPlaying((prev) => !prev);
    // TODO: integrate expo-av: sound.playAsync() / sound.pauseAsync()
  };

  const primaryColor = isSentByMe ? '#ffffff' : '#10b981';
  const secondaryColor = isSentByMe ? 'rgba(255,255,255,0.6)' : '#94a3b8';
  const barColor = isSentByMe ? 'rgba(255,255,255,0.4)' : '#e2e8f0';
  const barActiveColor = isSentByMe ? '#ffffff' : '#10b981';

  const waveformBars = Array.from({ length: 20 }, (_, i) => {
    const heights = [8, 16, 12, 24, 18, 10, 22, 14, 20, 8, 16, 26, 12, 18, 10, 24, 14, 20, 8, 16];
    return heights[i % heights.length];
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, minWidth: 180 }}>
      {/* Play/Pause Button */}
      <TouchableOpacity
        onPress={handlePlayPause}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isSentByMe ? 'rgba(255,255,255,0.25)' : '#10b981',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon name={isPlaying ? 'pause' : 'play'} size={16} color={isSentByMe ? '#ffffff' : '#ffffff'} />
      </TouchableOpacity>

      {/* Waveform + Duration */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 28, gap: 2 }}>
          {waveformBars.map((h, i) => (
            <View
              key={i}
              style={{
                width: 3,
                height: h,
                borderRadius: 2,
                backgroundColor: progress > 0 && i / waveformBars.length <= progress ? barActiveColor : barColor,
              }}
            />
          ))}
        </View>
        <Text style={{ fontSize: 11, color: secondaryColor, marginTop: 2 }}>
          {formatDuration(duration)}
        </Text>
      </View>

      {/* Mic icon */}
      <Icon name="mic" size={14} color={secondaryColor} />
    </View>
  );
}
