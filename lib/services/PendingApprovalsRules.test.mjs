import { describe, expect, test } from 'bun:test';

const rules = await import('./PendingApprovalsRules.ts');

describe('PendingApprovalsRules', () => {
  test('defines every queue once, each in a known section', () => {
    const keys = rules.PENDING_APPROVAL_CATEGORIES.map((category) => category.key);
    expect(new Set(keys).size).toBe(13);
    rules.PENDING_APPROVAL_CATEGORIES.forEach((category) => expect(rules.PENDING_SECTION_ORDER).toContain(category.section));
    expect(rules.PENDING_APPROVAL_CATEGORIES.filter((category) => category.reviewRoute === null)).toEqual([]);
    expect(rules.getPendingCategory('instructors').reviewRoute).toBe('/admin/elearning-review');
    expect(rules.getPendingCategory('courses').reviewRoute).toBe('/admin/elearning-review?tab=courses');
    expect(rules.getPendingCategory('sellers').reviewRoute).toBe('/admin?section=seller_review');
  });

  test('open report and child-safety statuses', () => {
    expect([...rules.OPEN_REPORT_STATUSES]).toEqual(['pending', 'under_review', 'awaiting_info', 'escalated', 'reopened', 'appealed', 'appeal_under_review']);
    expect(rules.OPEN_CHILD_SAFETY_STATUSES).not.toContain('resolved');
    expect(rules.OPEN_CHILD_SAFETY_STATUSES).not.toContain('closed');
  });

  test('products: publicationState wins, legacy status only without it, deleted excluded', () => {
    expect(rules.isPendingDocument('products', { publicationState: 'pending' })).toBe(true);
    expect(rules.isPendingDocument('products', { publicationState: 'published', status: 'pending' })).toBe(false);
    expect(rules.isPendingDocument('products', { status: 'pending' })).toBe(true);
    expect(rules.isPendingDocument('products', { publicationState: 'pending', isDeleted: true })).toBe(false);
  });

  test('identity: hidden and deleted accounts are not waiting', () => {
    expect(rules.isPendingDocument('identity', { verificationStatus: 'pending' })).toBe(true);
    expect(rules.isPendingDocument('identity', { verificationStatus: 'pending', deletedAt: { seconds: 1 } })).toBe(false);
    expect(rules.isPendingDocument('identity', { verificationStatus: 'pending', accountLifecycleHiddenAt: '2026-01-01' })).toBe(false);
  });

  test('instructors: declined applications are not waiting', () => {
    expect(rules.isPendingDocument('instructors', { isVerified: false })).toBe(true);
    expect(rules.isPendingDocument('instructors', { isVerified: false, applicationStatus: 'pending' })).toBe(true);
    expect(rules.isPendingDocument('instructors', { isVerified: false, applicationStatus: 'declined' })).toBe(false);
    expect(rules.isPendingDocument('instructors', { isVerified: true })).toBe(false);
  });

  test('reads Firestore-like dates', () => {
    expect(rules.readPendingDateMs({ seconds: 10, nanoseconds: 0 })).toBe(10_000);
    expect(rules.readPendingDateMs({ toMillis: () => 42 })).toBe(42);
    expect(rules.readPendingDateMs('2026-11-23T00:00:00.000Z')).toBe(Date.parse('2026-11-23T00:00:00.000Z'));
    expect(rules.readPendingDateMs(undefined)).toBeNull();
    expect(rules.readPendingDateMs('nope')).toBeNull();
  });

  test('maps documents to preview rows', () => {
    const job = rules.mapPendingDocument('jobs', 'j1', { basic_info: { title: 'Driver', category: 'transport', employmentType: 'full_time', createdAt: { seconds: 5 } } });
    expect(job).toEqual({ id: 'j1', title: 'Driver', subtitle: 'Transport · Full time', submittedAtMs: 5000, route: '/admin/jobs' });
    const course = rules.mapPendingDocument('courses', 'c 1', { title: 'Maths', instructor: { name: 'Ann' } });
    expect(course.route).toBe('/eLearning/courses/c%201');
    expect(course.subtitle).toBe('Ann');
    const user = rules.mapPendingDocument('identity', 'u1', { firstName: 'Kyle', lastName: 'B', userName: 'kyle' });
    expect(user.title).toBe('Kyle B');
    expect(user.subtitle).toBe('@kyle');
    expect(rules.mapPendingDocument('instructors', 'i1', {}).route).toBe('/admin/elearning-review');
    expect(rules.mapPendingDocument('reports', 'r1', { contentType: 'post', reasonCategory: 'spam' }).title).toBe('Post report');
  });

  test('sorts newest first with undated last', () => {
    const items = [
      { id: 'a', title: '', subtitle: '', submittedAtMs: null, route: null },
      { id: 'b', title: '', subtitle: '', submittedAtMs: 2, route: null },
      { id: 'c', title: '', subtitle: '', submittedAtMs: 5, route: null },
    ];
    expect(rules.sortPendingItems(items).map((item) => item.id)).toEqual(['c', 'b', 'a']);
  });

  test('totals skip failed queues and carry lower bounds', () => {
    const queues = [
      { key: 'jobs', status: 'ready', count: 3, countIsLowerBound: false, items: [] },
      { key: 'support', status: 'ready', count: 100, countIsLowerBound: true, items: [] },
      { key: 'couriers', status: 'error', message: "Couldn't load" },
    ];
    expect(rules.totalPending(queues)).toEqual({ total: 103, totalIsLowerBound: true });
  });

  test('badge hides at 0 and caps at 99+', () => {
    expect(rules.formatPendingBadge(0)).toBeUndefined();
    expect(rules.formatPendingBadge(7)).toBe('7');
    expect(rules.formatPendingBadge(99)).toBe('99');
    expect(rules.formatPendingBadge(100)).toBe('99+');
    expect(rules.formatPendingCount(30, true)).toBe('30+');
  });

  test('relative age', () => {
    const now = 1_000_000_000_000;
    expect(rules.formatPendingAge(null, now)).toBe('');
    expect(rules.formatPendingAge(now - 10_000, now)).toBe('just now');
    expect(rules.formatPendingAge(now - 5 * 60_000, now)).toBe('5m ago');
    expect(rules.formatPendingAge(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(rules.formatPendingAge(now - 2 * 86_400_000, now)).toBe('2d ago');
  });

  test('filters by section and hides empty queues but keeps failures', () => {
    const queues = [
      { key: 'reports', status: 'ready', count: 0, countIsLowerBound: false, items: [] },
      { key: 'appeals', status: 'error', message: "Couldn't load" },
      { key: 'jobs', status: 'ready', count: 2, countIsLowerBound: false, items: [] },
      { key: 'couriers', status: 'ready', count: 1, countIsLowerBound: false, items: [] },
    ];
    expect(rules.filterPendingQueues(queues, 'all', false).map((queue) => queue.key)).toEqual(['couriers', 'jobs', 'reports', 'appeals']);
    expect(rules.filterPendingQueues(queues, 'safety', true).map((queue) => queue.key)).toEqual(['appeals']);
    expect(rules.filterPendingQueues(queues, 'jobs', true).map((queue) => queue.key)).toEqual(['jobs']);
  });
});
