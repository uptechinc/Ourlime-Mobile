import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Film, ImagePlus, Star, X } from 'lucide-react-native';
import { LISTING_MAX_GALLERY_IMAGES, LISTING_MAX_GALLERY_VIDEOS, LISTING_MAX_VIDEO_BYTES, listingMediaIsVideo } from '@/lib/services/MarketListingFormService';
import type { MarketListingEditor } from '@/lib/hooks/useMarketListingEditor';
import type { ListingImage, ListingPickedMedia } from '@/lib/types/marketListing';
import { ListingSection, useListingStyles } from '../ListingFormParts';

const imageUri = (image: ListingImage): string => image.kind === 'remote' ? image.url : image.uri;

/**
 * Website MediaUpload (and BasicInfo's cover): a required cover photo and 1–10 gallery photos or videos. Media stays on the
 * device until Submit; photos are then converted to JPEG (≤ 2048 px, ≤ 10 MB) and videos upload as they are (MP4, MOV or
 * WebM, at most three, each ≤ 50 MB).
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
    videoTile: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 4 },
    error: { color: colors.destructiveText, fontSize: 12, fontWeight: '700' },
  }), [colors]);
  const { form, setCover, addGalleryMedia, removeGalleryImage } = editor;
  const [pickError, setPickError] = useState<string | null>(null);
  const remaining = LISTING_MAX_GALLERY_IMAGES - form.gallery.length;
  const videoCount = form.gallery.filter((image) => listingMediaIsVideo(image)).length;

  const pick = async (multiple: boolean): Promise<ListingPickedMedia[]> => {
    setPickError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setPickError('Allow photo access to choose listing photos and videos.'); return []; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: multiple ? ['images', 'videos'] : ['images'], allowsMultipleSelection: multiple, selectionLimit: multiple ? Math.max(1, remaining) : 1, quality: 1 });
    return result.canceled ? [] : result.assets.map((asset) => ({ uri: asset.uri, mediaType: asset.type === 'video' ? 'video' : 'image', mimeType: asset.mimeType ?? null, fileSize: asset.fileSize ?? null }));
  };

  const handleCover = async () => {
    const [media] = await pick(false);
    if (media) setCover(media.uri);
  };
  /** Website MediaUpload accepts photos and videos together (10 in total); the server allows three videos of up to 50 MB. */
  const handleGallery = async () => {
    if (remaining <= 0) { setPickError(`You can only upload up to ${LISTING_MAX_GALLERY_IMAGES} images/videos in total.`); return; }
    const picked = await pick(true);
    const notes: string[] = [];
    let videosLeft = LISTING_MAX_GALLERY_VIDEOS - videoCount;
    const accepted = picked.filter((media) => {
      if (media.mediaType !== 'video') return true;
      if (media.fileSize !== null && media.fileSize > LISTING_MAX_VIDEO_BYTES) { notes.push('Videos must be 50 MB or smaller.'); return false; }
      if (videosLeft <= 0) { notes.push(`A listing can have at most ${LISTING_MAX_GALLERY_VIDEOS} videos.`); return false; }
      videosLeft -= 1;
      return true;
    });
    if (accepted.length > remaining) notes.push(`Only the first ${remaining} items were added (${LISTING_MAX_GALLERY_IMAGES} maximum).`);
    if (notes.length) setPickError([...new Set(notes)].join(' '));
    if (accepted.length) addGalleryMedia(accepted);
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
    <ListingSection title={`Gallery (${form.gallery.length}/${LISTING_MAX_GALLERY_IMAGES})`} description={`Add at least one more photo or video: other angles, details and any defects. Up to ${LISTING_MAX_GALLERY_VIDEOS} MP4, MOV or WebM videos of 50 MB or less.`}>
      <View style={local.grid}>
        {form.gallery.map((image, index) => <View key={image.key} style={local.tile}>
          {listingMediaIsVideo(image) ? <View accessibilityLabel={`Gallery video ${index + 1}`} style={local.videoTile}><Film size={24} color={colors.mutedText} /><Text style={styles.hint}>Video</Text></View>
            : <Image source={{ uri: imageUri(image) }} resizeMode="cover" style={local.coverImage} accessibilityLabel={`Gallery photo ${index + 1}`} />}
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove gallery ${listingMediaIsVideo(image) ? 'video' : 'photo'} ${index + 1}`} hitSlop={6} onPress={() => removeGalleryImage(image.key)} style={local.remove}><X size={16} color="#ffffff" /></Pressable>
        </View>)}
        {remaining > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Add gallery photos or videos" onPress={() => void handleGallery()} style={[local.tile, local.addTile]}>
          <ImagePlus size={24} color={colors.mutedText} />
          <Text style={styles.hint}>Add media</Text>
        </Pressable> : null}
      </View>
      {pickError ? <Text accessibilityRole="alert" style={local.error}>{pickError}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Star size={13} color={colors.mutedText} /><Text style={styles.hint}>Photos and videos upload when you submit the listing.</Text></View>
    </ListingSection>
  </View>;
}
