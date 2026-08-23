import { apiService } from './ApiService';
import { collection, doc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';
import { getDefaultMobilePageSettings } from '@/lib/pageAccess/PageRegistry';
import { adminAccessService } from './AdminAccessService';
import type { PageAccessSetting, PageAccessStatus } from '@/lib/types/pageAccess';

type PageAccessResponseItem = {
  id?: unknown;
  pageName?: unknown;
  route?: unknown;
  description?: unknown;
  status?: unknown;
  showInNavigation?: unknown;
  showPagePreview?: unknown;
  overlayTitle?: unknown;
  overlayDescription?: unknown;
  badgeText?: unknown;
  primaryButtonLabel?: unknown;
  primaryButtonRoute?: unknown;
  secondaryButtonLabel?: unknown;
  secondaryButtonRoute?: unknown;
  updatedBy?: unknown;
  order?: unknown;
};

type PageAccessResponse = {
  settings: PageAccessResponseItem[];
};

export type AdminPageAccessAuditEntry = {
  id: string;
  pageId: string;
  pageName: string;
  action: string;
  previousStatus: string;
  newStatus: string;
  administratorName: string;
  createdAtMs: number | null;
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
    try {
      return await this.fetchSettingsFromFirestore();
    } catch (firestoreError: unknown) {
      console.warn('[AdminPageAccessService] Firestore settings unavailable; trying the secure API.', firestoreError);
      const response = await apiService.request<PageAccessResponse>('/api/page-access', { authenticated: true, timeoutMs: 18_000 });
      return this.mergeWithDefaults(response.settings.map((item, index) => this.normalize(item, index)));
    }
  }

  private async fetchSettingsFromFirestore(): Promise<PageAccessSetting[]> {
    await adminAccessService.requireAdmin();
    const snapshot = await getDocs(query(collection(db, 'pageAccessSettings'), orderBy('order', 'asc'))).catch(() => null);
    const compatibleSnapshot = snapshot ?? await getDocs(collection(db, 'pageAccessSettings'));
    return this.mergeWithDefaults(compatibleSnapshot.docs.map((document, index) => this.normalize({ ...document.data(), id: document.id }, index)));
  }

  public async updateSetting(id: string, updates: PageAccessUpdate): Promise<void> {
    try {
      const administrator = await adminAccessService.requireAdmin();
      const batch = writeBatch(db);
      batch.set(doc(db, 'pageAccessSettings', id), { ...updates, updatedAt: serverTimestamp(), updatedBy: administrator.userId }, { merge: true });
      batch.set(doc(collection(db, 'pageAccessAuditLogs')), { pageId: id, pageName: id, action: 'setting_updated', previousStatus: 'unknown', newStatus: updates.status ?? 'unchanged', adminId: administrator.userId, adminName: administrator.userId, createdAt: serverTimestamp() });
      await batch.commit();
    } catch (firestoreError: unknown) {
      console.warn('[AdminPageAccessService] Firestore update unavailable; trying the secure API.', firestoreError);
      await apiService.request('/api/page-access', {
        method: 'PUT',
        authenticated: true,
        body: { id, updates },
        timeoutMs: 18_000,
      });
    }
  }

  public async bulkUpdate(ids: string[], updates: PageAccessUpdate): Promise<void> {
    try {
      const administrator = await adminAccessService.requireAdmin();
      const batch = writeBatch(db);
      ids.forEach((id) => batch.set(doc(db, 'pageAccessSettings', id), { ...updates, updatedAt: serverTimestamp(), updatedBy: administrator.userId }, { merge: true }));
      ids.forEach((id) => batch.set(doc(collection(db, 'pageAccessAuditLogs')), { pageId: id, pageName: id, action: 'bulk_setting_updated', previousStatus: 'unknown', newStatus: updates.status ?? 'unchanged', adminId: administrator.userId, adminName: administrator.userId, createdAt: serverTimestamp() }));
      await batch.commit();
    } catch (firestoreError: unknown) {
      console.warn('[AdminPageAccessService] Firestore bulk update unavailable; trying the secure API.', firestoreError);
      await apiService.request('/api/page-access', {
        method: 'POST',
        authenticated: true,
        body: { action: 'bulk_update', ids, updates },
        timeoutMs: 18_000,
      });
    }
  }

  public async resetDefaults(): Promise<void> {
    try {
      await this.writeDefaults(false);
    } catch (firestoreError: unknown) {
      console.warn('[AdminPageAccessService] Firestore reset unavailable; trying the secure API.', firestoreError);
      await apiService.request('/api/page-access', {
        method: 'POST',
        authenticated: true,
        body: { action: 'reset_defaults' },
        timeoutMs: 18_000,
      });
    }
  }

  public async initializeDefaults(): Promise<void> {
    try {
      await this.writeDefaults(true);
    } catch (firestoreError: unknown) {
      console.warn('[AdminPageAccessService] Firestore initialization unavailable; trying the secure API.', firestoreError);
      await apiService.request('/api/page-access', {
        method: 'POST',
        authenticated: true,
        body: { action: 'initialize' },
        timeoutMs: 18_000,
      });
    }
  }

  public async fetchAuditLogs(maximum = 100): Promise<AdminPageAccessAuditEntry[]> {
    await adminAccessService.requireAdmin();
    const snapshot = await getDocs(query(collection(db, 'pageAccessAuditLogs'), orderBy('createdAt', 'desc'), limit(maximum))).catch(() => null);
    const compatibleSnapshot = snapshot ?? await getDocs(collection(db, 'pageAccessAuditLogs'));
    return compatibleSnapshot.docs.map((document) => {
      const data = document.data();
      const createdAtValue = data.createdAt;
      return {
        id: document.id,
        pageId: typeof data.pageId === 'string' ? data.pageId : '',
        pageName: typeof data.pageName === 'string' ? data.pageName : 'Unknown page',
        action: typeof data.action === 'string' ? data.action : 'updated',
        previousStatus: typeof data.previousStatus === 'string' ? data.previousStatus : 'unknown',
        newStatus: typeof data.newStatus === 'string' ? data.newStatus : 'unknown',
        administratorName: typeof data.adminName === 'string' ? data.adminName : typeof data.updatedBy === 'string' ? data.updatedBy : 'Administrator',
        createdAtMs: createdAtValue && typeof createdAtValue.toMillis === 'function' ? createdAtValue.toMillis() : null,
      };
    }).sort((first, second) => (second.createdAtMs ?? 0) - (first.createdAtMs ?? 0));
  }

  private async writeDefaults(onlyMissing: boolean): Promise<void> {
    const administrator = await adminAccessService.requireAdmin();
    const existing = onlyMissing ? await getDocs(collection(db, 'pageAccessSettings')) : null;
    const existingIds = new Set(existing?.docs.map((document) => document.id) ?? []);
    const batch = writeBatch(db);
    getDefaultMobilePageSettings().forEach((setting) => {
      if (onlyMissing && existingIds.has(setting.id)) return;
      batch.set(doc(db, 'pageAccessSettings', setting.id), {
        pageName: setting.pageName,
        route: setting.route,
        description: setting.description ?? '',
        status: setting.status,
        showInNavigation: setting.showInNavigation,
        showPagePreview: setting.showPagePreview,
        badgeText: setting.badgeText ?? '',
        order: setting.order,
        updatedAt: serverTimestamp(),
        updatedBy: administrator.userId,
      }, { merge: true });
    });
    await batch.commit();
  }

  private normalize(item: PageAccessResponseItem, fallbackOrder: number): PageAccessSetting {
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

  private mergeWithDefaults(storedSettings: PageAccessSetting[]): PageAccessSetting[] {
    const storedById = new Map(storedSettings.map((setting) => [setting.id, setting]));
    const defaults = getDefaultMobilePageSettings();
    const mergedDefaults = defaults.map((setting) => storedById.get(setting.id) ?? setting);
    const customSettings = storedSettings.filter((setting) => !defaults.some((defaultSetting) => defaultSetting.id === setting.id));
    return [...mergedDefaults, ...customSettings].sort((first, second) => first.order - second.order);
  }
}

export const adminPageAccessService = AdminPageAccessService.getInstance();
