import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';

export const POST_VERIFICATION_REQUIRED_MESSAGE = 'You must verify your account before you can create a post.';

type PostCreatorVerification = {
  uid?: string | null;
  id?: string | null;
  identityVerificationStatus?: unknown;
  verificationStatus?: unknown;
};

export class PostAuthorizationService {
  private static instance: PostAuthorizationService;

  private constructor() {}

  public static getInstance(): PostAuthorizationService {
    if (!PostAuthorizationService.instance) {
      PostAuthorizationService.instance = new PostAuthorizationService();
    }
    return PostAuthorizationService.instance;
  }

  public canCreatePost(user: PostCreatorVerification | null | undefined): boolean {
    return Boolean(user?.uid || user?.id) && this.isIdentityVerified(user);
  }

  public isIdentityVerified(user: PostCreatorVerification | null | undefined): boolean {
    return (
      user?.identityVerificationStatus === 'verified'
      || user?.verificationStatus === 'verified'
    );
  }

  public async requireVerifiedUser(userId: string): Promise<void> {
    if (!auth.currentUser || auth.currentUser.uid !== userId) {
      throw new Error('Please sign in again before posting.');
    }

    const userSnapshot = await getDoc(doc(db, 'users', userId));
    if (!userSnapshot.exists() || !this.canCreatePost({ uid: userId, ...userSnapshot.data() })) {
      throw new Error(POST_VERIFICATION_REQUIRED_MESSAGE);
    }
  }
}

export const postAuthorizationService = PostAuthorizationService.getInstance();
