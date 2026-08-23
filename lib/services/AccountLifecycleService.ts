import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '@/lib/firebaseConfig';
import { apiService } from '@/lib/services/ApiService';
import { AuthService } from '@/lib/services/AuthService';

type DeleteAccountResponse = { success: boolean; error?: string };

export class AccountLifecycleService {
  private static instance: AccountLifecycleService;
  private readonly authService = AuthService.getInstance();
  private constructor() {}
  public static getInstance(): AccountLifecycleService { if (!AccountLifecycleService.instance) AccountLifecycleService.instance = new AccountLifecycleService(); return AccountLifecycleService.instance; }

  public async permanentlyDeleteCurrentAccount(password: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('You must be signed in to delete your account.');
    const usesPassword = user.providerData.some((provider) => provider.providerId === 'password');
    if (usesPassword) {
      if (!user.email || !password) throw new Error('Enter your current password to continue.');
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    }
    const response = await apiService.request<DeleteAccountResponse>('/api/profile/delete-account', { method: 'POST', authenticated: true, body: { userId: user.uid }, timeoutMs: 120_000 });
    if (!response.success) throw new Error(response.error || 'Your account could not be deleted.');
    await this.authService.logout().catch(() => undefined);
  }
}

export const accountLifecycleService = AccountLifecycleService.getInstance();
