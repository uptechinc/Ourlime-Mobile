import type { Timestamp } from 'firebase/firestore';

export type PageAccessStatus =
  | 'enabled'
  | 'coming_soon'
  | 'maintenance'
  | 'beta_only'
  | 'developer_only'
  | 'admin_only'
  | 'disabled';

export type PageAccessSetting = {
  id: string;
  pageName: string;
  route: string;
  description?: string;
  status: PageAccessStatus;
  showInNavigation: boolean;
  showPagePreview: boolean;
  overlayTitle?: string;
  overlayDescription?: string;
  badgeText?: string;
  primaryButtonLabel?: string;
  primaryButtonRoute?: string;
  secondaryButtonLabel?: string;
  secondaryButtonRoute?: string;
  scheduledReleaseAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  updatedBy?: string;
  order: number;
};

export type PageRegistryEntry = {
  id: string;
  name: string;
  route: string;
  description: string;
  defaultStatus: PageAccessStatus;
  showInNavigation?: boolean;
};

export type PageAccessAuditEntry = {
  id: string;
  pageId: string;
  pageName: string;
  route: string;
  previousStatus: PageAccessStatus;
  newStatus: PageAccessStatus;
  action: string;
  adminId: string;
  adminName: string;
  createdAt: Timestamp | Date | null;
};
