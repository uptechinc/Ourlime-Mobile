import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';

// Trinidad and Tobago (UTC-4): a UTC-midnight day is still the evening before there.
const originalTimeZone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/Port_of_Spain'; });
afterAll(() => { process.env.TZ = originalTimeZone; });

let projectDocuments = [];
let activityDocuments = [];
const updates = [];
/** setDoc and deleteDoc calls, in order. */
const writes = [];
/** onSnapshot listeners: the watched path and its callback. */
const listeners = [];
const callableCalls = [];
let callableFailure = null;
/** What the next callable answers (reset to {} after each test). */
let callableResult = {};
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
  deleteDoc: async (path) => { writes.push({ kind: 'delete', path }); },
  deleteField: () => undefined,
  doc: (_db, ...path) => path.join('/'),
  getDoc: async (path) => {
    const id = String(path).split('/').pop();
    return { exists: () => Boolean(users[id]), data: () => users[id] };
  },
  getDocs: async (constraint) => {
    if (constraint.path?.endsWith('/activity')) {
      const start = constraint.after ? activityDocuments.findIndex((entry) => entry.id === constraint.after.id) + 1 : 0;
      return { docs: activityDocuments.slice(start, start + constraint.limit) };
    }
    return { docs: constraint.field === 'ownerId' ? projectDocuments.filter((entry) => entry.data().ownerId === constraint.value) : projectDocuments };
  },
  limit: (count) => ({ kind: 'limit', count }),
  onSnapshot: (target, next) => { listeners.push({ target: String(target), next }); return () => undefined; },
  orderBy: (field, direction) => ({ kind: 'orderBy', field, direction }),
  query: (collectionPath, ...constraints) => {
    if (String(collectionPath).endsWith('/activity')) {
      return { path: String(collectionPath), limit: constraints.find((entry) => entry.kind === 'limit')?.count ?? 0, after: constraints.find((entry) => entry.kind === 'startAfter')?.cursor ?? null };
    }
    return constraints[0];
  },
  serverTimestamp: () => 'SERVER_TIMESTAMP',
  setDoc: async (path, data, options) => { writes.push({ kind: 'set', path, data, options }); },
  startAfter: (cursor) => ({ kind: 'startAfter', cursor }),
  updateDoc: async (path, data) => { updates.push({ path, data }); },
  where: (field, _operator, value) => ({ field, value }),
}));
mock.module('firebase/storage', () => ({ getDownloadURL: async () => '', ref: () => ({}), uploadBytes: async () => undefined }));
mock.module('./DurableWorkService', () => ({ durableWorkService: { read: async () => null, write: async () => 1, remove: async () => undefined } }));
mock.module('./NativeSessionService', () => ({ nativeSessionService: { ensure: async () => undefined, assertOwner: () => undefined } }));
mock.module('./NativeTaskService', () => ({ nativeTaskService: { mutate: async () => undefined } }));
let generatedIds = 0;
mock.module('./ContentDraftService', () => ({ contentDraftService: { newId: async () => `generated${++generatedIds}` } }));
mock.module('./PageAccessService', () => ({ pageAccessService: { assertMutation: () => undefined } }));
mock.module('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (_functions, name) => async (input) => {
    callableCalls.push({ name, input });
    if (callableFailure) { const failure = callableFailure; callableFailure = null; throw failure; }
    return { data: callableResult };
  },
}));

const { projectService } = await import('./ProjectService.ts');
const { projectLifecycleRules } = await import('./ProjectLifecycleRules.ts');
const { describeProjectActivity } = await import('../../components/projectManagement/projectActivityFormat.ts');

const snapshot = (id, data) => ({ id, data: () => data });
const activeProject = (overrides = {}) => ({ id: 'p1', status: 'active', membershipStatus: 'accepted', role: 'member', ...overrides });
const ready = { signedIn: true, sessionReady: true, pageCanMutate: true };

