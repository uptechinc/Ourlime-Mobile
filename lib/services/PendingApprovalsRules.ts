import type { Href } from 'expo-router';
import type {
  PendingApprovalCategory,
  PendingApprovalCategoryKey,
  PendingApprovalFields,
  PendingApprovalItem,
  PendingApprovalQueue,
  PendingApprovalSection,
} from '@/lib/types/pendingApprovals';

/** How many waiting items each card previews. */
export const PENDING_PREVIEW_LIMIT = 10;

/** Report statuses that still need a moderator (the website's open report statuses). */
export const OPEN_REPORT_STATUSES = ['pending', 'under_review', 'awaiting_info', 'escalated', 'reopened', 'appealed', 'appeal_under_review'] as const;

/** Child-safety case statuses that are still open for a reviewer. */
export const OPEN_CHILD_SAFETY_STATUSES = ['submitted', 'under_review', 'escalated', 'action_required'] as const;

export const PENDING_SECTION_LABELS: Readonly<{ [section in PendingApprovalSection]: string }> = {
  market: 'E-Hub & Market',
  jobs: 'Jobs',
  learning: 'E-Learning',
  members: 'Members',
  safety: 'Safety',
  support: 'Support',
};

export const PENDING_SECTION_ORDER: readonly PendingApprovalSection[] = ['market', 'jobs', 'learning', 'members', 'safety', 'support'];

export const PENDING_APPROVAL_CATEGORIES: readonly PendingApprovalCategory[] = [
  { key: 'couriers', label: 'Courier registrations', section: 'market', icon: 'truck', reviewRoute: '/admin/couriers' as Href },
  { key: 'sellers', label: 'Seller verification', section: 'market', icon: 'user-check', reviewRoute: '/admin?section=seller_review' as Href },
  { key: 'products', label: 'Market listings', section: 'market', icon: 'shopping-bag', reviewRoute: '/admin/products' as Href },
  { key: 'pets', label: 'Pet adoption listings', section: 'market', icon: 'heart', reviewRoute: '/admin/pet-adoption' as Href },
  { key: 'jobs', label: 'Job listings', section: 'jobs', icon: 'briefcase', reviewRoute: '/admin/jobs' as Href },
  { key: 'courses', label: 'Courses', section: 'learning', icon: 'book-open', reviewRoute: '/admin/elearning-review?tab=courses' as Href },
  { key: 'instructors', label: 'Instructor applications', section: 'learning', icon: 'award', reviewRoute: '/admin/elearning-review' as Href },
  { key: 'identity', label: 'Identity checks', section: 'members', icon: 'credit-card', reviewRoute: '/admin?section=users' as Href },
  { key: 'beta', label: 'Beta tester applications', section: 'members', icon: 'user-plus', reviewRoute: '/admin/testers' as Href },
  { key: 'reports', label: 'Reports', section: 'safety', icon: 'flag', reviewRoute: '/admin?section=moderation' as Href },
  { key: 'appeals', label: 'Appeals', section: 'safety', icon: 'rotate-ccw', reviewRoute: '/admin?section=moderation' as Href },
  { key: 'childSafety', label: 'Child-safety cases', section: 'safety', icon: 'shield', reviewRoute: '/admin/child-safety' as Href },
  { key: 'support', label: 'Support tickets (unassigned)', section: 'support', icon: 'life-buoy', reviewRoute: '/admin/support' as Href },
];

export function getPendingCategory(key: PendingApprovalCategoryKey): PendingApprovalCategory {
  const category = PENDING_APPROVAL_CATEGORIES.find((entry) => entry.key === key);
  if (!category) throw new Error(`Unknown approval queue: ${key}`);
  return category;
}

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const readObject = (value: unknown): PendingApprovalFields | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as PendingApprovalFields) : null;
const joinParts = (...parts: string[]): string => parts.filter(Boolean).join(' · ');
const humanize = (value: string): string => (value ? value.replace(/[_-]+/g, ' ').replace(/^\w/, (letter) => letter.toUpperCase()) : '');
const shorten = (value: string, maximum = 80): string => (value.length > maximum ? `${value.slice(0, maximum - 1).trimEnd()}…` : value);

