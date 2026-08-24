# Ourlime Mobile - Product and Engineering Context

Last audited and updated: 2026-08-23

Web baseline: `C:\Users\aaron\Github\Ourlime-Web` at `9844084`

Mobile source: `C:\Users\aaron\Github\Ourlime-Web\Ourlime-Mobile`

## Scope control

Implementation must stay within the user’s explicit request and an approved plan. Only minimum dependencies and proportionate validation needed for that request are implied. Related improvements should be identified for the user, not implemented without authorization, and unrelated builds, deployments, migrations, git pushes, documentation changes, web work, native work, refactors, or features are out of scope.

The previous latest-28 comparison and the exact seven-commit pulled delta from `793d29c` through `a602674` are in `WEB-MOBILE-LAST-28-COMMIT-AUDIT.md`.

The current route-by-route product audit is `docs/WEB-MOBILE-FULL-PARITY-AUDIT-2026-08-22.md`. Its exhaustive generated source inventory is `docs/WEB-MOBILE-COMPLETE-INVENTORY.json`, produced by `scripts/generate-web-mobile-parity-inventory.cjs`. The inventory currently covers 113 web route/loading/error files, 181 web APIs, 437 web component/source files, 41 web type files, 58 mobile routes, 143 mobile component/source files, 68 mobile services, and 22 mobile type files.

This document describes the current mobile architecture and must not be used to infer blanket 100% web parity. Mobile work is now subject to a strict web-completion gate: if the web behavior is mocked, simulated, inert, backed by a missing API action, or explicitly unfinished, it is excluded from both implementation and planning. If mobile already matches the completed web behavior and rollout state, it is marked matched and removed from the plan. Ads Marketplace, eLearning, profile product management, E-Hub, E-Wallet, generic Games, GeoGuesser, blog authoring, Saved, incomplete Event add-ons, and the incomplete Project workspace remain gated to the web rollout state. Help and Child Safety are enabled on web and mobile.

Wordle is implemented natively behind the same rollout gate as web. Market now covers the completed live web behavior—bounded catalog/search, gallery, stock-aware color/size variants, dynamic pricing, seller context, contact actions, and real chat inquiry—with no mock fallback. The web's console-only wishlist and sample-data `/market/[id]` page are intentionally not mobile tasks.

## Architecture contract

Ourlime Mobile uses Expo Router, TypeScript, NativeWind, Reanimated, Zustand, Firebase, and a service-oriented OOP boundary:

```text
Native screen/component
        -> lifecycle hook / Zustand resource state
        -> singleton domain service
        -> Ourlime API / Firebase / SQLite cache
```

- Business logic, network calls, Firebase queries, caching, validation, and normalization belong in singleton TypeScript services.
- Components are presentation and interaction surfaces.
- Use `type` aliases, direct React imports, zero `any`, concrete data shapes, and descriptive handler names.
- Screens with top headers use `SafeAreaView` from `react-native-safe-area-context` with explicit edges.
- Live resources use bounded stale-while-revalidate caching and must show explicit loading, empty, and error states. Do not add mock fallback arrays.

## Runtime stability and observability

The 2026-08-22 stability pass addressed concrete idle-crash risks:

- Firebase Crashlytics initializes at the root and receives global JS, route-boundary, service, and authenticated-user context.
- The native and Expo configuration both disable the new architecture while the legacy `react-native-callkeep` bridge remains installed.
- Error logs are bounded to 120 entries and long messages/stacks are truncated.
- Auth-profile and OpenGraph caches are bounded; OpenGraph requests are coalesced.
- Background preloads are coalesced and cancelled when the app backgrounds.
- Memory-pressure/background handlers release image and OpenGraph memory.
- Poll countdowns share one app-aware ticker instead of one timer per poll.
- Offscreen videos stop progress polling and do not keep native decoders mounted.

`android:largeHeap="true"` remains a safety cushion, not the primary memory strategy. Crashlytics data will provide native evidence for any future crash that cannot be reproduced locally.

## Current product surfaces