beforeEach(() => {
  projectDocuments = [];
  activityDocuments = [];
  updates.length = 0;
  writes.length = 0;
  listeners.length = 0;
  callableCalls.length = 0;
  callableFailure = null;
  callableResult = {};
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
    // An unknown stored role never grants more than read access, and pending invitees aren't counted.
    expect(old).toMatchObject({ role: 'viewer', status: 'on-hold', teamMembers: 1 });
  });

  test('an unknown status is read-only and an unknown role is a viewer', async () => {
    projectDocuments = [snapshot('future', { name: 'Future', ownerId: 'owner', status: 'proposed', updatedAt: new FakeTimestamp(1),
      teamMembers: { viewer: { role: 'editor', membershipStatus: 'accepted' } } })];
    const [project] = await projectService.listForCurrentUser();
    expect(project).toMatchObject({ status: 'archived', role: 'viewer' });
    const capability = projectService.getMutationCapability('create_task', project, ready);
    expect(capability.allowed).toBe(false);
    expect(capability.reason).toContain('read-only');
  });

  test('a legacy entry without a membership status is accepted for the owner and pending for anyone else', async () => {
    projectDocuments = [
      snapshot('legacyMember', { name: 'Legacy', ownerId: 'owner', status: 'active', updatedAt: new FakeTimestamp(2), teamMembers: { owner: { role: 'owner' }, viewer: { role: 'member' } } }),
      snapshot('legacyOwner', { name: 'Mine', ownerId: 'viewer', status: 'active', updatedAt: new FakeTimestamp(1), teamMembers: { viewer: { role: 'owner' } } }),
    ];
    const [member, owner] = await projectService.listForCurrentUser();
    expect(member).toMatchObject({ id: 'legacyMember', membershipStatus: 'pending' });
    expect(owner).toMatchObject({ id: 'legacyOwner', membershipStatus: 'accepted', role: 'owner' });
  });

  test('reads when and by whom the status last changed', async () => {
    projectDocuments = [snapshot('changed', { name: 'Changed', ownerId: 'viewer', status: 'archived', statusChangedAt: new FakeTimestamp(Date.UTC(2026, 10, 12)), statusChangedBy: 'owner' })];
    const [project] = await projectService.listForCurrentUser();
    expect(project.statusChangedAt?.toISOString()).toBe('2026-11-12T00:00:00.000Z');
    expect(project.statusChangedBy).toBe('owner');
  });
});

describe('project lifecycle', () => {
  test('offers the same transitions as the server', () => {
    expect(projectLifecycleRules.targets('active')).toEqual(['on-hold', 'completed', 'archived']);
    expect(projectLifecycleRules.targets('on-hold')).toEqual(['active', 'completed', 'archived']);
    expect(projectLifecycleRules.targets('completed')).toEqual(['active', 'archived']);
    expect(projectLifecycleRules.targets('archived')).toEqual(['active']);
    expect(projectLifecycleRules.reasonRequired('active', 'archived')).toBe(true);
    expect(projectLifecycleRules.reasonRequired('completed', 'active')).toBe(true);
    expect(projectLifecycleRules.reasonRequired('archived', 'active')).toBe(false);
    expect(projectLifecycleRules.label('on-hold')).toBe('Paused');
    expect(projectLifecycleRules.copy('archived', 'active').menuLabel).toBe('Restore project');
  });

  test('sends a transition with the status the screen saw and an operation ID', async () => {
    await projectService.transitionProject('p1', { expectedStatus: 'active', toStatus: 'archived', reason: '  Season ended ' });
    expect(callableCalls).toHaveLength(1);
    expect(callableCalls[0].name).toBe('mutateProjectMembership');
    expect(callableCalls[0].input).toMatchObject({ action: 'transition', projectId: 'p1', expectedStatus: 'active', toStatus: 'archived', reason: 'Season ended' });
    expect(typeof callableCalls[0].input.operationId).toBe('string');
  });

  test('a retry after a lost response reuses the operation ID; a definite refusal does not', async () => {
    callableFailure = Object.assign(new Error('Network request failed'), { code: 'functions/unavailable' });
    await expect(projectService.transitionProject('p2', { expectedStatus: 'active', toStatus: 'on-hold' })).rejects.toThrow('Network');
    await projectService.transitionProject('p2', { expectedStatus: 'active', toStatus: 'on-hold' });
    expect(callableCalls[1].input.operationId).toBe(callableCalls[0].input.operationId);
    callableFailure = Object.assign(new Error('This project changed since you opened it.'), { code: 'functions/aborted' });
    const stale = await projectService.transitionProject('p3', { expectedStatus: 'active', toStatus: 'on-hold' }).catch((error) => error);
    expect(projectService.isStaleProjectError(stale)).toBe(true);
    await projectService.transitionProject('p3', { expectedStatus: 'active', toStatus: 'on-hold' });
    expect(callableCalls[3].input.operationId).not.toBe(callableCalls[2].input.operationId);
  });

  test('settings saves never write the status', async () => {
    await projectService.updateProjectSettings('p1', { name: 'Renamed', status: 'archived' });
    expect(updates).toHaveLength(1);
    expect(updates[0].data.name).toBe('Renamed');
    expect('status' in updates[0].data).toBe(false);
  });
});