/** Milliseconds from a Firestore Timestamp, {seconds}, Date, ISO string or number; null when there is no usable date. */
export function readPendingDateMs(value: unknown): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value === 'string') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  const record = readObject(value);
  if (!record) return null;
  const toMillis = record.toMillis;
  if (typeof toMillis === 'function') {
    const millis: unknown = toMillis.call(value);
    return typeof millis === 'number' && Number.isFinite(millis) ? millis : null;
  }
  if (typeof record.seconds === 'number') return record.seconds * 1000;
  if (typeof record._seconds === 'number') return record._seconds * 1000;
  return null;
}

const firstDate = (...values: unknown[]): number | null => {
  for (const value of values) {
    const millis = readPendingDateMs(value);
    if (millis !== null) return millis;
  }
  return null;
};

/** Whether a Firestore document in this queue is really waiting (filters the query cannot express). */
export function isPendingDocument(key: PendingApprovalCategoryKey, data: PendingApprovalFields): boolean {
  if (key === 'products') {
    if (data.isDeleted === true || data.deletedAt) return false;
    const publicationState = readString(data.publicationState);
    // Older listings have no publicationState and use status instead.
    return publicationState ? publicationState === 'pending' : readString(data.status) === 'pending';
  }
  if (key === 'identity') return readString(data.verificationStatus) === 'pending' && !data.deletedAt && !data.accountLifecycleHiddenAt;
  // Declined applications (manageLearning review_instructor) stay unverified but are no longer waiting.
  if (key === 'instructors') return data.isVerified !== true && readString(data.applicationStatus) !== 'declined';
  return true;
}

/** Turns one Firestore document of a client-readable queue into a preview row. */
export function mapPendingDocument(key: PendingApprovalCategoryKey, id: string, data: PendingApprovalFields): PendingApprovalItem {
  const category = getPendingCategory(key);
  const base = { id, route: category.reviewRoute };
  switch (key) {
    case 'sellers':
      return { ...base, title: readString(data.storeName) || readString(data.name) || 'Seller application', subtitle: joinParts(readString(data.name), data.isBusiness === true ? 'Business' : ''), submittedAtMs: firstDate(data.submittedAt, data.updatedAt, data.createdAt) };
    case 'products':
      return {
        ...base,
        title: readString(data.title) || readString(data.name) || 'Untitled listing',
        subtitle: joinParts(readString(data.sellerName) || readString(data.storeName), typeof data.price === 'number' ? `$${data.price.toLocaleString()}` : ''),
        submittedAtMs: firstDate(data.createdAt, data.updatedAt),
      };
    case 'pets':
      return { ...base, title: readString(data.name) || 'Unnamed pet', subtitle: joinParts(humanize(readString(data.petType)), readString(data.location)), submittedAtMs: firstDate(data.createdAt, data.updatedAt) };
    case 'jobs': {
      const basic = readObject(data.basic_info) ?? {};
      return { ...base, title: readString(basic.title) || 'Untitled job', subtitle: joinParts(humanize(readString(basic.category)), humanize(readString(basic.employmentType) || readString(basic.type))), submittedAtMs: firstDate(basic.createdAt, data.createdAt) };
    }
    case 'courses': {
      const instructor = readObject(data.instructor) ?? {};
      return { ...base, route: `/eLearning/courses/${encodeURIComponent(id)}` as Href, title: readString(data.title) || 'Untitled course', subtitle: joinParts(readString(instructor.name), humanize(readString(data.category))), submittedAtMs: firstDate(data.createdAt, data.updatedAt) };
    }
    case 'instructors':
      return { ...base, title: readString(data.name) || 'Instructor applicant', subtitle: joinParts(readString(data.jobTitle), humanize(readString(data.applicationType))), submittedAtMs: firstDate(data.updatedAt, data.joinedAt) };
    case 'identity': {
      const fullName = `${readString(data.firstName)} ${readString(data.lastName)}`.trim();
      const userName = readString(data.userName);
      return { ...base, title: fullName || userName || 'Member', subtitle: joinParts(userName ? `@${userName}` : '', humanize(readString(data.verificationType))), submittedAtMs: firstDate(data.verificationSubmittedAt, data.updatedAt) };
    }
    case 'beta': {
      const fullName = `${readString(data.firstName)} ${readString(data.lastName)}`.trim();
      return { ...base, title: readString(data.displayName) || fullName || readString(data.name) || readString(data.email) || 'Applicant', subtitle: readString(data.email), submittedAtMs: firstDate(data.createdAt) };
    }
    case 'reports': {
      const contentType = humanize(readString(data.contentType)) || 'Content';
      const reason = humanize(readString(data.reasonCategory)) || shorten(readString(data.reason));
      return { ...base, title: `${contentType} report`, subtitle: joinParts(reason, humanize(readString(data.status)), readString(data.reporterName)), submittedAtMs: firstDate(data.createdAtMs, data.createdAt) };
    }
    case 'appeals': {
      const contentType = humanize(readString(data.contentType)) || 'Content';
      return { ...base, title: `${contentType} appeal`, subtitle: joinParts(readString(data.authorName), shorten(readString(data.appealReason))), submittedAtMs: firstDate(data.createdAt) };
    }
    default:
      return { ...base, title: readString(data.title) || readString(data.name) || 'Waiting item', subtitle: '', submittedAtMs: firstDate(data.createdAt) };
  }
}

