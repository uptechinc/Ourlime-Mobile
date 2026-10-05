import { collection, doc, getDocs, query, serverTimestamp, writeBatch, where } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { ensureMediaUrl } from '@/lib/helpers/mediaUrl';
import { PostMediaService } from './PostMediaService';

export type ProfileMediaKind = 'avatar' | 'cover';

export type ProfileMediaUploadResult = {
  imageUrl: string;
  imageDocumentId: string;
};

/** How an uploaded image is used (same values as the website's Profile Customization). */
export type ProfileImageUse = 'profile' | 'coverProfile' | 'jobProfile' | 'postProfile';

export type ProfileImageItem = { id: string; imageUrl: string; typeOfImage: string; createdAtMs: number };

export class ProfileMediaService {
  private static instance: ProfileMediaService;
  private readonly mediaService = PostMediaService.getInstance();

  private constructor() {}

  public static getInstance(): ProfileMediaService {
    if (!ProfileMediaService.instance) ProfileMediaService.instance = new ProfileMediaService();
    return ProfileMediaService.instance;
  }

  public async uploadAndAssign(userId: string, localUri: string, kind: ProfileMediaKind): Promise<ProfileMediaUploadResult> {
    if (!userId.trim()) throw new Error('A signed-in profile is required.');
    if (!localUri.trim()) throw new Error('Choose an image before uploading.');

    const imageUrl = kind === 'avatar'
      ? await this.mediaService.uploadProfileImage({ userId, uri: localUri })
      : await this.mediaService.uploadProfileCover({ userId, uri: localUri });
    const imageReference = doc(collection(db, 'profileImages'));
    const assignmentKinds = kind === 'avatar' ? ['profile', 'postProfile'] as const : ['coverProfile'] as const;
    const assignmentSnapshots = await Promise.all(assignmentKinds.map((setAs) => getDocs(query(
      collection(db, 'profileImageSetAs'),
      where('userId', '==', userId),
      where('setAs', '==', setAs),
    ))));
    const batch = writeBatch(db);

    batch.set(imageReference, {
      userId,
      imageURL: imageUrl,
      imageUrl,
      typeOfImage: kind === 'avatar' ? 'profile' : 'coverProfile',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    assignmentKinds.forEach((setAs, index) => {
      const assignmentValue = kind === 'avatar'
        ? imageReference.id
        : [{ id: imageReference.id, displayorder: 1 }];
      const assignmentSnapshot = assignmentSnapshots[index];
      if (!assignmentSnapshot) return;
      const existingAssignments = assignmentSnapshot.docs;
      if (existingAssignments.length) {
        existingAssignments.forEach((assignment) => batch.set(assignment.ref, {
          userId,
          setAs,
          profileImageId: assignmentValue,
          gradient: null,
          updatedAt: serverTimestamp(),
        }, { merge: true }));
      } else {
        batch.set(doc(collection(db, 'profileImageSetAs')), {
          userId,
          setAs,
          profileImageId: assignmentValue,
          gradient: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
    return { imageUrl, imageDocumentId: imageReference.id };
  }

  /** Every image the user has uploaded (profileImages), newest first. */
  public async listImages(userId: string): Promise<ProfileImageItem[]> {
    const snapshot = await getDocs(query(collection(db, 'profileImages'), where('userId', '==', userId)));
    return snapshot.docs.flatMap((document): ProfileImageItem[] => {
      const data = document.data();
      const imageUrl = ensureMediaUrl(typeof data.imageURL === 'string' ? data.imageURL : typeof data.imageUrl === 'string' ? data.imageUrl : '');
      if (!imageUrl) return [];
      const created = data.createdAt as Timestamp | Date | undefined;
      const createdAtMs = created instanceof Date ? created.getTime() : typeof created?.toMillis === 'function' ? created.toMillis() : 0;
      return [{ id: document.id, imageUrl, typeOfImage: typeof data.typeOfImage === 'string' ? data.typeOfImage : '', createdAtMs }];
    }).sort((first, second) => second.createdAtMs - first.createdAtMs);
  }

  /**
   * Uses an already-uploaded image for one purpose, like the website's Profile Customization. Covers keep the
   * ordered-list format the cover gallery uses; the others store the plain image id.
   */
  public async assignExisting(userId: string, image: ProfileImageItem, use: ProfileImageUse): Promise<void> {
    const imageId = image.id;
    const assignments = await getDocs(query(collection(db, 'profileImageSetAs'), where('userId', '==', userId), where('setAs', '==', use)));
    const profileImageId = use === 'coverProfile' ? [{ id: imageId, displayorder: 1 }] : imageId;
    const batch = writeBatch(db);
    if (assignments.empty) {
      batch.set(doc(collection(db, 'profileImageSetAs')), { userId, setAs: use, profileImageId, gradient: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } else {
      assignments.docs.forEach((assignment) => batch.set(assignment.ref, { userId, setAs: use, profileImageId, gradient: null, updatedAt: serverTimestamp() }, { merge: true }));
    }
    // Keep the user doc's quick-read fields in step (same as uploading a new picture or cover).
    if (use === 'profile') batch.set(doc(db, 'users', userId), { profilePicture: image.imageUrl, updatedAt: serverTimestamp() }, { merge: true });
    if (use === 'coverProfile') batch.set(doc(db, 'users', userId), { coverPhoto: image.imageUrl, updatedAt: serverTimestamp() }, { merge: true });
    await batch.commit();
  }
}

export const profileMediaService = ProfileMediaService.getInstance();