describe('project activity', () => {
  const eventDocument = (id, data) => ({ id, data: () => data });

  test('maps events tolerantly', () => {
    expect(projectService.mapActivity('e1', { type: 'member.role_changed', actorId: 'owner', at: new FakeTimestamp(Date.UTC(2026, 10, 20)), subject: { kind: 'member', id: 'bob' }, data: { from: 'member', to: 'viewer' } }))
      .toEqual({ id: 'e1', type: 'member.role_changed', actorId: 'owner', subjectKind: 'member', subjectId: 'bob', at: new Date(Date.UTC(2026, 10, 20)), from: 'member', to: 'viewer', role: '', reason: '', channel: '', changed: [], title: '', by: '', selfApproved: false });
    expect(projectService.mapActivity('e2', { type: 'project.teleported', subject: 'x', data: [1] }))
      .toEqual({ id: 'e2', type: 'unknown', actorId: '', subjectKind: 'unknown', subjectId: '', at: null, from: '', to: '', role: '', reason: '', channel: '', changed: [], title: '', by: '', selfApproved: false });
    expect(projectService.mapActivity('e3', null).type).toBe('unknown');
  });

  test('maps milestone and Community events with their stored title', () => {
    const completed = projectService.mapActivity('m1', { type: 'milestone.completed', actorId: 'owner', subject: { kind: 'milestone', id: 'ms1' }, data: { title: 'Beta launch' } });
    expect([completed.type, completed.subjectKind, completed.subjectId, completed.title]).toEqual(['milestone.completed', 'milestone', 'ms1', 'Beta launch']);
    const ended = projectService.mapActivity('c1', { type: 'community.link_ended', actorId: 'system', subject: { kind: 'community', id: 'c1' }, data: { title: 'Garden Club', by: 'system', reason: 'project_archived' } });
    expect([ended.type, ended.subjectKind, ended.by, ended.reason]).toEqual(['community.link_ended', 'community', 'system', 'project_archived']);
    expect(projectService.mapActivity('c2', { type: 'community.link_approved', data: { selfApproved: true } }).selfApproved).toBe(true);
  });

  test('pages 20 at a time and stops when a page is short', async () => {
    activityDocuments = Array.from({ length: 25 }, (_, index) => eventDocument(`e${index}`, { type: 'member.joined', actorId: `u${index}`, subject: { kind: 'member', id: `u${index}` }, data: { role: 'member' } }));
    const first = await projectService.listActivity('p1');
    expect(first.events).toHaveLength(20);
    expect(first.cursor?.id).toBe('e19');
    const second = await projectService.listActivity('p1', first.cursor);
    expect(second.events.map((event) => event.id)).toEqual(['e20', 'e21', 'e22', 'e23', 'e24']);
    expect(second.cursor).toBeNull();
  });

  test('describes events with names from the team and no stored names', () => {
    const nameOf = (uid) => ({ owner: 'Olivia', bob: 'Bob' })[uid] ?? 'Former member';
    const event = (fields) => ({ id: 'x', type: 'unknown', actorId: 'owner', subjectKind: 'member', subjectId: 'bob', at: null, from: '', to: '', role: '', reason: '', channel: '', changed: [], ...fields });
    expect(describeProjectActivity(event({ type: 'project.status_changed', subjectKind: 'project', from: 'active', to: 'on-hold' }), nameOf)).toBe('Olivia changed the status from active to paused');
    expect(describeProjectActivity(event({ type: 'member.removed' }), nameOf)).toBe('Olivia removed Bob');
    expect(describeProjectActivity(event({ type: 'member.invited', subjectKind: 'email_invite', subjectId: '', role: 'viewer' }), nameOf)).toBe('Olivia invited someone by email as viewer');
    expect(describeProjectActivity(event({ type: 'member.left', actorId: 'gone' }), nameOf)).toBe('Former member left the project');
    expect(describeProjectActivity(event({ type: 'unknown' }), nameOf)).toBe('Olivia updated the project');
  });

  test('describes milestone and Community events by their title, never a Community admin\'s name', () => {
    const nameOf = (uid) => ({ owner: 'Olivia' })[uid] ?? 'Former member';
    const event = (fields) => ({ id: 'x', type: 'unknown', actorId: 'owner', subjectKind: 'milestone', subjectId: 'm1', at: null, from: '', to: '', role: '', reason: '', channel: '', changed: [], title: '', by: '', selfApproved: false, ...fields });
    expect(describeProjectActivity(event({ type: 'milestone.completed', title: 'Beta' }), nameOf)).toBe('Olivia completed the milestone "Beta"');
    expect(describeProjectActivity(event({ type: 'milestone.deleted' }), nameOf)).toBe('Olivia deleted the milestone a milestone');
    expect(describeProjectActivity(event({ type: 'community.link_requested', title: 'Garden Club' }), nameOf)).toBe('Olivia asked Garden Club to sponsor the project');
    expect(describeProjectActivity(event({ type: 'community.link_approved', actorId: 'cadmin', title: 'Garden Club' }), nameOf)).toBe('Garden Club approved the link to this project');
    expect(describeProjectActivity(event({ type: 'community.link_approved', title: 'Garden Club', selfApproved: true }), nameOf)).toBe('Olivia linked the project to Garden Club');
    expect(describeProjectActivity(event({ type: 'community.link_ended', actorId: 'cadmin', title: 'Garden Club', by: 'community' }), nameOf)).toBe('Garden Club removed its link to this project');
    expect(describeProjectActivity(event({ type: 'community.link_ended', title: 'Garden Club', by: 'system' }), nameOf)).toBe('The link to Garden Club ended');
  });
});

