import { collection, getCountFromServer, getDocs, limit, query, where, type QueryConstraint } from 'firebase/firestore';
import type { Href } from 'expo-router';
import { auth, db } from '@/lib/firebaseConfig';
import { adminAccessService } from './AdminAccessService';
import { childSafetyReportService } from './ChildSafetyReportService';
import { courierService } from './CourierService';
import { supportTicketService } from './SupportTicketService';
import {
  OPEN_CHILD_SAFETY_STATUSES,
  OPEN_REPORT_STATUSES,
  PENDING_APPROVAL_CATEGORIES,
  PENDING_PREVIEW_LIMIT,
  getPendingCategory,
  isPendingDocument,
  mapPendingDocument,
  readPendingDateMs,
  sortPendingItems,
  totalPending,
} from './PendingApprovalsRules';
import type {
  PendingApprovalCategoryKey,
  PendingApprovalFields,
  PendingApprovalItem,
  PendingApprovalQueue,
  PendingApprovalsSnapshot,
} from '@/lib/types/pendingApprovals';

type LoadMode = 'summary' | 'details';
type ReadyQueue = Extract<PendingApprovalQueue, { status: 'ready' }>;
type SnapshotListener = (snapshot: PendingApprovalsSnapshot) => void;

/** A queue whose waiting test is plain equality / `in` filters, so a server count is exact. */
type CountedQueue = { kind: 'counted'; collectionName: string; constraints: QueryConstraint[] };
/** A queue that also needs in-memory checks (deleted accounts, legacy listings): read a bounded page and filter. */
type ScannedQueue = { kind: 'scanned'; collectionName: string; queries: QueryConstraint[][] };
type FirestoreQueue = CountedQueue | ScannedQueue;

const CACHE_TTL_MS = 30_000;
/** Documents read for queues that are filtered in memory; a full page means the count is "100+". */
const SCAN_LIMIT = 100;
/** Server pages for the callable queues (the case functions allow up to 100). */
const CASE_PAGE_LIMIT = 100;
const LOAD_ERROR = "Couldn't load";

const FIRESTORE_QUEUES: Readonly<{ [key in Exclude<PendingApprovalCategoryKey, 'couriers' | 'childSafety' | 'support'>]: FirestoreQueue }> = {
  sellers: { kind: 'counted', collectionName: 'sellerApplications', constraints: [where('status', '==', 'submitted')] },
  products: { kind: 'scanned', collectionName: 'products', queries: [[where('publicationState', '==', 'pending')], [where('status', '==', 'pending')]] },
  pets: { kind: 'counted', collectionName: 'petListings', constraints: [where('moderationStatus', '==', 'pending')] },
  jobs: { kind: 'counted', collectionName: 'jobs', constraints: [where('basic_info.status', '==', 'pending_review')] },
  courses: { kind: 'counted', collectionName: 'courses', constraints: [where('status', '==', 'pending_review')] },
  instructors: { kind: 'counted', collectionName: 'instructors', constraints: [where('isVerified', '==', false)] },
  identity: { kind: 'scanned', collectionName: 'users', queries: [[where('verificationStatus', '==', 'pending')]] },
  beta: { kind: 'counted', collectionName: 'betaApplications', constraints: [where('status', '==', 'pending')] },
  reports: { kind: 'counted', collectionName: 'reports', constraints: [where('status', 'in', [...OPEN_REPORT_STATUSES])] },
  appeals: { kind: 'counted', collectionName: 'contentAppeals', constraints: [where('status', '==', 'pending')] },
};

/**
 * Everything waiting for an administrator, grouped by queue. Reads Firestore directly where the rules let administrators
 * read, and the app's existing callables for couriers, child-safety cases and support tickets. Counts only for the
 * navigation badge; counts plus a few rows for the Pending Approvals screen. Never notifies anyone.
 */
export class PendingApprovalsService {
  private static instance: PendingApprovalsService;
  private cache: { userId: string; mode: LoadMode; snapshot: PendingApprovalsSnapshot } | null = null;
  private inFlight: { userId: string; mode: LoadMode; promise: Promise<PendingApprovalsSnapshot> } | null = null;
  private readonly listeners = new Set<SnapshotListener>();

