const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const mobileRoot = path.resolve(__dirname, '..');
const webRoot = path.resolve(mobileRoot, '..');
const readMobile = (relativePath) => fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
const readWeb = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), 'utf8');

test('community creation stays actionable and reports the first invalid field', () => {
  const modal = readMobile('components/communities/CreateCommunityModal.tsx');
  const service = readMobile('lib/services/CommunityService.ts');
  assert.match(modal, /disabled=\{submitting\}/);
  assert.match(modal, /Select a category/);
  assert.match(modal, /scrollRef\.current\?\.scrollTo/);
  assert.match(modal, /InteractionManager\.runAfterInteractions/);
  assert.match(modal, /result\.field === 'title' \? 0/);
  assert.match(modal, /titleInputRef\.current\?\.focus\(\)/);
  assert.match(service, /validateCreateInput\(/);
  for (const field of ['title', 'slug', 'availability', 'category', 'terms']) assert.match(service, new RegExp(`field: '${field}'`));
});

test('community creation and membership have direct Firebase paths and duplicate guards', () => {
  const service = readMobile('lib/services/CommunityService.ts');
  assert.match(service, /writeBatch\(db\)/);
  assert.match(service, /alreadyActive/);
  assert.match(service, /runTransaction\(db/);
  assert.match(service, /getCanonicalMemberCount/);
  assert.match(service, /new Set\(membershipSnapshot\.docs/);
  assert.match(service, /reconcileDirectoryCounts/);
  assert.match(service, /communityIdBatch\.map\(\(communityId\) => getDoc\(doc\(db, 'communityVariantMembershipAndLikeCount', communityId\)\)\)/);
  assert.match(service, /repairBatch\.commit\(\)/);
});

test('featured community is excluded from the browse collection', () => {
  const screen = readMobile('components/communities/CommunitiesScreen.tsx');
  assert.match(screen, /visibleCommunities/);
  assert.match(screen, /community\.id !== cachedHeroCommunity\?\.id/);
  assert.match(screen, /data=\{[\s\S]*?visibleCommunities/);
});

test('community permissions come from community roles, never site-admin inheritance', () => {
  const mobile = readMobile('lib/services/CommunityService.ts');
  const access = readWeb('lib/communities/serverAccess.ts');
  const directory = readWeb('lib/communities/communityDirectoryServer.ts');
  assert.match(mobile, /getCapabilities\(/);
  assert.doesNotMatch(access, /canManageMembers = [^\n]*isSiteAdmin/);
  assert.doesNotMatch(access, /hasAccess = [^\n]*isSiteAdmin/);
  assert.doesNotMatch(directory, /canDelete: [^\n]*isSiteAdmin/);
});

test('child safety validation identifies the exact step and field', () => {
  const service = readMobile('lib/services/ChildSafetyReportService.ts');
  const wizard = readMobile('components/safety/ChildSafetyReportWizard.tsx');
  assert.match(service, /step: 1, field: 'category'/);
  assert.match(service, /step: 3, field: 'description'/);
  assert.match(service, /step: 4, field: 'evidence'/);
  assert.match(service, /step: 4, field: 'good_faith'/);
  assert.match(wizard, /setStep\(validation\.step\)/);
  assert.match(wizard, /descriptionRef\.current\?\.focus/);
});

test('community feed preloading hydrates all and seeds derived filters', () => {
  const preload = readMobile('lib/services/AppPreloadService.ts');
  assert.match(preload, /scope: 'communities'/);
  assert.match(preload, /hydrate\(communityQuery\)/);
  assert.match(preload, /seedDerivedFilters\(userId, 'communities'\)/);
});

test('project controls explain denied actions and task publication has direct fallback', () => {
  const service = readMobile('lib/services/ProjectService.ts');
  const board = readMobile('app/projectManagement/[id]/index.tsx');
  const drafts = readMobile('lib/services/ContentDraftService.ts');
  assert.match(service, /getMutationCapability\(/);
  for (const reason of ['secure session', 'read-only', 'owners and admins', 'Viewers']) assert.match(service, new RegExp(reason));
  assert.match(board, /handleCapabilityAction/);
  assert.match(board, /Subtask title required/);
  assert.match(board, /Comment required/);
  assert.match(drafts, /publishTaskDirect/);
  assert.match(drafts, /transaction\.set\(taskReference/);
});

test('project directory keeps cached content visible while refreshing', () => {
  const screen = readMobile('app/projectManagement/index.tsx');
  const resource = readMobile('lib/services/ProjectResourceService.ts');
  const preload = readMobile('lib/services/AppPreloadService.ts');
  assert.match(screen, /useProjectsResource/);
  assert.doesNotMatch(screen, /setProjects\(\[\]\)/);
  assert.match(resource, /status: current\?\.data \? 'refreshing' : 'hydrating'/);
  assert.match(resource, /PROJECT_DIRECTORY_RETENTION_MS/);
  assert.match(resource, /LocalCacheService/);
  assert.match(preload, /project-directory:complete/);
  assert.match(screen, /useFocusEffect\(useCallback\(\(\) => \{\s*setOpeningProjectId\(null\)/);
});

test('project reads do not wait for the native mutation session', () => {
  const service = readMobile('lib/services/ProjectService.ts');
  const listMethod = service.slice(service.indexOf('public async listForCurrentUser'), service.indexOf('public getCachedProject'));
  const getMethod = service.slice(service.indexOf('public async getProject'), service.indexOf('public async claimEmailInvites'));
  assert.doesNotMatch(listMethod, /nativeSessionService\.(ensure|assertOwner)/);
  assert.doesNotMatch(getMethod, /nativeSessionService\.(ensure|assertOwner)/);
});

test('submission success remains keyed to the four-second reconciliation expiry', () => {
  const service = readMobile('lib/services/PostSubmissionService.ts');
  const testSource = readMobile('lib/services/PostSubmissionService.test.mjs');
  assert.match(service, /4_000/);
  assert.match(testSource, /validateCreateInput: \(\) => \{\}/);
  assert.match(testSource, /completed submission clears only after reconciliation/);
});
