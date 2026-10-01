const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

test('GIF category loading keeps stable geometry and rejects stale responses', () => {
  const picker = read('components/comments/GifPickerModal.tsx');

  assert.match(picker, /const GIF_SKELETON_ITEMS = \[[^\]]*gif-skeleton-4[^\]]*\] as const;/s);
  assert.match(picker, /requestGeneration !== requestGenerationRef\.current/);
  assert.match(picker, /categoryScroller: \{ flexGrow: 0, flexShrink: 0, height: 50 \}/);
  assert.match(picker, /resultsRegion: \{ flex: 1, minHeight: 304 \}/);
  assert.match(picker, /<Skeleton key=\{skeletonId\} height=\{148\} borderRadius=\{12\}/);
  assert.match(picker, /initialNumToRender=\{4\}/);
  assert.match(picker, /maxToRenderPerBatch=\{4\}/);
  assert.match(picker, /windowSize=\{3\}/);
});

test('Lime fullscreen uses one persistent player and app-owned controls', () => {
  const limes = read('app/(tabs)/Limes.tsx');
  const playerHookCount = (limes.match(/useVideoPlayer\(/g) ?? []).length;

  assert.equal(playerHookCount, 1);
  assert.doesNotMatch(limes, /\.enterFullscreen\(/);
  assert.match(limes, /presentationStyle="overFullScreen"/);
  assert.match(limes, /statusBarTranslucent/);
  assert.match(limes, /navigationBarTranslucent/);
  assert.match(limes, /fullscreenOptions=\{\{ enable: false \}\}/);
  assert.match(limes, /onFirstFrameRender/);
  assert.doesNotMatch(limes, /addListener\('statusChange'/);
  assert.match(limes, /<Minimize2 size=\{24\} color="#ffffff"/);
  assert.match(limes, /fullscreenButton\.measureInWindow/);
  assert.match(limes, /onRequestClose=\{onExitFullscreen\}/);
  assert.match(limes, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(limes, /onExitFullscreen\(\);\s*return true;/);
  assert.match(limes, /useEventListener\(player, 'statusChange'/);
  assert.match(limes, /retry: async \(\) =>/);
  assert.match(limes, /await player\.replaceAsync\(safeUrl\)/);
  assert.match(limes, /const savedTime = Number\.isFinite\(player\.currentTime\) \? player\.currentTime : 0/);
  assert.match(limes, /player\.currentTime = savedTime/);
  assert.match(limes, /previousFullscreenRef\.current === isFullscreen/);
  const fullscreenTransition = limes.slice(
    limes.indexOf('if (previousFullscreenRef.current === isFullscreen)'),
    limes.indexOf('automaticRetryCountRef.current = 0;', limes.indexOf('if (previousFullscreenRef.current === isFullscreen)')),
  );
  assert.doesNotMatch(fullscreenTransition, /replaceAsync/);
  assert.match(limes, /type PlaybackSurfaceState = 'preparing' \| 'decoded' \| 'retrying' \| 'error'/);
  assert.match(limes, /decodedGeneration !== surfaceGenerationRef\.current/);
  assert.match(limes, /decodedSurfaceMode !== surfaceMode/);
  assert.match(limes, /key=\{`inline:\$\{surfaceGeneration\}`\}/);
  assert.match(limes, /key=\{`fullscreen:\$\{surfaceGeneration\}`\}/);
  assert.doesNotMatch(limes, /isFrameReady/);
  assert.match(limes, />Video unavailable<\/Text>/);
  assert.match(limes, /accessibilityLabel="Retry Lime video"/);
});

test('Lime pager preserves a poster across recycled Android video surfaces', () => {
  const limes = read('app/(tabs)/Limes.tsx');
  const profileLimes = read('app/profile/limes.tsx');

  assert.match(limes, /removeClippedSubviews=\{false\}/);
  assert.equal((limes.match(/surfaceType="textureView"/g) || []).length, 2);
  assert.match(limes, /previousPlaybackActiveRef/);
  assert.match(limes, /useEventListener\(player, 'playToEnd'/);
  assert.match(limes, /POSTER_REVEAL_HOLD_MS = 900/);
  assert.match(limes, /LEGACY_POSTER_REVEAL_HOLD_MS = 3_500/);
  assert.match(limes, /reel\.legacyLimeMigrationVersion/);
  assert.match(profileLimes, /removeClippedSubviews=\{false\}/);
  assert.match(limes, /const showPoster = surfaceState !== 'decoded' \|\| decodedSurfaceMode !== surfaceMode/);
  assert.match(limes, /Permanent branded base[\s\S]*<LimeVisualPlaceholder isLoading=\{false\} \/>/);
  assert.match(limes, /firstFrameTimedOut = surfaceState !== 'decoded'/);
  assert.match(limes, /surfacePreparedAtRef\.current >= 5_000/);
  assert.match(limes, /shouldLoadVideo \? \([\s\S]*<ReelVideoPlayer[\s\S]*\) : \([\s\S]*<LimeVisualPlaceholder isLoading=\{false\}/);
  assert.match(limes, /showPoster \? \([\s\S]*<LimeVisualPlaceholder isLoading(?:=\{isActive\})? \/>[\s\S]*posterUrl \?/);
});

test('Lime pagers limit every fling to one item', () => {
  const limes = read('app/(tabs)/Limes.tsx');
  const profileLimes = read('app/profile/limes.tsx');

  for (const pager of [limes, profileLimes]) {
    assert.match(pager, /pagingEnabled\s+disableIntervalMomentum\s+showsVerticalScrollIndicator=\{false\}\s+snapToInterval=\{viewportHeight\}/);
    assert.match(pager, /snapToAlignment="start"\s+decelerationRate="fast"/);
  }
});

test('Android Lime activation waits for pager settlement and mounts one decoder', () => {
  const limes = read('app/(tabs)/Limes.tsx');

  assert.doesNotMatch(limes, /onViewableItemsChanged=/);
  assert.match(limes, /const commitSettledPagerIndex = useCallback/);
  assert.match(limes, /onScrollBeginDrag=\{handlePagerDragStart\}/);
  assert.match(limes, /onMomentumScrollEnd=\{handlePagerMomentumEnd\}/);
  assert.match(limes, /isActive=\{playbackAllowed && !pagerScrolling && index === activeIndex\}/);
  assert.match(limes, /Platform\.OS !== 'android' && !pagerScrolling && preloadAdjacentVideos/);
});

test('Lime relationship actions target the displayed author while ownership remains record-based', () => {
  const limes = read('app/(tabs)/Limes.tsx');
  const options = read('components/limes/LimeOptionsSheet.tsx');
  const service = read('lib/services/LimeService.ts');
  const identityService = read('lib/services/LimeIdentityService.ts');
  const resource = read('lib/services/LimeResourceService.ts');
  const types = read('types/userTypes.ts');

  assert.match(types, /authorUserId: string/);
  assert.match(service, /limeIdentityService\.resolveAuthorUserId/);
  assert.match(identityService, /repostedFromUserId\?\.trim\(\)/);
  assert.match(identityService, /embeddedUserId\?\.trim\(\)/);
  assert.match(resource, /authorUserId: reel\.authorUserId \|\| reel\.repostedFrom\?\.userId \|\| reel\.userId/);
  assert.match(limes, /onFollowToggle\(reel\.authorUserId, isFollowing\)/);
  assert.match(limes, /isOwnReel=\{item\.userId === currentUserId\}/);
  assert.match(limes, /isOwnAuthor=\{item\.authorUserId === currentUserId\}/);
  assert.match(options, /relationshipTargetUserId = reel\.authorUserId \|\| reel\.userId/);
  assert.match(options, /onFollowToggle\(relationshipTargetUserId, following\)/);
});

test('Lime action and creator controls use the approved lower compact layout', () => {
  const limes = read('app/(tabs)/Limes.tsx');

  assert.match(limes, /rightSidebar: \{[\s\S]*right: 12,[\s\S]*bottom: 40,[\s\S]*gap: 14,/);
  assert.match(limes, /actionBtn: \{[\s\S]*minWidth: 44,[\s\S]*minHeight: 44,/);
  assert.match(limes, /creatorIdentity: \{[\s\S]*flexShrink: 1,[\s\S]*maxWidth: '55%',/);
  assert.match(limes, /style=\{styles\.creatorIdentity\}/);
  assert.match(limes, /style=\{styles\.creatorName\} numberOfLines=\{1\}/);
});

test('Lime repost attribution is visibly labelled and remains interactive', () => {
  const limes = read('app/(tabs)/Limes.tsx');

  assert.match(limes, />Reposted by<\/Text>/);
  assert.match(limes, /setShowReposters\(true\)/);
  assert.match(limes, /function ReposterAvatar/);
  assert.doesNotMatch(limes, /function FloatingReposterBubble/);
});
