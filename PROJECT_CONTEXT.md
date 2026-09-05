# Ourlime Mobile — Product and Engineering Context

Source audit: **2026-09-04**, current local working trees, not a deployed release.

- Web/API source: `C:\Users\aaron\Github\Ourlime-Web`.
- Native source: `C:\Users\aaron\Github\Ourlime-Web\Ourlime-Mobile`.
- Code inventory is not runtime validation. Earlier “100% Matched” labels were unsupported by comprehensive parity tests and have been removed.
- Scope of this update: routes/manifests, playback, sharing, and moderation/lifecycle entrypoints. Other feature areas below are an inventory, not a renewed end-to-end audit.

## Engineering contracts and runtime

- Service-oriented OOP: domain state, API access, validation, caching, and formatting belong to typed services. Hooks bind lifecycle and player adapters; components bind gestures and presentation.
- No `any`; use concrete `type` contracts and direct React imports. Preserve explicit safe-area edges on headers and existing native navigation behavior.
- The manifest declares Expo `~57.0.15`, Expo Router `~57.0.15`, React `19.2.3`, React Native `0.86.2`, Reanimated `4.5.1`, NativeWind `^4.1.23`, Zustand `^5.0.3`, FlashList `2.0.2`, and expo-video `^57.0.2`. These replace the stale Reanimated 3 description.
- Calling entrypoints: `CallService`, `AgoraCallService`, `NativeCallService`, and `components/calls/GlobalCallOverlay.tsx`. The manifest includes Agora/CallKeep; this does not certify device/lockscreen behavior. Native calling needs the appropriate development/standalone native runtime, not assumed Expo Go compatibility.
- No mock fallbacks should replace canonical product data. Loading, empty, unavailable, and error states must remain explicit.

## Route inventory

Mobile paths below are relative to `app/`; route groups are not public URL segments. Existence is verified; complete Web/Mobile parity is **not** asserted.

| Area | Web entrypoints | Mobile entrypoints |
| --- | --- | --- |
| Feeds/posts | `/`, `/post/[id]` | `(tabs)/index.tsx`, `post/[id].tsx` |
| Limes | `/limes`, `/limes/[id]`, legacy `/lime/[id]` | `(tabs)/Limes.tsx`, `limes/viewer.tsx`, `profile/limes.tsx` |
| Communities/discovery | `/discover`, `/communities` | `(tabs)/Discover.tsx`, `communities/index.tsx`, `communities/[id]/index.tsx` |
| Chat | Chat widget and `/chat` routes | `(tabs)/Chat.tsx`, `chat/index.tsx`, `chat/[id]/index.tsx` (not the old `chat/[id].tsx`) |
| Profiles/search | `/profile`, profile subroutes | `(tabs)/Profile.tsx`, `(tabs)/Search.tsx`, `profile/[username].tsx` |
| Projects | `/projectManagement` | `projectManagement/index.tsx`, `projectManagement/[id]/index.tsx` |
| Learning | `/eLearning` | `eLearning/index.tsx`, `courses/index.tsx`, `courses/[courseId].tsx`, `courses/[courseId]/lesson.tsx`, `cxc.tsx`, `my-learning.tsx` beneath `eLearning/` |
| Hub/wallet | `/ehub`, `/eWallet` | `ehub/index.tsx`, `eWallet/index.tsx` |
| Market/jobs | `/market`, `/jobs` | `market/index.tsx`, `jobs/index.tsx`, `jobs/[id].tsx`, `jobs/manage.tsx`, `jobs/applications.tsx` |
| Events/blogs | `/events`, `/blogs` | `events/index.tsx`, `blogs/index.tsx`, `blogs/[id]/index.tsx` |
| Games | `/games`, `/wordle-game`, `/triniGeoGuesser` | `games/index.tsx`, `wordle-game.tsx`, `triniGeoGuesser/index.tsx` |
| Admin | `/admin`, `/profile/admin` workflows | `admin/index.tsx`, `admin/user-management/index.tsx`, reports, moderation, support, Child Safety, page access, analytics and other `admin/` routes |
| Auth/help/safety | Auth, help and policy routes | `(auth)/login.tsx`, `(auth)/register.tsx`, root password/verification routes, `help/`, `child-safety-standards/`, `delete-account.tsx`, policy routes |

