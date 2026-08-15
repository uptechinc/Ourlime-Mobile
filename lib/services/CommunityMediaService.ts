import type { ImagePickerAsset } from 'expo-image-picker';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { auth, storage } from '@/lib/firebaseConfig';

export type CommunityBannerUploadResult = {
  downloadUrl: string;
  storagePath: string;
};

export class CommunityMediaService {
  private static instance: CommunityMediaService;

  private constructor() {}

  public static getInstance(): CommunityMediaService {
    if (!CommunityMediaService.instance) CommunityMediaService.instance = new CommunityMediaService();
    return CommunityMediaService.instance;
  }

  public async uploadBanner(asset: ImagePickerAsset, onProgress: (progress: number) => void): Promise<CommunityBannerUploadResult> {
    return this.uploadAsset(asset, 'communityBanners', onProgress);
  }

  public async uploadEventMedia(asset: ImagePickerAsset, onProgress: (progress: number) => void): Promise<CommunityBannerUploadResult> {
    return this.uploadAsset(asset, 'communityEvents', onProgress);
  }

  private async uploadAsset(asset: ImagePickerAsset, folder: 'communityBanners' | 'communityEvents', onProgress: (progress: number) => void): Promise<CommunityBannerUploadResult> {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('Sign in to upload a community banner.');
    if (!asset.uri) throw new Error('The selected banner could not be read.');
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    const extension = asset.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
    const storagePath = `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`;
    const upload = uploadBytesResumable(ref(storage, storagePath), blob, { contentType: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg') });
    await new Promise<void>((resolve, reject) => {
      upload.on('state_changed', (snapshot) => onProgress(snapshot.totalBytes > 0 ? snapshot.bytesTransferred / snapshot.totalBytes : 0), reject, resolve);
    });
    return { downloadUrl: await getDownloadURL(upload.snapshot.ref), storagePath };
  }
}

export const communityMediaService = CommunityMediaService.getInstance();
