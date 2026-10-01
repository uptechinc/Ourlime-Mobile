import { expect, mock, test } from 'bun:test';

const noop = () => ({});
mock.module('firebase/firestore', () => ({
  collection: noop, deleteDoc: async () => {}, doc: noop, getDoc: async () => ({ exists: () => false }),
  getDocs: async () => ({ empty: true, docs: [] }), limit: noop, query: noop,
  runTransaction: async (_database, operation) => operation({ get: async () => ({ data: () => ({}) }), set: noop }),
  serverTimestamp: noop, setDoc: async () => {}, where: noop, writeBatch: () => ({ set: noop, commit: async () => {} }),
}));
mock.module('@/lib/firebaseConfig', () => ({ auth: { currentUser: { uid: 'viewer' } }, db: {} }));
mock.module('./DiagnosticLogService', () => ({ DiagnosticLogService: { getInstance: () => ({ info: noop, warn: noop, error: noop, success: noop }) } }));
mock.module('./AccountLifecycleVisibilityService', () => ({ accountLifecycleVisibilityService: { isHidden: () => false } }));
mock.module('./ApiService', () => ({ ApiService: { getInstance: () => ({ request: async () => ({}) }) } }));

const { CommunityService } = await import('./CommunityService.ts');
const { ChildSafetyReportService } = await import('./ChildSafetyReportService.ts');
const service = CommunityService.getInstance();
const childSafetyService = ChildSafetyReportService.getInstance();

const createInput = (overrides = {}) => ({
  title: 'Community name', slug: 'community-name', description: '', isPrivate: false,
  verifiedMembersOnly: false, postingPermission: 'members', categoryId: 'category-id',
  imageUrl: null, termsAccepted: true, ...overrides,
});
const available = { nameAvailable: true, slugAvailable: true, normalizedSlug: 'community-name', suggestions: [] };

test('community creation validation identifies the first invalid field', () => {
  expect(service.validateCreateInput(createInput({ title: 'No' }), available)).toEqual({ valid: false, field: 'title', message: 'Community name must contain 3 to 80 characters.' });
  expect(service.validateCreateInput(createInput({ slug: '' }), available).field).toBe('slug');
  expect(service.validateCreateInput(createInput(), { ...available, slugAvailable: false }).field).toBe('availability');
  expect(service.validateCreateInput(createInput({ categoryId: null }), available).field).toBe('category');
  expect(service.validateCreateInput(createInput({ termsAccepted: false }), available).field).toBe('terms');
  expect(service.validateCreateInput(createInput(), available)).toEqual({ valid: true });
});

test('community capabilities never inherit site-wide account status', () => {
  expect(service.getCapabilities('member')).toEqual({ canEdit: false, canDelete: false, canManageMembers: false, canModerate: false });
  expect(service.getCapabilities('moderator')).toEqual({ canEdit: false, canDelete: false, canManageMembers: false, canModerate: true });
  expect(service.getCapabilities('admin')).toEqual({ canEdit: true, canDelete: false, canManageMembers: true, canModerate: true });
  expect(service.getCapabilities('owner')).toEqual({ canEdit: true, canDelete: true, canManageMembers: true, canModerate: true });
});

test('child safety validation returns the exact earliest step', () => {
  const validDraft = { category: 'grooming_or_predatory_behaviour', description: 'A sufficiently detailed safety concern.', goodFaithAcknowledged: true, hasAttachments: false, evidenceAcknowledged: false };
  expect(childSafetyService.validate({ ...validDraft, category: null }).step).toBe(1);
  expect(childSafetyService.validate({ ...validDraft, description: 'short' }).step).toBe(3);
  expect(childSafetyService.validate({ ...validDraft, hasAttachments: true }).field).toBe('evidence');
  expect(childSafetyService.validate({ ...validDraft, goodFaithAcknowledged: false }).field).toBe('good_faith');
  expect(childSafetyService.validate(validDraft)).toEqual({ valid: true });
});
