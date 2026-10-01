import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { appServerService } from '@/lib/services/AppServerService';
import { AuthService } from '@/lib/services/AuthService';

/** Permanent account deletion through the app's own deleteMyAccount function. */
export class AccountLifecycleService {
  private static instance: AccountLifecycleService;
  private readonly authService = AuthService.getInstance();

  private constructor() {}

  public static getInstance(): AccountLifecycleService {
    if (!AccountLifecycleService.instance) AccountLifecycleService.instance = new AccountLifecycleService();
    return AccountLifecycleService.instance;
  }

  public async permanentlyDeleteCurrentAccount(password: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('You must be signed in to delete your account.');
    if (!user.email || !password) throw new Error('Enter your current password to continue.');
    // The server only deletes accounts signed in within the last five minutes.
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    await appServerService.call('deleteMyAccount', {}, 300_000);
    await this.authService.logout().catch(() => undefined);
  }
}

export const accountLifecycleService = AccountLifecycleService.getInstance();