/** Newest first; undated items last. */
export function sortPendingItems(items: readonly PendingApprovalItem[]): PendingApprovalItem[] {
  return [...items].sort((first, second) => (second.submittedAtMs ?? 0) - (first.submittedAtMs ?? 0) || first.id.localeCompare(second.id));
}

export function totalPending(queues: readonly PendingApprovalQueue[]): { total: number; totalIsLowerBound: boolean } {
  return queues.reduce<{ total: number; totalIsLowerBound: boolean }>(
    (sum, queue) => (queue.status === 'ready'
      ? { total: sum.total + queue.count, totalIsLowerBound: sum.totalIsLowerBound || queue.countIsLowerBound }
      : sum),
    { total: 0, totalIsLowerBound: false },
  );
}

/** The label on a navigation badge: hidden at 0, capped at 99+. */
export function formatPendingBadge(count: number): string | undefined {
  if (!Number.isFinite(count) || count <= 0) return undefined;
  return count > 99 ? '99+' : String(Math.floor(count));
}

export function formatPendingCount(count: number, isLowerBound: boolean): string {
  return `${count}${isLowerBound ? '+' : ''}`;
}

/** "just now", "5m ago", "3h ago", "2d ago", or a short date after a week. */
export function formatPendingAge(submittedAtMs: number | null, nowMs: number): string {
  if (submittedAtMs === null) return '';
  const elapsed = Math.max(0, nowMs - submittedAtMs);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(submittedAtMs).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: days > 300 ? 'numeric' : undefined });
}

/** Queues shown for a section filter, in category order; "Hide empty" drops ready queues with nothing waiting. */
export function filterPendingQueues(
  queues: readonly PendingApprovalQueue[],
  section: PendingApprovalSection | 'all',
  hideEmpty: boolean,
): PendingApprovalQueue[] {
  return PENDING_APPROVAL_CATEGORIES
    .filter((category) => section === 'all' || category.section === section)
    .flatMap((category) => queues.filter((queue) => queue.key === category.key))
    .filter((queue) => !hideEmpty || queue.status === 'error' || queue.count > 0);
}
