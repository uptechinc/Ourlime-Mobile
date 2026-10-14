import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { appServerService } from './AppServerService';
import { usernameService } from './UsernameService';

export type RegistrationMode = 'open' | 'invite_only' | 'closed';
export type InvitationCheck =
  | { valid: true; email?: string; name?: string }
  | { valid: false; reason: 'invalid' | 'expired' | 'revoked' | 'used' };

const isRegistrationMode = (value: unknown): value is RegistrationMode => value === 'open' || value === 'invite_only' || value === 'closed';
/**
 * Pre-registration checks with the same logic as the website's /api/beta/registration-mode,
 * /api/beta/validate-token and /api/auth/registration-availability routes. The rules allow no anonymous user or
 * invitation queries, so the email and invitation checks run in the checkRegistration callable.
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

  /** Beta invitation links (stored by the SHA-256 of their token) are checked by the server. */
  public async validateInvitation(token: string): Promise<InvitationCheck> {
    if (!token || token.length > 256) return { valid: false, reason: 'invalid' };
    const result = await appServerService.call<{ invitation?: InvitationCheck }>('checkRegistration', { invitationToken: token });
    return result.invitation ?? { valid: false, reason: 'invalid' };
  }

  public async isEmailAvailable(email: string): Promise<boolean> {
    const result = await appServerService.call<{ emailAvailable?: boolean }>('checkRegistration', { email: email.trim().toLowerCase() });
    return result.emailAvailable === true;
  }

  public async isUsernameAvailable(userName: string): Promise<boolean> {
    return usernameService.isAvailable(userName);
  }
}

export const registrationDataService = RegistrationDataService.getInstance();
