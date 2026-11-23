import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';

// Trinidad and Tobago (UTC-4): a UTC-midnight day is still the evening before there.
const originalTimeZone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/Port_of_Spain'; });
afterAll(() => { process.env.TZ = originalTimeZone; });

let projectDocuments = [];
const users = { owner: { displayName: 'Olivia Owner' } };

class FakeTimestamp {
  constructor(milliseconds) { this.milliseconds = milliseconds; }
  toDate() { return new Date(this.milliseconds); }
}

mock.module('@/lib/firebaseConfig', () => ({ auth: { currentUser: { uid: 'viewer' } }, db: {}, storage: {} }));
mock.module('@react-native-async-storage/async-storage', () => ({ default: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined } }));
mock.module('firebase/firestore', () => ({
  addDoc: async () => ({ id: 'new' }),
  collection: (_db, ...path) => path.join('/'),
  deleteDoc: async () => undefined,
  deleteField: () => undefined,
  doc: (_db, ...path) => path.join('/'),
  getDoc: async (path) => {
    const id = String(path).split('/').pop();
    return { exists: () => Boolean(users[id]), data: () => users[id] };
  },
  getDocs: async (constraint) => ({ docs: constraint.field === 'ownerId' ? projectDocuments.filter((entry) => entry.data().ownerId === constraint.value) : projectDocuments }),
  onSnapshot: () => () => undefined,
  query: (_collection, constraint) => constraint,
  serverTimestamp: () => 'SERVER_TIMESTAMP',
  setDoc: async () => undefined,
  updateDoc: async () => undefined,
  where: (field, _operator, value) => ({ field, value }),
}));
mock.module('firebase/storage', () => ({ getDownloadURL: async () => '', ref: () => ({}), uploadBytes: async () => undefined }));
mock.module('./DurableWorkService', () => ({ durableWorkService: { read: async () => null, write: async () => 1, remove: async () => undefined } }));
mock.module('./NativeSessionService', () => ({ nativeSessionService: { ensure: async () => undefined, assertOwner: () => undefined } }));
mock.module('./NativeTaskService', () => ({ nativeTaskService: { mutate: async () => undefined } }));
mock.module('./ContentDraftService', () => ({ contentDraftService: { newId: async () => 'generated' } }));
mock.module('./PageAccessService', () => ({ pageAccessService: { assertMutation: () => undefined } }));

const { projectService } = await import('./ProjectService.ts');

const snapshot = (id, data) => ({ id, data: () => data });
const activeProject = (overrides = {}) => ({ id: 'p1', status: 'active', membershipStatus: 'accepted', role: 'member', ...overrides });
const ready = { signedIn: true, sessionReady: true, pageCanMutate: true };

beforeEach(() => {
  projectDocuments = [];
});

describe('project mutation capability', () => {
  test('requires a signed-in, connected, writable session that is not mid-save', () => {
    expect(projectService.getMutationCapability('create_task', activeProject(), { ...ready, signedIn: false }).allowed).toBe(false);
    expect(projectService.getMutationCapability('create_task', activeProject(), { ...ready, sessionReady: false }).allowed).toBe(false);
    expect(projectService.getMutationCapability('create_task', activeProject(), { ...ready, pageCanMutate: false }).allowed).toBe(false);
    expect(projectService.getMutationCapability('create_task', activeProject(), { ...ready, mutationInFlight: true }).allowed).toBe(false);
  });

  test('anyone signed in may create a project', () => {
    expect(projectService.getMutationCapability('create_project', null, ready)).toEqual({ allowed: true });
  });

  test('only active projects with an accepted membership can change', () => {
    expect(projectService.getMutationCapability('create_task', null, ready).allowed).toBe(false);
    for (const status of ['archived', 'completed', 'on-hold']) {
      expect(projectService.getMutationCapability('create_task', activeProject({ status }), ready).allowed).toBe(false);
    }
    expect(projectService.getMutationCapability('create_task', activeProject({ membershipStatus: 'pending' }), ready).reason).toContain('Accept');
  });

  test('viewers are read-only; only owners and admins invite', () => {
    expect(projectService.getMutationCapability('add_comment', activeProject({ role: 'viewer' }), ready).allowed).toBe(false);
    expect(projectService.getMutationCapability('create_task', activeProject({ role: 'member' }), ready)).toEqual({ allowed: true });
    expect(projectService.getMutationCapability('invite', activeProject({ role: 'member' }), ready).allowed).toBe(false);
    expect(projectService.getMutationCapability('invite', activeProject({ role: 'viewer' }), ready).allowed).toBe(false);
    expect(projectService.getMutationCapability('invite', activeProject({ role: 'admin' }), ready)).toEqual({ allowed: true });
    expect(projectService.getMutationCapability('invite', activeProject({ role: 'owner' }), ready)).toEqual({ allowed: true });
  });
});

