import { collection, doc, getDocs, query, serverTimestamp, writeBatch, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { PostMediaService } from './PostMediaService';

export type ProfileMediaKind = 'avatar' | 'cover';

export type ProfileMediaUploadResult = {
  imageUrl: string;
  imageDocumentId: string;
};

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
}

export const profileMediaService = ProfileMediaService.getInstance();