describe('server-written milestones and the Community link', () => {
  test('milestones go through mutateProjectMembership with a chosen ID and an operation ID', async () => {
    const id = await projectService.createMilestone('p1', { name: '  Venue booked  ', dueDate: '2026-12-20' });
    const [call] = callableCalls;
    expect(call.name).toBe('mutateProjectMembership');
    expect(call.input).toEqual({ action: 'milestone_create', projectId: 'p1', milestoneId: id, operationId: call.input.operationId, fields: { name: 'Venue booked', description: '', dueDate: '2026-12-20', color: 'bg-emerald-500', ownerId: '' } });
    expect(call.input.operationId).not.toBe(id);
    await projectService.setMilestoneCompleted('p1', id, true);
    await projectService.deleteMilestone('p1', id);
    expect(callableCalls.map((entry) => [entry.input.action, entry.input.milestoneId, entry.input.completed])).toEqual([
      ['milestone_create', id, undefined], ['milestone_complete', id, true], ['milestone_delete', id, undefined],
    ]);
    expect(updates).toHaveLength(0);
    await expect(projectService.createMilestone('p1', { name: '   ' })).rejects.toThrow('Milestone title is required');
  });

  test('a retry after a lost answer reuses the operation ID; a definite refusal does not', async () => {
    callableFailure = Object.assign(new Error('internal'), { code: 'functions/unavailable' });
    await expect(projectService.setMilestoneCompleted('p1', 'm1', true)).rejects.toThrow('internal');
    await projectService.setMilestoneCompleted('p1', 'm1', true);
    expect(callableCalls[0].input.operationId).toBe(callableCalls[1].input.operationId);
    callableFailure = Object.assign(new Error('Only the person who added this milestone or a project manager can change it.'), { code: 'functions/permission-denied' });
    await expect(projectService.deleteMilestone('p1', 'm1')).rejects.toThrow('project manager');
    await projectService.deleteMilestone('p1', 'm1').catch(() => undefined);
    expect(callableCalls[2].input.operationId).not.toBe(callableCalls[3].input.operationId);
  });

  test('the project link decodes tolerantly; requests and removals use the callable', async () => {
    expect(projectService.mapCommunityLink({ communityId: 'c1', communityName: 'Garden Club', status: 'active' })).toEqual({ communityId: 'c1', communityName: 'Garden Club', status: 'active' });
    expect(projectService.mapCommunityLink({ communityId: 'c1', status: 'ended' })).toBeNull();
    expect(projectService.mapCommunityLink(null)).toBeNull();
    expect(await projectService.requestCommunityLink('p1', 'c1')).toBe('none');
    await projectService.removeCommunityLink('p1', 'c1');
    expect(callableCalls.map((entry) => [entry.input.action, entry.input.communityId, typeof entry.input.operationId])).toEqual([
      ['community_link_request', 'c1', 'string'], ['community_link_remove', 'c1', 'string'],
    ]);
  });
});