Some native detail workflows use sheets instead of routes. Audit individual actions before claiming parity or implementing gaps.

## Playback interaction ownership (2026-09-04)

- Mobile domain: `lib/services/PlaybackInteractionService.ts`. Web equivalent: `lib/media/PlaybackInteractionService.ts`. A singleton factory creates an isolated `PlaybackSession` per player; one player's drag cannot mutate another's interaction state.
- Contracts: `PlaybackAdapter`, `PlaybackSnapshot`, `PlaybackStatus`, `PlaybackSpeed`. Native `lib/hooks/usePlaybackInteraction.ts` adapts expo-video; Web `components/limes/LimePlaybackControls.tsx` adapts HTML video.
- State: idle → dragging → settling → idle. Drag-preview time is separate from reported time. Stale progress is ignored until two consecutive target acknowledgments (0.35-second tolerance; Web also checks the player's seeking flag), or a 2.5-second timeout produces an explicit retryable error.
- Duration is read at interaction time, not captured at initial render. Seeking is disabled without finite positive duration. Measured track width maps touch/pointer position to clamped time.
- Scrubbing pauses playback. Only a previously playing, still-active player resumes. Cancellation, source replacement, lost visibility, backgrounding and unmount cancel without restarting an off-screen player. Paused players remain paused.
- Feed: `ImageAndVideoPostSection.tsx` measures card width for paging and places `PlaybackSeekBar` flush with the video bottom. A 44-point invisible target ends at that edge; only a thin track is always visible. Scrubbing locks media paging and clears pending taps. Double-tap liking and hold-to-2× stay separate from seeking.
- Limes: the tab measures available viewport height, already excluding bottom navigation. `limes/viewer.tsx` wraps the same screen with a bottom safe inset for chat/deep-link entry. `profile/limes.tsx` reuses `ReelItem` with measured pager height and bottom inset. Captions are above the seek target; controls do not add layout height.
- Web: the track is at the bottom of the existing usable Lime viewport. Pointer capture handles dragging/tapping; Left/Right seek five seconds, Home/End seek endpoints. Accessible slider values/disabled state are exposed. Progress updates stay local to controls, not the whole feed.
- Limes rates: 0.5×, 1×, 1.5×, 2×; selection belongs to the mounted viewer session, default 1× on fresh mount. Holding video for 300 ms temporarily uses 2×. Release restores the selected speed; movement over ten pixels cancels hold. Action/link/seek controls are excluded; holding does not trigger a release tap. Temporary speed ends on deactivation.
- Fullscreen entry retains existing native/browser paths; device-specific transitions still need runtime validation. YouTube and unrelated Web feed controls are outside this change.

## Sharing and covers: entrypoints, not delivery guarantees

- Web `lib/navigation/ShareMetadataService.ts` and `/api/link-preview` resolve authorized canonical content. Unavailable/private/deleted content must not fall through to an unrestricted resolver.
- Web `lib/chat/SharedPostPresentationService.ts` normalizes ordered media, creator/caption, YouTube, location, poll and event details. Hero precedence is first ordered image, otherwise first video/cover; YouTube/location/text provide non-uploaded-media presentations.
- Mobile `OpenGraphService`, `SharedContentMessageService`, `SharedPostPresentationService`, `SharedPostCardStateService`, and `components/chat/SharedPostCard.tsx` consume/present previews. Shared player state coordinates inline playback and thumbnail caching; `DeepLinkService` owns internal navigation URLs.
- Generated share copy/raw internal URLs are not intentional commentary. Preserve separately typed commentary and sender-relative conversation summaries. Lime media cards and rich post cards are distinct from green generic message bubbles.
- Cover entrypoints: `LimeThumbnailService`, `LimeCoverTimelineService`, `components/limes/CreateLimeModal.tsx`. Current native creation validates maximum 30 seconds and 100 MB. Persisted `thumbnailUrl`/`media.thumbnailUrl` provide covers; legacy fallback must be bounded and never substitute a creator avatar as a video cover.
- No message, thumbnail-storage, API or database format changes in this playback task. Prior shared-post/YouTube reports are not claimed resolved by these controls or this documentation audit.

## Moderation and account lifecycle: server-owned

- Mobile `AdminUserService` and `components/admin/UserManagementSection.tsx` expose status/archive/unarchive/permanent deletion, required reasons, operation polling, progress/retry and email state. `AdminUserContentWorkspace` is the managed-user content entrypoint; do not rely on the old blanket claim that every profile has a “Deleted (Admin)” recovery tab.
- Web `lib/admin/userLifecycleService.ts` owns `userLifecycleOperations`, bounded discovery/deletion work, and dedicated reversible `accountLifecycleHiddenAt`, `accountLifecycleStatus`, `accountLifecycleOperationId`, `accountLifecycleReason` fields, separate from content moderation deletion fields.
- Lifecycle start/status/retry: `/api/admin/users/[userId]/lifecycle`; protected processing: `/api/internal/user-lifecycle/process`. Mobile consumes these APIs, not a duplicated server worker.
- Web `lib/moderation/ModerationDeliveryService.ts` owns `moderationDeliveryEvents` and `moderationDeliveryOutbox`, immediate delivery, leases, and retries after 1 minute, 5 minutes, 15 minutes, 1 hour, 6 hours. Processing/retry routes: `/api/internal/moderation-delivery/process`, `/api/admin/moderation-delivery/[eventId]/retry`.
- Mobile reports sent/queued/failed. Actual email arrival, deployed schedules, credentials and production cleanup completeness were not retested in this playback task.
- `AdminSecurityService`/`AdminSecurityWorkspace` and Web `lib/admin/adminSecurityService.ts` are access-control entrypoints. Earlier numerical rate-limit guarantees and “every content menu” coverage were not revalidated; consult current implementations/tests rather than treating those claims as verified policy.

## Validation ledger

### Historical snapshot (document dated 2026-08-29)

The prior document reported TypeScript zero errors, discipline checks over 425 files and `scripts/test-moderation-and-security.cjs` 19/19. These historical claims had no recorded execution date here and are not current evidence of full parity.

### Current task (2026-09-04)

- Mobile `lib/services/PlaybackInteractionService.test.mjs`: 9 passed, 0 failed, 32 assertions.
- Web `lib/media/PlaybackInteractionService.test.ts`: 9 passed, 0 failed, 32 assertions.
- Web `e2e/tests/limes-features.spec.ts`, focused seeking/speed test: passed in `media-desktop` and `media-mobile` (2 product tests plus successful auth setup and cleanup). Covers range-aware real MP4 seeking, keyboard rewind, drag positioning, paused restoration, speed/hold cancellation, short viewport placement and previous-video pause. Initial diagnostic runs exposed a non-range-aware fixture and artifact-teardown hangs; the final clean run passed with failure screenshots retained and video/trace recording disabled for this file.
- Mobile `bun run check`: passed; 482 source files passed discipline checks. There are 20 inherited unused-symbol lint warnings: eLearning (10), blog content (2), YouTube feed preview (2), notifications (1), jobs components (5). No changed-scope lint errors.
- Web `bun run check`: passed (TypeScript and lint; no lint warnings). A diagnostic attempt overlapped fresh `.next-e2e` startup and saw disappearing generated route types; the final sequential check passed. Do not start a new test server while TypeScript is reading those generated files.
- Focused chat-return test in `e2e/tests/limes-features.spec.ts`: **failed before playback**. `ChatWidgetPage.selectConversation` clicked the seeded friend, but the `Message` composer did not appear within 20 seconds; the UI remained at “Select a chat to start messaging.” Auth setup and cleanup passed. No playback control was reached, so Back-to-chat position remains unverified, not a claimed pass or a proven playback regression. The existing chat selection/read-receipt path was inspected but not changed outside this task's scope.
- Android platform tools report no attached device/emulator. No Android runtime validation, build, deployment, migration or git push was performed.

Reproducible checks (from the indicated repository):

```powershell
# Mobile
bun test lib/services/PlaybackInteractionService.test.mjs
bun run check
# Web
bun test lib/media/PlaybackInteractionService.test.ts
bunx playwright test limes-features.spec.ts --config=e2e/playwright.config.ts --project=media-desktop --project=media-mobile --grep="seeks without"
bunx playwright test limes-features.spec.ts --config=e2e/playwright.config.ts --project=media-desktop --grep="returns from"
bun run check
```

Remaining manual acceptance: Android feed forward/back scrubbing and mixed-media paging, Lime drag versus vertical swipe/double-tap/hold, short screens, light/dark themes, fullscreen transitions, and chat-return positioning. Passing service tests does not establish device results.