| Surface | Current mobile state |
|---|---|
| Home feeds/posts/polls/events | Live services, pagination/cache, creation, reactions, comments, reposts, reporting, media visibility optimization. |
| Limes | Live vertical feed, creation/upload, comments, likes, shares, repost/remove-repost, follow filters, child-safety reporting. Lime selection now matches the web's MP4/MOV/WebM, 30-second and 100 MB validation contract. Home post comments/replies match the completed web composer with text emojis, verified stickers, categorized GIPHY browsing, and larger GIF previews. The dedicated Limes comment surface keeps the web-complete emoji shortcuts until its web flow supports sticker/GIF payloads. |
| Chat/calls | Live conversations/messages, archive/mute/pin/delete/clear, voice notes, media, reactions, replies, forwards, Agora calls, native push. |
| Notifications | Live paginated inbox and feed modal share filters, unread/read grouping, friend-request responses, selection, chunked bulk read/unread/delete, mark-all-read, refresh, and target-aware navigation. |
| Communities | Live directory/detail, membership/request cancellation, owner/admin request review, member management, events, polls, editing, reports. |
| Profiles/relationships | Live profiles, follow/friend actions, request cancellation, settings, privacy controls, account deletion. |
| Jobs | Live professional and quick-task discovery, creation, server-validated resume applications, applicant-side status history and withdrawal, cached enriched employer management, search/filter/sort, server-valid single and bulk status actions, interview scheduling, private notes, bounded audit history, resume/portfolio access, lifecycle/delete, and disclaimer-protected listing edits. My Applications prefers the web API and uses an ownership-checked Firestore fallback only when that newly added route returns 404 from an older deployment. |
| E-Projects | Live membership list, email-invite claim, inviter attribution, owner attribution, accept/decline, notification routing and project creation exist as an early native core. The route matches the web `coming_soon` default; no detailed workspace is planned while web Invite Cancel/Resend calls unsupported API actions. |
| Market | Live bounded catalog, search, category filtering, pagination, gallery, stock-aware color/size selection, dynamic pricing, seller context, contact actions and real chat inquiry through the OOP `MarketService`; no dummy products or fake fallback arrays. |
| Wordle | Native six-row Trini Wordle with duplicate-letter scoring, lazy full-dictionary validation, keyboard states, help, result and reset. It remains gated to match web rollout. The current web game has no statistics or persistence, so those are not mobile tasks. |
| eLearning | Presentation screens exist; live course authoring/messages/material persistence is not complete. |
| Admin | Native dashboards for analytics, users/lifecycle, moderation/reports, page access, testers, products, communities, categories, and restricted Child Safety cases. |
| Policies/safety | Terms, privacy, policy hub, child-safety standards, Help hub, restricted 13-category child-safety intake, required registration acknowledgment, and permanent account deletion. |
| Authentication/recovery | Native login enforces archived/deleted, banned, suspended, disabled, and beta-access states; supports verification resend, forgot/reset password, beta invitation gating, server-authorized registration start, policy acknowledgements, guardian consent selection, and a branded 404/deep-link recovery route. Secure in-flow identity-document upload and interrupted-registration resume remain open. |

## Theme and link presentation contract

- Jobs discovery, professional/quick-task cards, creation, applications, management, and management sheets use the shared light/dark theme tokens; accent-button foregrounds remain fixed only where required for contrast.
- Standard posts, polls, report previews, create-post location previews, Discover events, Events cards, and community event cards compact long HTTP(S) labels through `LinkPresentationService` while retaining the complete URL as the open/share destination. The comment modal uses `RichTextContent` for its original-post preview, comments, and replies so compact link labels remain tappable; embedded YouTube players stay disabled in the scrolling modal to avoid mounting hidden WebViews.
- URL-valued event/post locations are presented as online locations and open the original link instead of being treated as physical map addresses.
- Post-adjacent Likes, Delete Post, location, and link-preview dialogs use the same active theme as their parent feed.
- User search consumes the web API's `searchVisibility` enforcement and repeats the same privacy check in the bounded Firestore fallback, so an API outage cannot expose users who disabled search visibility.

## Slide-up modal interaction contract

- Reanimated owns slide-up surface motion; the surrounding React Native `Modal` uses `animationType="none"` so native-window movement cannot compete with the live gesture or expose a platform-white transition frame.
- Every slide-up modal exposes a visible top-center drag handle and supports UI-thread downward tracking, velocity/position dismissal, subtle drag scaling/fading, animated handle progress, haptic dismissal commitment, and spring-back when the gesture is cancelled.
- Slide-up modal windows remain transparent/over-full-screen while their animated surfaces stay theme-opaque, so a partial drag reveals the underlying Ourlime route rather than the platform's default white modal background.
- New slide-up surfaces should use `SwipeDismissSurface` or `useSwipeDismiss` plus `SwipeDismissHandle`; the handle owns the gesture so scrolling, buttons, text inputs, media tools, and other content interactions remain responsive.
- `SwipeDismissHandle` establishes a local `GestureHandlerRootView` because each native React Native `Modal` is a separate platform root on Android; the app-level gesture root alone does not reliably activate modal pan gestures.
- Dismiss gestures are disabled while a modal is performing a non-interruptible mutation. Swiping the active-call overlay minimizes the call instead of ending it.
- `ModalMotionSurface` and `ModalBackdrop` provide spring sheet, drawer, dialog zoom, and reduced-motion fade variants for non-draggable overlays. Confirmation, account-deletion, chat action, attachment, navigation drawer, beta application, and game dialogs use these shared motion primitives.