describe('invitation expiry (website decision D3)', () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();

  test('an expired email invitation is hidden from the invitee; unexpired and account invitations stay', async () => {
    projectDocuments = [
      snapshot('expired', { name: 'Expired', ownerId: 'owner', status: 'active', updatedAt: new FakeTimestamp(3), teamMembers: { viewer: { role: 'member', membershipStatus: 'pending', inviteExpiresAt: past } } }),
      snapshot('fresh', { name: 'Fresh', ownerId: 'owner', status: 'active', updatedAt: new FakeTimestamp(2), teamMembers: { viewer: { role: 'member', membershipStatus: 'pending', inviteExpiresAt: future } } }),
      snapshot('account', { name: 'Account', ownerId: 'owner', status: 'active', updatedAt: new FakeTimestamp(1), teamMembers: { viewer: { role: 'member', membershipStatus: 'pending' } } }),
      snapshot('joined', { name: 'Joined', ownerId: 'owner', status: 'active', updatedAt: new FakeTimestamp(0), teamMembers: { viewer: { role: 'member', membershipStatus: 'accepted', inviteExpiresAt: past } } }),
    ];
    expect((await projectService.listForCurrentUser()).map((project) => project.id)).toEqual(['fresh', 'account', 'joined']);
    expect(projectService.isInviteExpired({ membershipStatus: 'pending', inviteExpiresAt: past })).toBe(true);
    expect(projectService.isInviteExpired({ membershipStatus: 'pending', inviteExpiresAt: 'soon' })).toBe(false);
    expect(projectService.isInviteExpired(undefined)).toBe(false);
  });

  test('opening an expired invitation reads as not found; managers see expired invitees marked', async () => {
    users.pExpired = { name: 'Expired', ownerId: 'owner', status: 'active', teamMembers: { owner: { role: 'owner', membershipStatus: 'accepted' }, viewer: { role: 'member', membershipStatus: 'pending', inviteExpiresAt: past } } };
    users.pManaged = { name: 'Managed', ownerId: 'viewer', status: 'active', teamMembers: { viewer: { role: 'owner', membershipStatus: 'accepted' }, late: { role: 'member', membershipStatus: 'pending', inviteExpiresAt: past }, soon: { role: 'viewer', membershipStatus: 'pending', inviteExpiresAt: future } } };
    try {
      await expect(projectService.getProject('pExpired')).rejects.toThrow('Project not found');
      const { teamMembers } = await projectService.getProject('pManaged');
      expect(teamMembers.map((member) => [member.id, member.inviteExpired])).toEqual([['viewer', false], ['late', true], ['soon', false]]);
    } finally {
      delete users.pExpired;
      delete users.pManaged;
    }
  });

  test('email invitations are listed through the callable and resent as a new invitation', async () => {
    callableResult = { invitations: [
      { id: 'i1', email: 'guest@example.com', role: 'viewer', status: 'expired', expiresAt: '2026-11-20T00:00:00.000Z' },
      { id: 'i2', email: 'other@example.com', role: 'owner', status: 'blocked', expiresAt: '2026-12-01T00:00:00.000Z' },
      { id: '', email: 'broken@example.com' },
    ] };
    const invitations = await projectService.listEmailInvites('p1');
    expect(invitations).toEqual([
      { id: 'i1', email: 'guest@example.com', role: 'viewer', status: 'expired', expiresAt: '2026-11-20T00:00:00.000Z' },
      { id: 'i2', email: 'other@example.com', role: 'member', status: 'pending', expiresAt: '2026-12-01T00:00:00.000Z' },
    ]);
    callableResult = {};
    await projectService.resendEmailInvite('p1', invitations[0]);
    expect(callableCalls.map((entry) => entry.input)).toEqual([
      { action: 'email_invites', projectId: 'p1' },
      { action: 'invite', projectId: 'p1', recipient: 'guest@example.com', role: 'viewer' },
    ]);
  });
});

