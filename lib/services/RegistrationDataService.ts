import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { sha256Hex } from '@/lib/helpers/sha256';

export type RegistrationMode = 'open' | 'invite_only' | 'closed';
export type InvitationCheck =
  | { valid: true; email?: string; name?: string }
  | { valid: false; reason: 'invalid' | 'expired' | 'revoked' | 'used' };

const isRegistrationMode = (value: unknown): value is RegistrationMode => value === 'open' || value === 'invite_only' || value === 'closed';
const readString = (value: unknown): string => (typeof value === 'string' ? value : '');
const readMillis = (value: unknown): number | null => {
  if (!value) return null;
  if (typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'object' && 'seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

/**
 * Pre-registration checks read directly from Firestore with the same logic as the website's
 * /api/beta/registration-mode, /api/beta/validate-token and /api/auth/registration-availability routes.
 */
export class RegistrationDataService {
  private static instance: RegistrationDataService;

  private constructor() {}

  public static getInstance(): RegistrationDataService {
    if (!RegistrationDataService.instance) RegistrationDataService.instance = new RegistrationDataService();
    return RegistrationDataService.instance;
  }

  /** siteConfig/general.registrationMode, falling back to invite-only like the website. */
  public async getRegistrationMode(): Promise<RegistrationMode> {
    const config = await getDoc(doc(db, 'siteConfig', 'general')).catch(() => null);
    const mode: unknown = config?.data()?.registrationMode;
    return isRegistrationMode(mode) ? mode : 'invite_only';
  }

  /** Beta invitations are stored by the SHA-256 of their token (web findInvitationByToken + evaluateInvitationPolicy). */
  public async validateInvitation(token: string): Promise<InvitationCheck> {
    if (!token || token.length > 256) return { valid: false, reason: 'invalid' };
    const snapshot = await getDocs(query(collection(db, 'betaInvitations'), where('tokenHash', '==', sha256Hex(token)), limit(1)));
    const invitation = snapshot.docs[0]?.data();
    if (!invitation) return { valid: false, reason: 'invalid' };
    if (invitation.status === 'revoked') return { valid: false, reason: 'revoked' };
    const expiresAt = readMillis(invitation.expiresAt);
    if (expiresAt && expiresAt <= Date.now()) return { valid: false, reason: 'expired' };
    const maximumUses = Math.max(1, Number(invitation.maxUses || 1));
    if (invitation.status === 'registered' || Number(invitation.useCount || 0) >= maximumUses) return { valid: false, reason: 'used' };
    return {
      valid: true,
      ...(readString(invitation.email) ? { email: readString(invitation.email) } : {}),
      ...(readString(invitation.name) ? { name: readString(invitation.name) } : {}),
    };
  }

  public async isEmailAvailable(email: string): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const users = await getDocs(query(collection(db, 'users'), where('email', '==', normalized), limit(1)));
    return users.empty;
  }

  public async isUsernameAvailable(userName: string): Promise<boolean> {
    const users = await getDocs(query(collection(db, 'users'), where('userName', '==', userName.trim()), limit(1)));
    return users.empty;
  }
}

export const registrationDataService = RegistrationDataService.getInstance();
