import { Linking, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

type VoiceNotePlayerProps = { audioUrl: string; duration: number; isSentByMe: boolean };

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export function VoiceNotePlayer({ audioUrl, duration, isSentByMe }: VoiceNotePlayerProps) {
  const secondaryColor = isSentByMe ? 'rgba(255,255,255,0.7)' : '#94a3b8';
  const barColor = isSentByMe ? 'rgba(255,255,255,0.5)' : '#cbd5e1';
  const heights = [8, 16, 12, 24, 18, 10, 22, 14, 20, 8, 16, 26, 12, 18, 10, 24, 14, 20, 8, 16];
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4, minWidth: 180 }}><TouchableOpacity onPress={() => void Linking.openURL(audioUrl)} accessibilityLabel="Play voice note" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isSentByMe ? 'rgba(255,255,255,0.25)' : '#10b981', alignItems: 'center', justifyContent: 'center' }}><Icon name="play" size={16} color="#fff" /></TouchableOpacity><View style={{ flex: 1 }}><View style={{ flexDirection: 'row', alignItems: 'center', height: 28, gap: 2 }}>{heights.map((height, index) => <View key={index} style={{ width: 3, height, borderRadius: 2, backgroundColor: barColor }} />)}</View><Text style={{ marginTop: 2, fontSize: 11, color: secondaryColor }}>{formatDuration(duration)}</Text></View><Icon name="mic" size={14} color={secondaryColor} /></View>;
}
