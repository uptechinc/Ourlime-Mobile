import { apiService } from './ApiService';
import type { PageAccessSetting, PageAccessStatus } from '@/lib/types/pageAccess';

type PageAccessResponse = {
  settings: Array<Record<string, unknown>>;
};

export type PageAccessUpdate = {
  status?: PageAccessStatus;
  showInNavigation?: boolean;
  showPagePreview?: boolean;
  overlayTitle?: string;
  overlayDescription?: string;
  badgeText?: string;
  primaryButtonLabel?: string;
  primaryButtonRoute?: string;
  secondaryButtonLabel?: string;
  secondaryButtonRoute?: string;
};

export class AdminPageAccessService {
  private static instance: AdminPageAccessService;

  private constructor() {}

  public static getInstance(): AdminPageAccessService {
    if (!AdminPageAccessService.instance) AdminPageAccessService.instance = new AdminPageAccessService();
    return AdminPageAccessService.instance;
  }

  public async fetchSettings(): Promise<PageAccessSetting[]> {
    const response = await apiService.request<PageAccessResponse>('/api/page-access', { authenticated: true });
    return response.settings.map((item, index) => this.normalize(item, index));
  }

  public async updateSetting(id: string, updates: PageAccessUpdate): Promise<void> {
    await apiService.request('/api/page-access', {
      method: 'PUT',
      authenticated: true,
      body: { id, updates },
    });
  }

  public async bulkUpdate(ids: string[], updates: PageAccessUpdate): Promise<void> {
    await apiService.request('/api/page-access', {
      method: 'POST',
      authenticated: true,
      body: { action: 'bulk_update', ids, updates },
    });
  }

  public async resetDefaults(): Promise<void> {
    await apiService.request('/api/page-access', {
      method: 'POST',
      authenticated: true,
      body: { action: 'reset_defaults' },
    });
  }

  public async initializeDefaults(): Promise<void> {
    await apiService.request('/api/page-access', {
      method: 'POST',
      authenticated: true,
      body: { action: 'initialize' },
    });
  }

  private normalize(item: Record<string, unknown>, fallbackOrder: number): PageAccessSetting {
    const validStatuses: PageAccessStatus[] = ['enabled', 'coming_soon', 'maintenance', 'beta_only', 'developer_only', 'admin_only', 'disabled'];
    const status = typeof item.status === 'string' && validStatuses.includes(item.status as PageAccessStatus)
      ? item.status as PageAccessStatus
      : 'enabled';
    return {
      id: typeof item.id === 'string' ? item.id : `setting-${fallbackOrder}`,
      pageName: typeof item.pageName === 'string' ? item.pageName : 'Unnamed Page',
      route: typeof item.route === 'string' ? item.route : '/',
      description: typeof item.description === 'string' ? item.description : undefined,
      status,
      showInNavigation: item.showInNavigation !== false,
      showPagePreview: item.showPagePreview !== false,
      overlayTitle: typeof item.overlayTitle === 'string' ? item.overlayTitle : undefined,
      overlayDescription: typeof item.overlayDescription === 'string' ? item.overlayDescription : undefined,
      badgeText: typeof item.badgeText === 'string' ? item.badgeText : undefined,
      primaryButtonLabel: typeof item.primaryButtonLabel === 'string' ? item.primaryButtonLabel : undefined,
      primaryButtonRoute: typeof item.primaryButtonRoute === 'string' ? item.primaryButtonRoute : undefined,
      secondaryButtonLabel: typeof item.secondaryButtonLabel === 'string' ? item.secondaryButtonLabel : undefined,
      secondaryButtonRoute: typeof item.secondaryButtonRoute === 'string' ? item.secondaryButtonRoute : undefined,
      updatedAt: null,
      updatedBy: typeof item.updatedBy === 'string' ? item.updatedBy : undefined,
      order: typeof item.order === 'number' ? item.order : fallbackOrder,
    };
  }
}

export const adminPageAccessService = AdminPageAccessService.getInstance();