  private constructor() {}

  public static getInstance(): PendingApprovalsService {
    if (!PendingApprovalsService.instance) PendingApprovalsService.instance = new PendingApprovalsService();
    return PendingApprovalsService.instance;
  }

  /** Counts only, for the badge. A recent detailed load also answers this. */
  public fetchSummary(force = false): Promise<PendingApprovalsSnapshot> {
    return this.load('summary', force);
  }

  /** Counts plus up to ten waiting items per queue. */
  public fetchDetails(force = false): Promise<PendingApprovalsSnapshot> {
    return this.load('details', force);
  }

  /** The last loaded snapshot for the signed-in account, if any. */
  public peek(): PendingApprovalsSnapshot | null {
    const userId = auth.currentUser?.uid;
    return this.cache && this.cache.userId === userId ? this.cache.snapshot : null;
  }

  /** Called with every new snapshot, so the badge follows a refresh on the screen. */
  public subscribe(listener: SnapshotListener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private load(mode: LoadMode, force: boolean): Promise<PendingApprovalsSnapshot> {
    const userId = auth.currentUser?.uid ?? '';
    const cached = this.cache;
    if (!force && cached && cached.userId === userId && (mode === 'summary' || cached.mode === 'details')
      && Date.now() - cached.snapshot.fetchedAtMs < CACHE_TTL_MS) return Promise.resolve(cached.snapshot);
    const running = this.inFlight;
    if (running && running.userId === userId && (mode === 'summary' || running.mode === 'details')) return running.promise;

    const entry: { userId: string; mode: LoadMode; promise: Promise<PendingApprovalsSnapshot> } = {
      userId,
      mode,
      promise: this.loadAndStore(userId, mode).finally(() => {
        if (this.inFlight === entry) this.inFlight = null;
      }),
    };
    this.inFlight = entry;
    return entry.promise;
  }

  private async loadAndStore(userId: string, mode: LoadMode): Promise<PendingApprovalsSnapshot> {
    const snapshot = await this.loadAll(mode);
    // Drop the result if the account changed while it loaded.
    if ((auth.currentUser?.uid ?? '') === userId) {
      this.cache = { userId, mode, snapshot };
      this.listeners.forEach((listener) => listener(snapshot));
    }
    return snapshot;
  }

  private async loadAll(mode: LoadMode): Promise<PendingApprovalsSnapshot> {
    await adminAccessService.requireAdmin();
    const keys = PENDING_APPROVAL_CATEGORIES.map((category) => category.key);
    // Each queue catches its own failure (React Native's Promise has no allSettled), so one bad queue never hides the rest.
    const queues = await Promise.all(keys.map((key): Promise<PendingApprovalQueue> => this.loadQueue(key, mode).catch((reason: unknown) => {
      console.warn(`[PendingApprovalsService.loadQueue] Error: ${key}: ${reason instanceof Error ? reason.message : String(reason)}`);
      return { key, status: 'error', message: LOAD_ERROR };
    })));
    return { ...totalPending(queues), queues, fetchedAtMs: Date.now() };
  }

  private loadQueue(key: PendingApprovalCategoryKey, mode: LoadMode): Promise<ReadyQueue> {
    if (key === 'couriers') return this.loadCouriers();
    if (key === 'childSafety') return this.loadChildSafety();
    if (key === 'support') return this.loadSupport();
    const definition = FIRESTORE_QUEUES[key];
    return definition.kind === 'counted' ? this.loadCounted(key, definition, mode) : this.loadScanned(key, definition);
  }

  private async loadCounted(key: PendingApprovalCategoryKey, definition: CountedQueue, mode: LoadMode): Promise<ReadyQueue> {
    const reference = collection(db, definition.collectionName);
    const [countSnapshot, preview] = await Promise.all([
      getCountFromServer(query(reference, ...definition.constraints)),
      mode === 'details' ? getDocs(query(reference, ...definition.constraints, limit(PENDING_PREVIEW_LIMIT))) : Promise.resolve(null),
    ]);
    const items = preview
      ? sortPendingItems(preview.docs.map((document) => mapPendingDocument(key, document.id, document.data() as PendingApprovalFields)))
      : [];
    return { key, status: 'ready', count: countSnapshot.data().count, countIsLowerBound: false, items };
  }

  private async loadScanned(key: PendingApprovalCategoryKey, definition: ScannedQueue): Promise<ReadyQueue> {
    const reference = collection(db, definition.collectionName);
    const snapshots = await Promise.all(definition.queries.map((constraints) => getDocs(query(reference, ...constraints, limit(SCAN_LIMIT)))));
    const seen = new Set<string>();
    const items: PendingApprovalItem[] = [];
    snapshots.forEach((snapshot) => snapshot.docs.forEach((document) => {
      const data = document.data() as PendingApprovalFields;
      if (seen.has(document.id) || !isPendingDocument(key, data)) return;
      seen.add(document.id);
      items.push(mapPendingDocument(key, document.id, data));
    }));
    return {
      key,
      status: 'ready',
      count: items.length,
      countIsLowerBound: snapshots.some((snapshot) => snapshot.size >= SCAN_LIMIT),
      items: sortPendingItems(items).slice(0, PENDING_PREVIEW_LIMIT),
    };
  }

  private async loadCouriers(): Promise<ReadyQueue> {
    const couriers = await courierService.fetchModerationCouriers('pending');
    const route = getPendingCategory('couriers').reviewRoute;
    const items = couriers.map((courier): PendingApprovalItem => ({
      id: courier.id,
      title: courier.businessName || 'Courier service',
      subtitle: courier.contactName,
      submittedAtMs: readPendingDateMs(courier.createdAt),
      route,
    }));
    return { key: 'couriers', status: 'ready', count: couriers.length, countIsLowerBound: false, items: sortPendingItems(items).slice(0, PENDING_PREVIEW_LIMIT) };
  }

  private async loadChildSafety(): Promise<ReadyQueue> {
    const page = await childSafetyReportService.listCases({ limit: CASE_PAGE_LIMIT });
    const openStatuses: readonly string[] = OPEN_CHILD_SAFETY_STATUSES;
    const open = page.items.filter((report) => openStatuses.includes(report.status));
    const items = open.map((report): PendingApprovalItem => ({
      id: report.id,
      title: `Case ${report.reference}`,
      subtitle: [report.priority === 'critical' || report.priority === 'high' ? `${report.priority} priority` : '', report.status.replace(/_/g, ' '), report.assignedReviewerName ?? 'Unassigned']
        .filter(Boolean).join(' · '),
      submittedAtMs: readPendingDateMs(report.createdAt),
      route: `/admin/child-safety/${encodeURIComponent(report.id)}` as Href,
    }));
    return { key: 'childSafety', status: 'ready', count: open.length, countIsLowerBound: page.hasMore, items: sortPendingItems(items).slice(0, PENDING_PREVIEW_LIMIT) };
  }

  private async loadSupport(): Promise<ReadyQueue> {
    const page = await supportTicketService.listStaff('unassigned', CASE_PAGE_LIMIT);
    const items = page.items.map((ticket): PendingApprovalItem => ({
      id: ticket.id,
      title: ticket.subject || `Ticket ${ticket.reference}`,
      subtitle: [ticket.reference, ticket.priority === 'urgent' || ticket.priority === 'high' ? `${ticket.priority} priority` : '', ticket.requesterDisplayName].filter(Boolean).join(' · '),
      submittedAtMs: readPendingDateMs(ticket.createdAt),
      route: `/admin/support/${encodeURIComponent(ticket.id)}` as Href,
    }));
    return { key: 'support', status: 'ready', count: page.items.length, countIsLowerBound: page.hasMore, items: sortPendingItems(items).slice(0, PENDING_PREVIEW_LIMIT) };
  }
}

export const pendingApprovalsService = PendingApprovalsService.getInstance();
