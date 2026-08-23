import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { PostMediaService, type CropPreset, type PendingImageCrop } from '@/lib/services/PostMediaService';
import type { PostMediaDraft } from '@/lib/services/PostService';
import SwipeDismissSurface from '@/components/ui/SwipeDismissSurface';

type MediaCropModalProps = {
  pending: PendingImageCrop;
  queueLength: number;
  onCancel: () => void;
  onComplete: (media: PostMediaDraft) => void;
};

const mediaService = PostMediaService.getInstance();
const presets: { value: CropPreset; label: string }[] = [
  { value: 'fit', label: 'Fit' },
  { value: 'portrait', label: '4:5' },
  { value: 'square', label: '1:1' },
  { value: 'landscape', label: '1.91:1' },
];

export default function MediaCropModal({ pending, queueLength, onCancel, onComplete }: MediaCropModalProps) {
  const [preset, setPreset] = useState<CropPreset>('fit');
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);

  const getAspectRatio = (p: CropPreset) => {
    if (p === 'square') return 1;
    if (p === 'portrait') return 4 / 5;
    if (p === 'landscape') return 1.91;
    const w = pending.asset.width || 1;
    const h = pending.asset.height || 1;
    return w / h;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cropped = await mediaService.cropImage(pending, preset, zoom);
      onComplete(cropped);
    } catch (error) {
      console.error('[MediaCropModal] Error cropping image:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent presentationStyle="overFullScreen" animationType="none" onRequestClose={onCancel}>
      <SwipeDismissSurface visible onDismiss={onCancel} handleColor="#475569" disabled={saving} accessibilityLabel="Swipe down to close media crop" style={{ flex: 1, backgroundColor: '#111827' }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#111827' }} edges={['top', 'left', 'right']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16 }}>
          <TouchableOpacity onPress={onCancel} disabled={saving} style={{ padding: 8 }}>
            <Icon name="x" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={{ flex: 1, color: '#ffffff', textAlign: 'center', fontSize: 18, fontWeight: '700' }}>
            Crop photo {queueLength > 1 ? `(${queueLength} left)` : ''}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', margin: 16 }}>
          <View style={{
            width: '100%',
            aspectRatio: getAspectRatio(preset),
            maxHeight: '85%',
            overflow: 'hidden',
            borderRadius: 18,
            backgroundColor: '#000000',
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#10b981',
          }}>
            <Image
              source={{ uri: pending.asset.uri }}
              resizeMode={preset === 'fit' ? 'contain' : 'cover'}
              style={{ width: '100%', height: '100%', transform: [{ scale: zoom }] }}
            />
          </View>
        </View>

        <View style={{ paddingHorizontal: 18, paddingBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 16 }}>
            {presets.map((item) => (
              <TouchableOpacity
                key={item.value}
                onPress={() => setPreset(item.value)}
                style={{
                  marginHorizontal: 4,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  borderRadius: 18,
                  backgroundColor: preset === item.value ? '#10b981' : '#374151',
                }}
              >
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <TouchableOpacity onPress={() => setZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))} style={{ padding: 12 }}>
              <Icon name="minus-circle" size={28} color="#ffffff" />
            </TouchableOpacity>
            <Text style={{ minWidth: 100, textAlign: 'center', color: '#ffffff', fontWeight: '700' }}>Zoom {zoom.toFixed(2)}x</Text>
            <TouchableOpacity onPress={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))} style={{ padding: 12 }}>
              <Icon name="plus-circle" size={28} color="#ffffff" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={() => void handleSave()} disabled={saving} style={{ height: 50, borderRadius: 15, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' }}>
            {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontWeight: '800' }}>{queueLength > 1 ? 'Use photo and crop next' : 'Use photo'}</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      </SwipeDismissSurface>
    </Modal>
  );
}