describe('project load errors', () => {
  test('classifies codes and messages', () => {
    expect(projectService.classifyLoadError({ code: 'not-found' })).toBe('not-found');
    expect(projectService.classifyLoadError(new Error('Project is no longer available'))).toBe('not-found');
    expect(projectService.classifyLoadError({ code: 'permission-denied' })).toBe('permission-denied');
    expect(projectService.classifyLoadError({ code: 'unavailable' })).toBe('network-error');
    expect(projectService.classifyLoadError(new Error('Network request failed'))).toBe('network-error');
    expect(projectService.classifyLoadError('boom')).toBe('unknown');
    expect(projectService.classifyLoadError(null)).toBe('unknown');
  });
});

describe('project list', () => {
  test('a due date the website saved (UTC midnight) shows the same day in the app', async () => {
    projectDocuments = [snapshot('web', { name: 'Website project', ownerId: 'owner', status: 'active', memberUids: ['owner', 'viewer'],
      teamMembers: { owner: { role: 'owner', membershipStatus: 'accepted' }, viewer: { role: 'member', membershipStatus: 'accepted' } },
      endDate: new FakeTimestamp(Date.UTC(2026, 10, 30)), updatedAt: new FakeTimestamp(2000) })];
    const [project] = await projectService.listForCurrentUser();
    expect(project.dueDate).toBe('2026-11-30');
  });

  test('a due date the app saved (local noon) keeps its day too', async () => {
    projectDocuments = [snapshot('app', { name: 'App project', ownerId: 'owner', status: 'active',
      teamMembers: { viewer: { role: 'viewer', membershipStatus: 'accepted' } },
      endDate: new FakeTimestamp(new Date(2026, 10, 30, 12).getTime()) })];
    const [project] = await projectService.listForCurrentUser();
    expect(project.dueDate).toBe('2026-11-30');
  });

  test('maps roles, membership and counts, hides deleted projects and sorts by latest activity', async () => {
    projectDocuments = [
      snapshot('old', { name: 'Old', ownerId: 'owner', status: 'on_hold', updatedAt: new FakeTimestamp(1000),
        teamMembers: { viewer: { role: 'superuser', membershipStatus: 'accepted' }, other: { role: 'member', membershipStatus: 'pending' } } }),
      snapshot('new', { name: '', ownerId: 'viewer', status: 'active', updatedAt: new FakeTimestamp(5000), totalTasks: Number.NaN }),
      snapshot('gone', { name: 'Deleted', ownerId: 'viewer', status: 'deleted', updatedAt: new FakeTimestamp(9000) }),
      snapshot('tombstone', { name: 'Tombstone', ownerId: 'viewer', isDeleted: true, updatedAt: new FakeTimestamp(9000) }),
      snapshot('invited', { name: 'Invite', ownerId: 'owner', status: 'active', updatedAt: new FakeTimestamp(3000),
        teamMembers: { viewer: { role: 'admin', membershipStatus: 'pending', invitedByName: 'Olivia' } } }),
    ];
    const projects = await projectService.listForCurrentUser();
    expect(projects.map((project) => project.id)).toEqual(['new', 'invited', 'old']);
    const [mine, invited, old] = projects;
    expect(mine).toMatchObject({ name: 'Untitled project', role: 'owner', isOwner: true, totalTasks: 0, ownerName: 'Project owner' });
    expect(invited).toMatchObject({ role: 'admin', membershipStatus: 'pending', invitedByName: 'Olivia', ownerName: 'Olivia Owner' });
    // An unknown stored role never grants more than member access, and pending invitees aren't counted.
    expect(old).toMatchObject({ role: 'member', status: 'on-hold', teamMembers: 1 });
  });
});
