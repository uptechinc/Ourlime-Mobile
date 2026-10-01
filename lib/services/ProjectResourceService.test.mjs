import { beforeEach, expect, mock, test } from 'bun:test';

let cachedValue = null;
let listProjects = async () => [];
const cacheWrites = [];
const resourceState = {
  projectDirectories: {},
  setProjectDirectory(userId, resource) {
    resourceState.projectDirectories = { ...resourceState.projectDirectories, [userId]: resource };
  },
};

mock.module('./ProjectService', () => ({
  ProjectService: { getInstance: () => ({
    listForCurrentUser: () => listProjects(),
    claimEmailInvites: async () => 0,
  }) },
}));
mock.module('./LocalCacheService', () => ({
  LocalCacheService: { getInstance: () => ({
    read: async () => cachedValue,
    write: async (...argumentsList) => { cacheWrites.push(argumentsList); },
  }) },
}));
mock.module('./ResourceErrorService', () => ({
  ResourceErrorService: { getInstance: () => ({ normalize: (error, fallback) => new Error(error instanceof Error ? error.message : fallback) }) },
}));
mock.module('./DiagnosticLogService', () => ({
  DiagnosticLogService: { getInstance: () => ({ info: () => {}, warn: () => {} }) },
}));
mock.module('../store/useResourceStore', () => ({
  useResourceStore: { getState: () => resourceState },
}));

const { ProjectResourceService } = await import('./ProjectResourceService.ts');
const service = ProjectResourceService.getInstance();

const project = (id, updatedAt = new Date('2026-09-21T12:00:00.000Z')) => ({
  id,
  name: `Project ${id}`,
  description: '',
  ownerId: 'viewer',
  ownerName: 'Viewer',
  status: 'active',
  role: 'owner',
  membershipStatus: 'accepted',
  totalTasks: 0,
  completedTasks: 0,
  teamMembers: 1,
  progress: 0,
  color: 'green',
  updatedAt,
});

beforeEach(() => {
  cachedValue = null;
  listProjects = async () => [];
  cacheWrites.length = 0;
  resourceState.projectDirectories = {};
});

test('project directory hydrates dates from the disk snapshot', async () => {
  cachedValue = {
    data: [{ ...project('cached'), updatedAt: '2026-09-21T12:00:00.000Z' }],
    updatedAt: Date.now(),
    expiresAt: Date.now() + 1_000,
    isExpired: false,
  };
  await service.hydrate('viewer');
  const resource = resourceState.projectDirectories.viewer;
  expect(resource.source).toBe('disk');
  expect(resource.data[0].updatedAt).toBeInstanceOf(Date);
});

test('project directory preserves cached rows during revalidation', async () => {
  let resolveProjects;
  listProjects = () => new Promise((resolve) => { resolveProjects = resolve; });
  resourceState.setProjectDirectory('viewer', {
    data: [project('cached')], status: 'ready', source: 'memory', updatedAt: Date.now(), isStale: false, error: null,
  });
  const refresh = service.refresh('viewer', true);
  await Promise.resolve();
  const refreshing = resourceState.projectDirectories.viewer;
  expect(refreshing.status).toBe('refreshing');
  expect(refreshing.data.map((item) => item.id)).toEqual(['cached']);
  resolveProjects([project('fresh')]);
  await refresh;
  const ready = resourceState.projectDirectories.viewer;
  expect(ready.status).toBe('ready');
  expect(ready.data.map((item) => item.id)).toEqual(['fresh']);
  expect(cacheWrites.length).toBe(1);
});

test('project directory retains cached rows when refresh fails', async () => {
  listProjects = async () => { throw new Error('offline'); };
  resourceState.setProjectDirectory('viewer', {
    data: [project('cached')], status: 'ready', source: 'disk', updatedAt: Date.now(), isStale: false, error: null,
  });
  await service.refresh('viewer', true);
  const resource = resourceState.projectDirectories.viewer;
  expect(resource.status).toBe('ready');
  expect(resource.isStale).toBe(true);
  expect(resource.data.map((item) => item.id)).toEqual(['cached']);
  expect(resource.error.message).toBe('offline');
});
