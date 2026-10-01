const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (relativePath) => fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');

test('profile Limes show authored content while reposts use their own data path', () => {
  const limesTab = read('components/profile/LimesTab.tsx');
  const limeViewer = read('app/profile/limes.tsx');
  const repostsTab = read('components/profile/ProfileRepostsTab.tsx');

  assert.match(limesTab, /limeService\.fetchUserReels\(userId\)/);
  assert.doesNotMatch(limesTab, /fetchUserAndRepostedReels/);
  assert.match(limeViewer, /limeService\.fetchUserReels\(targetUserId\)/);
  assert.doesNotMatch(limeViewer, /fetchUserAndRepostedReels/);
  assert.match(repostsTab, /limeService\.fetchUserRepostedLimes\(userId\)/);
  assert.match(repostsTab, /Reposted Limes unavailable/);
});

test('GIF picker labels and comment media preserve readable uncropped content', () => {
  const picker = read('components/comments/GifPickerModal.tsx');
  const comments = read('components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal.tsx');

  assert.match(picker, /maxFontSizeMultiplier=\{1\.15\}/);
  assert.match(picker, /minHeight: 38/);
  assert.doesNotMatch(comments, /contentFit=\{(?:reply|comment|selectedMedia)\.sticker\.type === 'gif' \? 'cover' : 'contain'\}/);
  assert.match(comments, /contentFit="contain"/);
});

test('profile editing and Lime cover selection expose keyboard-safe and Finish actions', () => {
  const profileEditor = read('components/profile/EditProfileModal.tsx');
  const coverEditor = read('components/media/VideoThumbnailPicker.tsx');
  const limeCreator = read('components/limes/CreateLimeModal.tsx');
  const appConfig = read('app.json');

  assert.match(profileEditor, /KeyboardAvoidingView/);
  assert.match(profileEditor, /behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/);
  assert.match(profileEditor, /keyboardShouldPersistTaps="handled"/);
  assert.match(profileEditor, /automaticallyAdjustKeyboardInsets=\{Platform\.OS === 'ios'\}/);
  assert.doesNotMatch(profileEditor, /keyboardHeight/);
  assert.match(coverEditor, />Finish<\/Text>/);
  assert.match(coverEditor, /openEditorOnMount\?: boolean/);
  assert.match(coverEditor, /Choose the frame people see before playback\./);
  assert.match(limeCreator, /type LimeVideoConfirmationModalProps/);
  assert.match(limeCreator, /setPendingAsset\(asset\)/);
  assert.match(limeCreator, /accessibilityLabel="Finish selecting Lime video"/);
  assert.match(limeCreator, /setSelectedAsset\(pendingAsset\)/);
  assert.match(limeCreator, /A video cover is required before posting a Lime/);
  assert.match(limeCreator, /<VideoThumbnailPicker[\s\S]*openEditorOnMount/);
  assert.match(appConfig, /"orientation": "default"/);
});

test('profile Gallery uses authored cached posts with stable loading and retry states', () => {
  const gallery = read('components/profile/GalleryTab.tsx');

  assert.match(gallery, /filter: 'all', authorId: userId/);
  assert.match(gallery, /profileGalleryService\.selectGalleryMedia/);
  assert.match(gallery, /GALLERY_SKELETON_ITEMS/);
  assert.match(gallery, /Loading profile gallery/);
  assert.match(gallery, /Showing saved media\. Tap to retry refresh\./);
  assert.match(gallery, /No photos or videos shared yet/);
});