## Social interaction motion and feedback contract

- Social actions use the installed Reanimated and Expo Haptics libraries through `AnimatedActionButton` and `InteractionFeedbackService`; new post, Lime, comment, share, post/publish, and messaging controls should not introduce isolated raw press animations.
- Press feedback runs on the UI thread with a short compression and spring release, respects the operating system's reduced-motion setting, and uses action-appropriate native haptics.
- Server-confirmed comment, post, Lime, forward, inquiry, sticker, and chat-message sends emit success feedback only after persistence succeeds. Newly mounted chat messages and post comments use short Reanimated entrance transitions.
- Tabs use animated focus pills and selection haptics while retaining React Navigation's stable default scene switching. Stack routes use the repository-standard native push/back gesture configuration and keep authentication entry animation-free.
- Navigation menus use spring presentation, staggered item entrances, and tactile buttons; destructive buttons use warning feedback while list/navigation rows avoid distracting rotation.
- Home comment and reply composers use the existing lazy-mounted native emoji/sticker keyboard plus the GIPHY picker. Comment media is normalized by `CommentService` as a typed `sticker | gif` asset; relative web sticker paths resolve to bundled native assets and GIFs retain remote-image rendering.

## Page availability

`PageAccessProvider`, `PageAccessService`, and `PageAccessOverlay` enforce Firestore `pageAccessSettings` in real time. Supported statuses are `enabled`, `coming_soon`, `maintenance`, `beta_only`, `developer_only`, `admin_only`, and `disabled`. A matching `coming_soon` parent takes precedence over an enabled child.

Events, Jobs, Projects, Market, and Wordle now match the web `coming_soon` defaults. Their completed source remains available behind Page Access for administrators and future rollout. A stored Firestore setting can override a default; parent-route precedence still applies.

## Native build and push contract

- Android package and iOS bundle ID: `com.ourlime.app`.
- The installed display name is `Ourlime` (capital O) in Expo/iOS configuration and the committed Android `app_name`; changing the label requires rebuilding/reinstalling the native app.
- Firebase config and `@react-native-firebase/app`, `messaging`, and `crashlytics` plugins must remain aligned.
- Android native FCM tokens are registered for direct Firebase Admin multicast delivery; Expo transport remains available where supported.
- The authenticated web messaging API is the sole push producer for ordinary chat messages. Mobile message persistence must not dispatch a second client push.
- Call signaling uses data-only FCM or APNs VoIP. In the foreground, the root-mounted `GlobalCallOverlay` opens above every route and plays the selected per-device call MP3 or the system ringtone. In the background or from a closed process, Android presents one public call-style notification on the versioned `ourlime-calls-v3` channel with ringtone audio attributes, vibration, Answer/Decline actions, a persistent heads-up surface, and a full-screen intent when the operating system permits it; iOS uses CallKit and its system ringtone.
- All persistent pushes use the flat string-only `NativePushDataV1` contract (`schemaVersion: '1'`) with a destination kind, notification ID, safe internal path, and whitelisted entity identifiers. The web dispatcher defaults missing or invalid targets to `/notifications`, never `/`; mobile continues to normalize legacy payloads already in transit.
- `NotificationNavigationCoordinator` owns notification responses only after authentication initialization and the root navigation state are ready. Cold-start and signed-out responses are persisted for up to 24 hours, replayed exactly once after login, and marked read without delaying navigation. Response IDs and call/action pairs are deduplicated across Expo, FCM/native Android, and CallKeep entry points. Malformed, deleted, inaccessible, and non-actionable targets open `/notifications` instead of the root/splash route.
- Incoming-call payloads and notification actions are queued until authentication and `CallProvider` initialization complete. Live call taps are consumed by `NativeCallService` and open the root-mounted overlay; expired calls fall back to the peer chat or Notifications. Answered calls open the peer chat once after either participant ends the call, while missed, declined, failed, canceled, and unanswered calls do not force navigation.
- Ordinary Android pushes use the versioned `ourlime-messages-v3` channel with default sound, public lock-screen visibility, badges, and vibration. Versioned channel IDs avoid inheriting immutable silent settings from older installed channels. Foreground direct messages play the selected per-device message MP3 once and suppress the duplicate Expo sound; muted and archived chats remain silent.
- Internal chat control markers such as `[SYS:VIDEO_CALL_INVITE]`, `[SYS:VOICE_CALL_INVITE]`, and `[SYS:CALL_ENDED]` are never generic message pushes. The messaging producer suppresses system previews, the central push dispatcher sanitizes or rejects raw system codes, and foreground clients hide codes sent by an older backend.
- Social, relationship, community, project, moderation, and event pushes preserve their domain title/message and route instead of being reformatted as generic chat messages.
- Notification destinations are canonical and entity metadata wins over a broad type: friend request/accepted/declined/follow open the actor profile; post engagement opens the referenced post; comments and replies open comments, resolve the authenticated thread window, collapse unrelated threads, scroll to the target, and highlight it; Lime engagement opens the referenced Lime; project task mentions focus the project/task; messages open the peer chat; live calls open the global overlay and stale calls fall back to chat; community requests/reports open their dashboard workspace; restricted safety alerts open the concrete case; deleted, malformed, inaccessible, or unknown targets fall back to the highlighted notification in Notifications.
- `/notifications` is a safe-area-aware full screen. The feed notification modal exposes **View all notifications**, and both surfaces use the same workspace and server-backed actions. Bulk mutations are chunked to the web API's 100-ID limit and reconcile once after completion.
- Platform-specific legacy call modules stay guarded by platform checks and error boundaries.
- Validate native changes with a development/preview build; Expo Go cannot validate the full Firebase/CallKeep/Crashlytics path.

