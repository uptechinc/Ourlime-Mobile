import { doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { sharedDocumentReader } from './SharedDocumentReader';
import { authorizationService } from './AuthorizationService';

export type AdminAccessIdentity = {
  userId: string;
  isAdmin: boolean;
  isModerator: boolean;
};

export class AdminAccessService {
  private static instance: AdminAccessService;

  private constructor() {}

  public static getInstance(): AdminAccessService {
    if (!AdminAccessService.instance) AdminAccessService.instance = new AdminAccessService();
    return AdminAccessService.instance;
  }

  public async checkAdmin(): Promise<boolean> {
    try {
      const identity = await this.resolveIdentity();
      return identity.isAdmin;
    } catch {
      return false;
    }
  }

  public async requireAdmin(): Promise<AdminAccessIdentity> {
    const identity = await this.resolveIdentity();
    if (!identity.isAdmin) throw new Error('Admin access required');
    return identity;
  }

  public async requireReviewer(): Promise<AdminAccessIdentity> {
    const identity = await this.resolveIdentity();
    if (!identity.isAdmin && !identity.isModerator) throw new Error('Moderator access required');
    return identity;
  }

  private async resolveIdentity(): Promise<AdminAccessIdentity> {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.emailVerified) throw new Error('Verified authentication required');
    const snapshot = await sharedDocumentReader.read(doc(db, 'users', currentUser.uid));
    if (!snapshot.exists()) throw new Error('User profile was not found');
    const profile = snapshot.data();
    // Same definition as firestore.rules isAdministrator() / isModeratorOrAdministrator().
    const isAdmin = authorizationService.isAdministratorRecord(profile);
    const isModerator = !isAdmin && authorizationService.isReviewerRecord(profile);
    return {
      userId: currentUser.uid,
      isAdmin,
      isModerator,
    };
  }
}

export const adminAccessService = AdminAccessService.getInstance();
