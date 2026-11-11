import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Star, X } from 'lucide-react-native';
import { LISTING_MAX_GALLERY_IMAGES } from '@/lib/services/MarketListingFormService';
import type { MarketListingEditor } from '@/lib/hooks/useMarketListingEditor';
import type { ListingImage } from '@/lib/types/marketListing';
import { ListingSection, useListingStyles } from '../ListingFormParts';

const imageUri = (image: ListingImage): string => image.kind === 'remote' ? image.url : image.uri;

/**
 * Website MediaUpload (and BasicInfo's cover): a required cover photo and 1–10 gallery photos. Photos stay on the
 * device until Submit, then are converted to JPEG (≤ 2048 px, ≤ 10 MB) and uploaded.
 */
export default function ListingMediaStep({ editor }: { editor: MarketListingEditor }) {
  const { colors, styles } = useListingStyles();
  const local = useMemo(() => StyleSheet.create({
    cover: { height: 220, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.control },
    coverImage: { width: '100%', height: '100%' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: { width: '30%', aspectRatio: 1, flexGrow: 0, overflow: 'hidden', borderRadius: 14, backgroundColor: colors.control },
    addTile: { alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border },
    remove: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(15,23,42,0.65)' },
    label: { color: colors.text, fontSize: 13, fontWeight: '800' },
    error: { color: colors.destructiveText, fontSize: 12, fontWeight: '700' },
  }), [colors]);
  const { form, setCover, addGalleryImages, removeGalleryImage } = editor;
  const [pickError, setPickError] = useState<string | null>(null);
  const remaining = LISTING_MAX_GALLERY_IMAGES - form.gallery.length;

  const pick = async (multiple: boolean): Promise<string[]> => {
    setPickError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setPickError('Allow photo access to choose listing photos.'); return []; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: multiple, selectionLimit: multiple ? Math.max(1, remaining) : 1, quality: 1 });
    return result.canceled ? [] : result.assets.map((asset) => asset.uri);
  };

  const handleCover = async () => {
    const [uri] = await pick(false);
    if (uri) setCover(uri);
  };
  const handleGallery = async () => {
    if (remaining <= 0) { setPickError(`You can only upload up to ${LISTING_MAX_GALLERY_IMAGES} images in total.`); return; }
    const uris = await pick(true);
    if (uris.length > remaining) setPickError(`Only the first ${remaining} photos were added (${LISTING_MAX_GALLERY_IMAGES} maximum).`);
    if (uris.length) addGalleryImages(uris);
  };

  return <View style={{ gap: 16 }}>
    <ListingSection title="Cover image" description="Required. The main photo buyers see on product cards. JPEG, PNG or WebP up to 10 MB.">
      <Pressable accessibilityRole="button" accessibilityLabel={form.cover ? 'Change cover image' : 'Choose cover image'} onPress={() => void handleCover()} style={local.cover}>
        {form.cover ? <Image source={{ uri: imageUri(form.cover) }} resizeMode="cover" style={local.coverImage} /> : <>
          <ImagePlus size={32} color={colors.mutedText} />
          <Text style={local.label}>Choose a cover photo</Text>
          <Text style={styles.hint}>Use a photo of the actual item</Text>
        </>}
      </Pressable>
      {form.cover ? <Text style={styles.hint}>Tap the photo to replace it.</Text> : null}
    </ListingSection>
    <ListingSection title={`Gallery (${form.gallery.length}/${LISTING_MAX_GALLERY_IMAGES})`} description="Add at least one more photo: other angles, details and any defects.">
      <View style={local.grid}>
        {form.gallery.map((image, index) => <View key={image.key} style={local.tile}>
          <Image source={{ uri: imageUri(image) }} resizeMode="cover" style={local.coverImage} accessibilityLabel={`Gallery photo ${index + 1}`} />
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove gallery photo ${index + 1}`} hitSlop={6} onPress={() => removeGalleryImage(image.key)} style={local.remove}><X size={16} color="#ffffff" /></Pressable>
        </View>)}
        {remaining > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Add gallery photos" onPress={() => void handleGallery()} style={[local.tile, local.addTile]}>
          <ImagePlus size={24} color={colors.mutedText} />
          <Text style={styles.hint}>Add photos</Text>
        </Pressable> : null}
      </View>
      {pickError ? <Text accessibilityRole="alert" style={local.error}>{pickError}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Star size={13} color={colors.mutedText} /><Text style={styles.hint}>Photos upload when you submit the listing.</Text></View>
    </ListingSection>
  </View>;
}
