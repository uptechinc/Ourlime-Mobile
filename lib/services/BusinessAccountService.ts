import { auth } from '@/lib/firebaseConfig';
import { eHubService } from './EHubService';
import type { BusinessAccount, BusinessAccountForm } from '@/lib/types/businessAccount';

const DEFAULT_BUSINESS_NAME = 'New Business';

/**
 * The website's business account (/profile/business-account) through the ehubApi function, which runs the same
 * /api/business-account route: the businesses collection is closed to clients, so the app cannot write it directly.
 * An active business account is what Seller Center's eligibility check looks for.
 */
export class BusinessAccountService {
  private static instance: BusinessAccountService;

  private constructor() {}

  public static getInstance(): BusinessAccountService {
    if (!BusinessAccountService.instance) BusinessAccountService.instance = new BusinessAccountService();
    return BusinessAccountService.instance;
  }

  /** null when the member has no business account yet. */
  public getAccount(): Promise<BusinessAccount | null> {
    return eHubService.request<BusinessAccount | null>('GET', '/api/business-account', { allowEmpty: true }).then((account) => account ?? null);
  }

  /** Same request as the website's "Request Business Account" button, with the name the member typed (if any). */
  public async requestAccount(businessName: string): Promise<void> {
    await eHubService.request<null>('POST', '/api/business-account', {
      allowEmpty: true,
      body: {
        businessName: businessName.trim().slice(0, 200) || DEFAULT_BUSINESS_NAME,
        description: '', established: '', location: '',
        contact: { email: auth.currentUser?.email ?? '', phone: '', website: '' },
        categories: [],
      },
    });
    eHubService.clearCaches();
  }

  public async updateAccount(form: BusinessAccountForm): Promise<void> {
    await eHubService.request<null>('PUT', '/api/business-account', {
      allowEmpty: true,
      body: {
        updates: {
          'profile.name': form.name,
          'profile.established': form.established,
          'profile.description': form.description,
          'profile.location': form.location,
          'profile.contact': form.contact,
          categories: form.categories,
        },
      },
    });
    eHubService.clearCaches();
  }

  public toForm(account: BusinessAccount): BusinessAccountForm {
    return { ...account.profile, contact: { ...account.profile.contact }, categories: [...account.categories] };
  }
}

export const businessAccountService = BusinessAccountService.getInstance();