## Notification sound preferences

- `NotificationSoundPreferenceService` stores separate `system | custom` call and direct-message preferences per device. MP3 imports are limited to 20 MB, copied into app-private storage, recover automatically to system defaults if removed, and can be previewed, stopped, replaced, or reset.
- Arbitrary imported MP3 playback is guaranteed only while the app process is active. Background and terminated notifications use Android notification channels or iOS CallKit/system sounds because arbitrary app-private file access is not portable or safe in those OS states.
- Android foreground custom playback checks ringer mode and Do Not Disturb through the guarded native bridge. iOS custom playback uses `playsInSilentMode: false`. OS notification permission, channel settings, device volume, silent mode, and DND remain authoritative.

## Child Safety contract

- The public intake has exactly 13 typed concern categories, `yes | no | unsure` immediate danger, contextual emergency guidance, explicit good-faith acknowledgement, contact permission, no evidence upload, server-resolved target context, and transactional `CSR-YYYY-NNNNNN` references.
- `childSafetyReports`, nested audit/authority records, `childSafetyReviewers`, `childSafetyPreservations`, counters, and purge audit are denied to all Firestore clients. Administrators and explicitly granted reviewers use authenticated server APIs; ordinary moderators have no access.
- Immediate danger and CSAE, suspected CSAM, grooming, sextortion, or trafficking start critical; all other dedicated reports start high. Hiding content preserves target identifiers under legal hold. No automatic retention deletion or authority submission occurs. Admin purge requires a reason, writes a separate audit record, and is blocked by legal hold.
- Existing ordinary `childSafetyPriority` and `child_safety` reports are migrated non-destructively with `bun run migrate:child-safety` (dry run) and `bun run migrate:child-safety:execute`. Source records are retained.
- Operational details are maintained in `docs/NOTIFICATION_ROUTING.md` and `docs/CHILD_SAFETY_OPERATIONS.md`.

## Verification commands

```powershell
cmd /c "node_modules\.bin\tsc --noEmit"
cmd /c "node_modules\.bin\expo lint"
cmd /c "node scripts\check-discipline.cjs"
cmd /c "node_modules\.bin\expo config --type public"
```

Device crash verification additionally requires an attached device or a new native build so Crashlytics and Android/iOS native logs can be inspected.

### 2026-08-23 verification result

- `bun check` passed after the pulled-commit parity pass: TypeScript, Expo ESLint, and the repository discipline scan completed with zero errors.
- Discipline scan: passed across 394 TypeScript files.
- Mobile focused regression suites: notification routing 21/21 and notification-sound validation 2/2 passed. Web notification routing passed 24/24, and child-safety rule validation passed 3/3, including all 13 categories, automatic critical priority, and yearly reference formatting.
- Web validation: `bun check` passed and the Next.js production build completed all 227 routes.
- Android release validation: `bun run build:local` completed successfully and produced `android/app/build/outputs/apk/release/app-release.apk`.
- Android Metro export: passed with 4,421 modules and 86 assets bundled into the final release APK.
- Expo dependency patch versions: aligned with SDK 57 through Bun.
- Expo Doctor: 19/21. It still reports Bun-installed duplicate copies of the same `expo-constants@57.0.13` and `expo-file-system@57.0.5` versions after forced and hoisted reinstalls, plus the known CallKeep/VoIP New Architecture metadata warning. The app intentionally keeps New Architecture disabled until those legacy call modules are replaced or certified.
