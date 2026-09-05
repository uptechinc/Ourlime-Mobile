import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';

const state = { discover: null, setDiscover(value) { state.discover = value; } };
const people = { getSuggestions: mock(async () => []) };
const communities = { fetchCommunities: mock(async () => [{ id: 'community', title: 'Community', memberCount: 1, imageUrl: null }]) };
const events = { fetchEvents: mock(async () => []) };
const jobs = { fetchJobs: mock(async () => []) };
const cache = { read: async () => null, write: async () => {}, touch: async () => {} };
mock.module('./CommunityService', () => ({ CommunityService: { getInstance: () => communities } }));
mock.module('./EventService', () => ({ EventService: { getInstance: () => events } }));
mock.module('../job/JobsService', () => ({ JobsService: { getInstance: () => jobs } }));
mock.module('./RelationshipService', () => ({ RelationshipService: { getInstance: () => people } }));
mock.module('./LocalCacheService', () => ({ LocalCacheService: { getInstance: () => cache } }));
mock.module('./ResourceErrorService', () => ({ ResourceErrorService: { getInstance: () => ({ normalize: (_error, message) => ({ message }) }) } }));
mock.module('../store/useResourceStore', () => ({ useResourceStore: { getState: () => state } }));
const { DiscoverResourceService } = await import('./DiscoverResourceService.ts');
const service = DiscoverResourceService.getInstance();
let errorSpy;
beforeEach(() => {
  state.discover = { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };
  people.getSuggestions.mockImplementation(async () => []);
  jobs.fetchJobs.mockImplementation(async () => []);
  errorSpy = spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

test('Discover works when the native Promise lacks allSettled', async () => {
  const original = Promise.allSettled;
  Promise.allSettled = undefined;
  try {
    await service.refresh('viewer', true);
    expect(state.discover.status).toBe('ready');
    expect(state.discover.data.communities[0].id).toBe('community');
    expect(state.discover.data.sectionStatus).toEqual({ people: 'ready', communities: 'ready', events: 'ready', jobs: 'ready' });
  } finally { Promise.allSettled = original; }
});
test('synchronous section failures log their source and do not leave other sections loading', async () => {
  jobs.fetchJobs.mockImplementation(() => { throw new TypeError('undefined is not a function'); });
  await service.refresh('viewer', true);
  expect(state.discover.status).toBe('ready');
  expect(state.discover.data.sectionStatus.jobs).toBe('error');
  expect(state.discover.data.sectionStatus.communities).toBe('ready');
  expect(errorSpy.mock.calls[0][0]).toContain('"section":"jobs"');
  expect(errorSpy.mock.calls[0][0]).toContain('undefined is not a function');
});
test('failed async sources preserve cached data and allow a later retry', async () => {
  const person = { id: 'cached-person' };
  state.discover.data = { suggestedPeople: [person], communities: [], jobs: [], events: [], sectionStatus: {} };
  people.getSuggestions.mockRejectedValueOnce(new Error('Offline'));
  await service.refresh('viewer', true);
  expect(state.discover.data.suggestedPeople).toEqual([person]);
  expect(state.discover.data.sectionStatus.people).toBe('ready');
  await service.refresh('viewer', true);
  expect(state.discover.data.suggestedPeople).toEqual([]);
  expect(state.discover.status).toBe('ready');
});
