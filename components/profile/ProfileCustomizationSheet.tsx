import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ImageOff, X } from 'lucide-react-native';
import { toast } from 'sonner-native';
import CachedImage from '@/components/ui/CachedImage';
import { useAppTheme } from '@/lib/contexts/ThemeContext';
import { profileMediaService, type ProfileImageItem, type ProfileImageUse } from '@/lib/services/ProfileMediaService';

type ProfileCustomizationSheetProps = {
  visible: boolean;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
};

// Same four uses and wording as the website's Profile Customization.
const IMAGE_USES: { value: ProfileImageUse; label: string; description: string }[] = [
  { value: 'profile', label: 'Profile Picture', description: 'Your main profile picture shown across the platform.' },
  { value: 'coverProfile', label: 'Cover Photo', description: 'Displayed as your profile background banner.' },
  { value: 'jobProfile', label: 'Job Profile Picture', description: 'Represents you in job applications and professional networking.' },
  { value: 'postProfile', label: 'Post Profile Picture', description: 'Appears next to your posts and comments.' },
];

/** Pick one of your uploaded images and choose what it's used for (website: Profile Customization). */
export default function ProfileCustomizationSheet({ visible, userId, onClose, onSaved }: ProfileCustomizationSheetProps) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [images, setImages] = useState<ProfileImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ProfileImageItem | null>(null);
  const [selectedUse, setSelectedUse] = useState<ProfileImageUse | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const tileSize = Math.floor((Math.min(width, 520) - 16 * 2 - 8 * 2) / 3);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    setLoading(true);
    setSelectedImage(null);
    setSelectedUse(null);
    // try/finally rather than Promise.finally (not available on every Hermes promise here).
    const load = async (): Promise<void> => {
      try {
        const items = await profileMediaService.listImages(userId);
        if (!cancelled) setImages(items);
      } catch (error: unknown) {
        console.error('[ProfileCustomizationSheet.load] Error:', error);
        if (!cancelled) toast.error('Your images could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [userId, visible]);

  const handleSave = async (): Promise<void> => {
    if (!selectedImage || !selectedUse || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await profileMediaService.assignExisting(userId, selectedImage, selectedUse);
      toast.success('Profile image assignment updated');
      setSelectedImage(null);
      setSelectedUse(null);
      onSaved();
    } catch (error: unknown) {
      console.error('[ProfileCustomizationSheet.handleSave] Error:', error);
      toast.error('Failed to save image assignment');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { if (!savingRef.current) onClose(); }}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: colors.canvas }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
          <TouchableOpacity onPress={onClose} disabled={saving} accessibilityLabel="Close" style={{ padding: 6 }}><X size={22} color={colors.text} /></TouchableOpacity>
          <Text style={{ flex: 1, textAlign: 'center', color: colors.text, fontSize: 17, fontWeight: '900' }}>Profile Customization</Text>
          <View style={{ width: 34 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}>
          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>Available Images</Text>
          {loading ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 30 }} /> : images.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 30, gap: 8 }}>
              <ImageOff size={34} color={colors.mutedText} />
              <Text style={{ color: colors.mutedText, textAlign: 'center' }}>No uploaded images yet. Upload a profile picture or cover from Edit Profile first.</Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {images.map((image) => {
                const selected = selectedImage?.id === image.id;
                return (
                  <TouchableOpacity key={image.id} onPress={() => setSelectedImage(image)} activeOpacity={0.85} style={{ width: tileSize, height: tileSize, borderRadius: 12, overflow: 'hidden', borderWidth: selected ? 3 : 1, borderColor: selected ? colors.accent : colors.border }}>
                    <CachedImage uri={image.imageUrl} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    {selected ? <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}><Check size={14} color={colors.onAccent} /></View> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>Image Preview & Settings</Text>
          {selectedImage ? (
            <View style={{ gap: 12 }}>
              <CachedImage uri={selectedImage.imageUrl} style={{ width: '100%', height: 180, borderRadius: 16 }} contentFit="cover" />
              {IMAGE_USES.map((use) => {
                const selected = selectedUse === use.value;
                return (
                  <TouchableOpacity key={use.value} onPress={() => setSelectedUse(use.value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.successSurface : colors.surface }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: selected ? colors.accent : colors.border, alignItems: 'center', justifyContent: 'center' }}>{selected ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /> : null}</View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '800' }}>{use.label}</Text>
                      <Text style={{ color: colors.mutedText, fontSize: 12, marginTop: 2 }}>{use.description}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity onPress={() => void handleSave()} disabled={!selectedUse || saving} style={{ minHeight: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: !selectedUse || saving ? 0.6 : 1 }}>
                {saving ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: '900' }}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={{ color: colors.mutedText }}>No image selected. Tap an image above to choose how it&apos;s used.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
