import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import CachedImage from '@/components/ui/CachedImage';

type ProfileImageViewerProps = {
  visible: boolean;
  imageUrl: string | null | undefined;
  label: string;
  onClose: () => void;
};

/** Full-screen profile picture (website ProfileImageViewer). */
export default function ProfileImageViewer({ visible, imageUrl, label, onClose }: ProfileImageViewerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.94)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>
          <Text numberOfLines={1} style={{ flex: 1, color: '#ffffff', fontWeight: '800', fontSize: 15 }}>{label}</Text>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close picture" style={{ padding: 8 }}>
            <X size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          {imageUrl ? (
            <CachedImage uri={imageUrl} contentFit="contain" style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ color: '#cbd5e1' }}>No profile picture yet</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}
