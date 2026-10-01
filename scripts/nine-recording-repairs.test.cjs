const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

test('composer selectors preserve the compact layout without fading selected text', () => {
  const composer = read('components/home/MiddleSection/MiddleSectionComponent/CreatePostModal/index.tsx');
  assert.match(composer, /activeOpacity=\{1\}/);
  assert.match(composer, /paddingHorizontal: 10/);
  assert.match(composer, /paddingVertical: 5/);
  assert.match(composer, /visibility === option \? colors\.selectedText/);
  assert.match(composer, /postType === option \? colors\.accentText/);
  assert.doesNotMatch(composer, /transform: \[\{ scale: pressed/);
});

test('photo crop exposes an always reachable Finish action and bottom safe area', () => {
  const crop = read('components/home/MiddleSection/MiddleSectionComponent/CreatePostModal/MediaCropModal.tsx');
  assert.match(crop, /useSafeAreaInsets\(\)/);
  assert.match(crop, /Math\.max\(insets\.bottom, Platform\.OS === 'android' \? 48 : 12\)/);
  assert.match(crop, /accessibilityLabel="Finish cropping photo"/);
  assert.match(crop, /<\/ScrollView>\s*<View style=\{\{ paddingHorizontal: 16, paddingTop: 10, paddingBottom:/);
  assert.match(crop, />Finish<\/Text>/);
  assert.match(crop, /if \(saving\) return;/);
});

test('profile editor keeps focused inputs scrollable above the keyboard', () => {
  const editor = read('components/profile/EditProfileModal.tsx');
  assert.match(editor, /presentationStyle="overFullScreen"/);
  assert.match(editor, /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/);
  assert.match(editor, /automaticallyAdjustKeyboardInsets=\{Platform\.OS === 'ios'\}/);
  assert.match(editor, /Keyboard\.addListener\('keyboardDidShow'/);
  assert.doesNotMatch(editor, /keyboardHeight/);
  assert.match(editor, /fieldOffsetsRef\.current\[field\]/);
  assert.match(editor, /scrollResponderScrollNativeHandleToKeyboard\(inputHandle, 32, true\)/);
  assert.match(editor, /scrollViewRef\.current\?\.scrollTo/);
  assert.match(editor, /scrollViewRef\.current\?\.scrollToEnd/);
  assert.match(editor, /\}, 350\);/);
  assert.match(editor, /onFocus=\{\(\) => handleFieldFocus\('location'\)\}/);
});

test('notifications use bounded virtualization and guarded pagination', () => {
  const notifications = read('components/home/NotificationsModal.tsx');
  assert.match(notifications, /<FlatList/);
  assert.match(notifications, /loadingMoreRef\.current/);
  assert.match(notifications, /loadGenerationRef\.current/);
  assert.match(notifications, /paginationArmedRef\.current/);
  assert.match(notifications, /lastPaginationKeyRef\.current/);
  assert.match(notifications, /onScrollBeginDrag/);
  assert.match(notifications, /maxToRenderPerBatch=\{6\}/);
  assert.doesNotMatch(notifications, /sortedNotifications\.map\(renderNotificationCard\)/);
});

test('pending friendship cancellation deletes only direct Firebase pending documents', () => {
  const relationships = read('lib/services/RelationshipService.ts');
  const start = relationships.indexOf('public async cancelPendingFriendRequest');
  const end = relationships.indexOf('/**', start);
  const method = relationships.slice(start, end);
  assert.match(method, /status === 'pending'/);
  assert.match(method, /Promise\.all\(pendingDocuments\.map\(\(document\) => deleteDoc\(document\.ref\)\)\)/);
  assert.match(method, /status === 'accepted'/);
  assert.match(method, /deleteRelationshipNotifications\(currentUserId, targetUserId, \['friend_request'\]\)/);
  assert.doesNotMatch(method, /apiService/);
});

test('post options hydrate and reconcile live relationship state', () => {
  const options = read('components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostOptionsSheet.tsx');
  const relationships = read('lib/services/RelationshipService.ts');
  assert.match(options, /relationshipService\.checkFollowStatus\(currentUserId, post\.userId\)/);
  assert.match(options, /relationshipService\.checkFriendshipStatus\(currentUserId, post\.userId\)/);
  assert.match(options, /reconcileRelationshipStatus\(nextFollowing/);
  assert.match(relationships, /deleteRelationshipNotifications\(followerId, followeeId, \['follow'\]\)/);
  assert.match(relationships, /userNotifications/);
  assert.match(relationships, /users\/\$\{targetUserId\}\/notifications/);
  const profile = read('app/profile/[username].tsx');
  assert.match(profile, /friendshipStatus === 'pending'[\s\S]*cancelPendingFriendRequest\(currentUserId \?\? '', profile\.uid\)/);
});

test('relationship mutations persist directly and accepted friendships take precedence', () => {
  const options = read('components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostOptionsSheet.tsx');
  const profile = read('app/profile/[username].tsx');
  const relationships = read('lib/services/RelationshipService.ts');
  assert.match(relationships, /snapshot\.docs\.map\(\(document\) => deleteDoc\(document\.ref\)\)/);
  assert.match(relationships, /persistedState !== shouldFollow/);
  assert.match(relationships, /statuses\.includes\('accepted'\)/);
  assert.match(relationships, /readString\(value\.friendshipStatus\) \|\| readString\(value\.status\)/);
  assert.match(relationships, /hasAcceptedRelationship/);
  assert.match(options, /friendshipStatus === 'accepted' \? handleRemoveFriend/);
  assert.match(options, /friendshipStatus === 'accepted' \? 'Remove Friend'/);
  assert.match(profile, /friendshipStatus === 'accepted' \? 'Remove Friend'/);
});

test('blank posts are rejected before upload and omitted from feed hydration', () => {
  const submissions = read('lib/services/PostSubmissionService.ts');
  const posts = read('lib/services/PostService.ts');
  assert.match(submissions, /PostService\.getInstance\(\)\.validateCreateInput\(draft\.post\)/);
  assert.match(posts, /this\.validateCreateInput\(input\)/);
  assert.match(posts, /Add text, a hashtag, a photo, or a video before posting/);
  assert.match(posts, /hasRenderablePostContent\(document\.data, mediaByPost\.get\(document\.id\) \?\? \[\]\)/);
});

test('a successful repost immediately labels its source creator', () => {
  const card = read('components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostCardSection.tsx');
  const postService = read('lib/services/PostService.ts');
  assert.match(card, /!post\.repostedFrom && isReposted/);
  assert.match(card, /You reposted this from @\{post\.user\.userName\}/);
  assert.match(postService, /loadViewerRepostedPostIds\(viewerId\)/);
  assert.match(postService, /viewerRepostedPostIds\.has\(document\.id\)/);
  assert.match(postService, /readString\(marker\.originalPostId\) \|\| readString\(marker\.postId\)/);
});

test('feeds bind one active media post and keep only adjacent video players mounted', () => {
  const feed = read('components/home/MiddleSection/index.tsx');
  const media = read('components/home/MiddleSection/MiddleSectionComponent/PostCardSection/ImageAndVideoPostSection/ImageAndVideoPostSection.tsx');
  assert.match(feed, /activeMediaPostId/);
  assert.match(feed, /Math\.abs\(row\.index - activeMediaIndex\) <= 1/);
  assert.match(feed, /removeClippedSubviews=\{Platform\.OS === 'android'\}/);
  assert.match(feed, /maxToRenderPerBatch=\{4\}/);
  assert.match(media, /item\.type === 'video' && shouldLoadVideo/);
});

test('Lime playback polling is active-only and stall recovery is bounded', () => {
  const hook = read('lib/hooks/usePlaybackInteraction.ts');
  const limes = read('app/(tabs)/Limes.tsx');
  assert.match(hook, /eligible\s*\? setInterval\(\(\) => setSnapshot\(session\.tick\(\)\), 250\)/);
  assert.match(limes, /firstFrameTimedOut = surfaceState !== 'decoded'/);
  assert.match(limes, /playbackTimedOut = surfaceState === 'decoded'/);
  assert.match(limes, /automaticRetryCountRef\.current === 0/);
  assert.match(limes, /Playback stopped responding/);
});

test('E-Project cards use typed route parameters and guard repeated navigation', () => {
  const projects = read('app/projectManagement/index.tsx');
  assert.match(projects, /if \(openingProjectId\) return;/);
  assert.match(projects, /pathname: '\/projectManagement\/\[id\]'/);
  assert.match(projects, /params: \{ id: selectedProjectId \}/);
  assert.match(projects, /accessibilityLabel=\{`Open \$\{project\.name\} project board`\}/);
});
