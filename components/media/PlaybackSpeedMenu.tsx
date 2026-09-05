import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import type { PlaybackSpeed } from '@/lib/services/PlaybackInteractionService';
type PlaybackSpeedMenuProps = { speed: PlaybackSpeed; onChange: (speed: PlaybackSpeed) => void };
export function PlaybackSpeedMenu({ speed, onChange }: PlaybackSpeedMenuProps) {
  const [open, setOpen] = useState(false);
  const { colors } = useAppTheme();
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Playback speed" onPress={() => setOpen(true)} style={{ position: 'absolute', right: 12, bottom: 48, zIndex: 121, minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0009', borderRadius: 22 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>{speed}×</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityLabel="Close playback speed" onPress={() => setOpen(false)} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0008' }}>
          <View style={{ backgroundColor: colors.surface, padding: 20, borderRadius: 20, width: 240 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 10 }}>Playback speed</Text>
            {([0.5, 1, 1.5, 2] as const).map((rate) => <Pressable key={rate} accessibilityRole="radio" accessibilityState={{ checked: rate === speed }} onPress={() => { onChange(rate); setOpen(false); }} style={{ padding: 14 }}>
              <Text style={{ color: rate === speed ? colors.accent : colors.text }}>{rate}×{rate === 1 ? ' (Normal)' : ''}</Text>
            </Pressable>)}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
