import { beforeEach, describe, expect, mock, test } from 'bun:test';

const callableCalls = [];
let callableResult = {};
let callableFailure = null;
let generatedIds = 0;

mock.module('@/lib/firebaseConfig', () => ({ auth: { currentUser: { uid: 'cadmin' } }, db: {}, storage: {} }));
mock.module('./NativeSessionService', () => ({ nativeSessionService: { ensure: async () => undefined, assertOwner: () => undefined } }));
mock.module('./ContentDraftService', () => ({ contentDraftService: { newId: async () => `generated${++generatedIds}` } }));
mock.module('@react-native-firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: (_functions, name) => async (input) => {
    callableCalls.push({ name, input });
    if (callableFailure) { const failure = callableFailure; callableFailure = null; throw failure; }
    return { data: callableResult };
  },
}));

const { communityProjectLinkService } = await import('./CommunityProjectLinkService.ts');

beforeEach(() => {
  callableCalls.length = 0;
  callableResult = {};
  callableFailure = null;
});

describe('Community project cards', () => {
  test('decode safe fields only, with safe defaults', () => {
    expect(communityProjectLinkService.card({ projectId: 'p1', projectName: 'Garden', projectStatus: 'on-hold', progress: 41.6, ownerDisplayName: 'Ana', status: 'active', description: 'secret', memberUids: ['x'] }))
      .toEqual({ projectId: 'p1', projectName: 'Garden', projectStatus: 'on-hold', progress: 42, ownerDisplayName: 'Ana', status: 'active' });
    expect(communityProjectLinkService.card({ projectId: 'p2', projectStatus: 'teleported', progress: 900 }))
      .toEqual({ projectId: 'p2', projectName: 'Untitled project', projectStatus: 'archived', progress: 100, ownerDisplayName: 'Project owner', status: 'ended' });
    expect(communityProjectLinkService.card({ projectName: 'No id' })).toBeNull();
    expect(communityProjectLinkService.card(null)).toBeNull();
  });

  test('the list is a read (no operation ID) and drops malformed cards', async () => {
    callableResult = { active: [{ projectId: 'p1', projectName: 'Garden', status: 'active' }, 'bad'], pending: [{ projectId: 'p2', status: 'pending' }], canDecide: true };
    const list = await communityProjectLinkService.list('c1');
    expect(list.active.map((card) => card.projectId)).toEqual(['p1']);
    expect(list.pending.map((card) => card.projectId)).toEqual(['p2']);
    expect(list.canDecide).toBe(true);
    expect(callableCalls[0]).toEqual({ name: 'mutateProjectMembership', input: { action: 'community_link_list', communityId: 'c1' } });
  });

  test('decisions keep their operation ID across a lost answer, not across a refusal', async () => {
    callableFailure = Object.assign(new Error('unavailable'), { code: 'functions/unavailable' });
    await expect(communityProjectLinkService.decide('c1', 'p1', 'approve')).rejects.toThrow('unavailable');
    callableResult = { status: 'active' };
    expect(await communityProjectLinkService.decide('c1', 'p1', 'approve')).toBe('active');
    expect(callableCalls[0].input.operationId).toBe(callableCalls[1].input.operationId);
    expect(callableCalls[1].input).toEqual({ action: 'community_link_decide', communityId: 'c1', projectId: 'p1', decision: 'approve', operationId: callableCalls[1].input.operationId });
    callableFailure = Object.assign(new Error('Only the Community owner or an admin can approve project links.'), { code: 'functions/permission-denied' });
    await expect(communityProjectLinkService.remove('c1', 'p1')).rejects.toThrow('Community owner');
    callableResult = {};
    expect(await communityProjectLinkService.remove('c1', 'p1')).toBe('none');
    expect(callableCalls[2].input.operationId).not.toBe(callableCalls[3].input.operationId);
  });
});
