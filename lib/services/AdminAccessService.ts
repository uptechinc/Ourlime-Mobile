import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';

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
    const snapshot = await getDoc(doc(db, 'users', currentUser.uid));
    if (!snapshot.exists()) throw new Error('User profile was not found');
    const profile = snapshot.data();
    const role = (typeof profile.role === 'string' ? profile.role : typeof profile.accountType === 'string' ? profile.accountType : typeof profile.userType === 'string' ? profile.userType : 'user').toLowerCase().replace('-', '_');
    const isAdmin = profile.isAdmin === true || profile.isSuperAdmin === true || profile.isDeveloper === true || role === 'admin' || role === 'super_admin' || role === 'developer' || role === 'dev';
    return {
      userId: currentUser.uid,
      isAdmin,
      isModerator: role === 'moderator',
    };
  }
}

export const adminAccessService = AdminAccessService.getInstance();
