import type { Href } from 'expo-router';

/** Every queue an administrator approves or reviews; the website's Pending Approvals page uses the same keys. */
export type PendingApprovalCategoryKey =
  | 'couriers'
  | 'sellers'
  | 'products'
  | 'pets'
  | 'jobs'
  | 'courses'
  | 'instructors'
  | 'identity'
  | 'beta'
  | 'reports'
  | 'appeals'
  | 'childSafety'
  | 'support';

export type PendingApprovalSection = 'market' | 'jobs' | 'learning' | 'members' | 'safety' | 'support';

export type PendingApprovalCategory = {
  key: PendingApprovalCategoryKey;
  label: string;
  section: PendingApprovalSection;
  /** Feather icon name. */
  icon: string;
  /** The screen that reviews this queue, or null when the app has no review screen for it yet. */
  reviewRoute: Href | null;
};

export type PendingApprovalItem = {
  id: string;
  title: string;
  subtitle: string;
  /** When the item was submitted, in milliseconds since the epoch; null when the record has no date. */
  submittedAtMs: number | null;
  /** Where tapping the item goes; null when there is nowhere to open it. */
  route: Href | null;
};

export type PendingApprovalQueue =
  | {
      key: PendingApprovalCategoryKey;
      status: 'ready';
      count: number;
      /** True when the count is only the first page of a server list ("30+"). */
      countIsLowerBound: boolean;
      items: PendingApprovalItem[];
    }
  | { key: PendingApprovalCategoryKey; status: 'error'; message: string };

export type PendingApprovalsSnapshot = {
  total: number;
  totalIsLowerBound: boolean;
  queues: PendingApprovalQueue[];
  fetchedAtMs: number;
};

/** One Firestore document's fields, read defensively. */
export type PendingApprovalFields = { readonly [field: string]: unknown };