describe('private task timer (eProjects S5)', () => {
  const timerPath = 'users/viewer/private/projectTimer';
  const started = new FakeTimestamp(Date.UTC(2026, 10, 24, 12));
  const subscribe = () => {
    const seen = [];
    projectService.subscribeToActiveTimer((timer) => seen.push(timer));
    const privateListener = listeners.find((entry) => entry.target === timerPath);
    const legacyListener = listeners.find((entry) => entry.target === 'users/viewer');
    return { seen, privateListener, legacyListener };
  };
  const document = (data) => ({ exists: () => data !== undefined, data: () => data });

  test('reads the private timer, and an older public one only while no private one exists', () => {
    const { seen, privateListener, legacyListener } = subscribe();
    legacyListener.next(document({ activeTimer: { taskId: 'old', projectId: 'p1', startedAt: started } }));
    expect(seen).toEqual([]);
    privateListener.next(document(undefined));
    expect(seen.at(-1)).toEqual({ taskId: 'old', projectId: 'p1', startedAt: new Date(started.milliseconds) });
    privateListener.next(document({ taskId: 't2', projectId: 'p1', startedAt: started }));
    expect(seen.at(-1)?.taskId).toBe('t2');
    privateListener.next(document({ taskId: '', projectId: 'p1', startedAt: started }));
    expect(seen.at(-1)).toBeNull();
  });

  test('starting and stopping write the private timer and clear an older public one', async () => {
    users.viewer = { activeTimer: { taskId: 'old', projectId: 'p1' } };
    try {
      await projectService.startTimer('p1', { id: 't1', status: 'in-progress' });
      expect(writes[0]).toEqual({ kind: 'set', path: timerPath, data: { taskId: 't1', projectId: 'p1', startedAt: 'SERVER_TIMESTAMP' }, options: undefined });
      expect(writes[1]).toEqual({ kind: 'set', path: 'users/viewer', data: { activeTimer: undefined }, options: { merge: true } });
      delete users.viewer;
      writes.length = 0;
      await projectService.stopTimer('p1', 't1', null);
      // Nothing left on the profile, so only the private timer is removed.
      expect(writes).toEqual([{ kind: 'delete', path: timerPath }]);
    } finally {
      delete users.viewer;
    }
  });
});
