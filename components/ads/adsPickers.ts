import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { AdsPickedFile } from '@/lib/types/adsMarketplace';

/** Picks images or videos from the library (several at once when multiple is true); empty when cancelled. */
export async function pickAdsMedia(kind: 'images' | 'videos', multiple: boolean): Promise<AdsPickedFile[]> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: [kind], allowsMultipleSelection: multiple, quality: 0.9 });
  if (result.canceled) return [];
  return result.assets.map((asset, index): AdsPickedFile => ({
    uri: asset.uri,
    name: asset.fileName || `${kind === 'images' ? 'image' : 'video'}_${index + 1}.${kind === 'images' ? 'jpg' : 'mp4'}`,
    mimeType: asset.mimeType || (kind === 'images' ? 'image/jpeg' : 'video/mp4'),
    size: asset.fileSize,
  }));
}

const DOCUMENT_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

/** Picks one or more files; withImages also allows JPG/PNG (verification documents accept PDF, JPG or PNG). */
export async function pickAdsDocuments(withImages: boolean, multiple: boolean): Promise<AdsPickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: withImages ? [...DOCUMENT_TYPES, 'image/jpeg', 'image/png'] : DOCUMENT_TYPES,
    multiple,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset): AdsPickedFile => ({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size }));
}
