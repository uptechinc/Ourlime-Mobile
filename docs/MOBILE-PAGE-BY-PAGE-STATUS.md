# Ourlime Mobile — Page-by-Page Implementation Status

Updated: 2026-08-14

This is the current source-level status of every mobile page. **Done** means implemented in source; it does not claim deployed API, Firestore-rule, physical-device, or manual authenticated verification. `Coming Soon` pages are intentionally protected rather than presented as finished features.

Detailed Profile and Communities evidence and requirements: [`PROFILE-COMMUNITIES-WEB-MOBILE-PARITY-AUDIT.md`](PROFILE-COMMUNITIES-WEB-MOBILE-PARITY-AUDIT.md).

## Global application shell — `app/_layout.tsx`, `app/(tabs)/_layout.tsx`

- Done
  - Expo Router root stack with native slide navigation and safe-area screen conventions.
  - Firebase Auth persistence through AsyncStorage.
  - Typed navigation registry, page-availability policy, role normalization, protected route overlay, and developer preview badges.
  - Shared app-data coordinator with user-scoped SQLite hydration, foreground/background listener lifecycle, notification invalidation, token retry, and logout cache isolation.
  - Persistent image loading through `expo-image` and private SQLite cache through `expo-sqlite`.
- Still to do
  - Manually verify every account role, nested page-access status, deep-link back stack, and auth-guard edge case.
  - Correct the route-guard public-route normalization identified in the parity audit.

## Login — `app/(auth)/login.tsx`

- Done
  - Firebase email/password authentication, typed error mapping, account-status handling, navigation to registration and password recovery.
  - AsyncStorage-backed session persistence.
- Still to do
  - Manually validate all Firebase error/account lifecycle combinations and native keyboard behavior.

## Registration — `app/(auth)/register.tsx`

- Done
  - Typed multi-step registration flow, profile fields, registration assets, and Firebase account creation.
  - Existing registration validation and routing to verification/legal surfaces.
- Still to do
  - Complete all web registration variants and manual permission/error recovery.
  - Confirm registration avatar assets and server-side registration policy against the deployed backend.

## Password recovery, verification, and legal — `forgot-password.tsx`, `reset-password.tsx`, `verify-email.tsx`, `terms-and-conditions.tsx`, `privacy-policy.tsx`

- Done
  - Forgot-password request, reset-code validation, password reset, verification resend/result states, and typed `ourlime` deep links.
  - Native Terms and Privacy routes with the canonical web content.
- Still to do
  - Manually validate expired/invalid action codes and real email deep-link return behavior.

## Home feed — `app/(tabs)/index.tsx`, `components/home/MiddleSection`

- Done
  - Live `home`, `friends`, and `communities` feed scopes; all, photo, video, sound, poll, and event filters.
  - Cursor pagination, pull-to-refresh, skeleton, empty, error, retry, end-of-feed, and no-mock-data states.
  - User-scoped SQLite feed snapshots, shared in-memory resources, request deduplication, scope/filter preservation, scroll restoration, offline retained content, and a non-jumping New Posts pill.
  - Native feed card containers for regular, repost, poll, and event posts; author identity, avatar fallback, verification/role badges, timestamps, media, video visibility, maps/directions, likes, comments, shares, reposts, relationships, reporting, blocking, deletion, and visibility changes.
  - Home composer with text/details, media picker, crop presets/zoom, five-media cap, uploads/progress/cancel, hashtags, mentions, location/GPS/search, polls, optional poll image, validation, and authoritative post prepend.
  - Comments/replies with pagination, creation/editing, likes, deletion, and cache patching.
- Still to do
  - Fullscreen/pinch media viewer, inline YouTube playback, hashtag navigation, and richer sound/audio behavior.
  - Comment/reply report actions, tappable comment authors, and comment mention suggestions/navigation.
  - Finish Feeling/emoji/event/poll/location quick-action parity and refine post typography/content order against web manually.
  - Add promoted Home carousel, game cards, notification pagination, suggestion request cancellation, and drawer account-status/count refinements.
  - Manually validate deployed scope isolation, visibility, uploads, offline reconciliation, and all destructive/moderation actions.

## Notifications — Home modal and global notification provider

- Done
  - Live unread state, category filters, unread/newest sorting, read visibility, select-all, bulk read/unread/delete, mark-all-read, and friend-request actions.
  - Typed push token registration/unregistration and typed notification destinations.
  - Foreground push notifications invalidate relevant chat/feed/profile resources.
- Still to do
  - Dedicated full-screen notification history route and bounded pagination.
  - Manually verify notification permissions, Android/iOS delivery, background taps, and every destination.

## Search — `app/(tabs)/Search.tsx`

- Done
  - Debounced live user search, avatar/name/username rows, error/empty/refresh states, and profile navigation.
  - Multi-category search filter tabs (**People**, **Communities**, **Events**, **Jobs**) with responsive design and theme adaptation.
  - Direct **Add Friend** / **Sent** action buttons on user search rows integrated with `RelationshipService`.
- Still to do
  - Add typed tabs and pagination for posts, blogs, market, and Limes; recent history and highlighted results.

## Discover — `app/(tabs)/Discover.tsx`

- Done
  - Live people recommendations and service-backed community, event, and job modules with page-access-aware states.
- Still to do
  - Global multi-entity search, deeper filters, recent history, and independent bounded pagination.
  - Complete manual verification for Join Community, Apply, and discovery recommendation mutations.

## Limes — `app/(tabs)/Limes.tsx`

- Done
  - Existing vertical feed, creation, media upload, likes, comments/replies, follow/share, visibility, mute/pause, and video interaction source work remains available.
- Still to do
  - This domain is explicitly outside the instant-loading pass.
  - Move remaining route/component Firebase work fully behind `LimeService`; add/report/delete parity, deep links, view tracking, pagination, transcoding/thumbnails, and device QA.

## Chat list — `app/(tabs)/Chat.tsx`, `lib/services/ConversationResourceService.ts`

- Done
  - Disk-first conversation display with a shared resource above navigation and up to 200 user-scoped cached summaries.
  - Server-written conversation summaries, newest-50 foreground listener, realtime reorder/preview/unread updates, accepted-friend summary creation, missing-summary reconciliation, search, retry, pull-to-refresh, and older-summary pagination.
  - Avatar fallback and cached avatar rendering through shared profile-image resolution.
- Still to do
  - Typing/presence refinement, archive/pin state, Business/Discover conversation tabs, and manual foreground/background/offline verification.

## Chat detail — `app/chat/[id]/index.tsx`, `lib/services/MessageResourceService.ts`

- Done
  - Cached latest 30 messages render before network reconciliation; cache retains up to 100 messages for the most recent 30 conversations.
  - Cursor-based older-message loading, realtime message-head subscription, optimistic text/attachment send, authenticated read updates, and clear-chat local isolation.
  - Authenticated server send path dual-writes legacy chat metadata and `chats/{chatId}/messages` documents; reads use message documents with legacy-array fallback.
  - Text, attachments, stickers, voice-note URLs, replies, forwarding, reactions, delete-for-me/delete-for-everyone, edit rules, shared content panels, link previews, block/remove friend, and global authenticated Agora call UI source work.
  - Idempotent non-executed migration utility exists at `Ourlime-Web/scripts/migrateChatMessages.ts`.
- Still to do
  - Durable offline outbox, delivery receipts, typing, native voice recording/playback controls, and attachment retry/recovery. Native call signaling/permissions are implemented in source but require signed builds, deployed APIs, credentials, and multi-device manual verification.
  - Deploy server APIs/rules before relying on the new contract, then manually validate dual-read/dual-write behavior and clear-chat semantics.

## Own profile — `app/(tabs)/Profile.tsx`

- Done
  - Shared disk-first own profile summary with five-minute revalidation, profile counts, header/cover/avatar, edit profile, Timeline, searchable Friends, About, Gallery, conditional Admin tab, settings, drawer, error/refresh states.
  - Profile edits immediately patch own summary and cached feed author records; cached images cover avatar, cover, gallery, and feed assets.
  - Timeline/gallery reuse author-scoped feed resources rather than independent duplicate fetches.
  - Avatar/cover selection uses native cropping and `ProfileMediaService`; it uploads to Storage, writes web-compatible `profileImages`/`profileImageSetAs` assignments, updates the user record, and patches caches. Required rules are changed in source but not deployed.
  - Native profile sharing is wired. The nonfunctional Customize palette control is hidden.
- Still to do
  - Reposts, Profile Customization, mutual-friend counts, relationship next-page controls, full albums/gallery ownership, products/jobs/business account routes, and complete About/privacy fields.
  - Multiple cover images, ordering, gradients, remove/delete, unused-media cleanup, upload progress/recovery, and propagation to comments/chat/community rows.
  - Deploy adjacent Storage/Firestore rules and manually verify avatar/cover persistence and propagation everywhere.

## Other-user profile — `app/profile/[username].tsx`

- Done
  - Cached public profile by normalized username/UID, privacy-aware details, cover/avatar, timeline/about/gallery, follow/friend/message controls, block/unblock/report behavior, and visible friends/communities.
  - Own Friends loads accepted Firestore relationship records plus canonical profile-image selections directly, avoiding dependence on the optional LAN web API; privacy-aware other-user friend graphs remain server-owned.
  - Cached profile content stays visible during revalidation failure with retry affordance.
- Still to do
  - Deeper follower/following/community sliders, full privacy-tab behavior, share depth, and manual block/relationship verification.

## Settings — `app/settings/index.tsx`

- Done
  - Typed service-backed account, appearance, notifications, privacy, security, and blocked-user reads/writes using canonical `users/{uid}/userSettings/*` records without requiring the unavailable LAN API.
  - System/Light/Dark selection is applied above navigation. System is the default and follows live phone appearance changes; the preference is saved locally and to the appearance document. Components consume semantic colors directly, with no global style preprocessor or theme-keyed Stack/Tab remount.
  - Feed composer/scopes/filters/cards/polls, Discover sections/cards/search, Search results, Chat lists/composer, Profile shell/tabs, Communities lists/filters, shared skeletons, the active Home drawer, Admin tabs/user filters, shared page headers, and Jobs now use explicit semantic surfaces and contrast-safe selected states in both themes.
  - Profile/activity/search visibility, message permissions, data-sharing choices, granular notification choices, security alerts, blocked-user removal, save/sign-out, and custom modal states.
- Still to do
  - Secure 2FA enrollment/disable, password change with reauthentication, connected accounts, session/activity logs, export, and account deletion.
  - Continue replacing legacy hard-coded neutrals in older future-domain forms and secondary modals. There is intentionally no global compatibility bridge; route-reachable components must subscribe to `useAppTheme()`.
  - Deploy the adjacent nested `userSettings` Firestore rule and manually verify each preference is consumed by Search, Chat, notifications, presence, and profile privacy.

## Communities list — `app/communities/index.tsx`

- Done
  - Canonical authenticated directory API and OOP resource service cover Community of the Week, All/Joined/Joined by Friends/New/Created, public/private, live category, debounced search, Popular/Newest/Active/Trending, result totals, opaque cursor paging, pull-to-refresh, grid/list mode, cached SWR, empty/error/retry, and no mock fallback.
  - Native filter hierarchy is consolidated: visible Browse scopes, one Filters & Sort control, active-filter count/removable summaries, result count, and grid/list toggle. Visibility, category, and sort choices live in one themed sheet with Apply/Reset instead of several competing horizontal rows.
  - Every shared card carries banner/fallback, category/privacy/verification, creator/selected avatar, description, member/like/post totals, top members, friends-here context, canonical slug, role/membership/access state, and permission-derived View/Join/Request Again/Cancel/Leave/Pending/Owner/Member/Banned actions.
  - The zero-member defect is corrected server-side: count documents are batched from `communityVariantMembershipAndLikeCount`, while missing/invalid/stale-zero values are derived from unique active memberships plus the creator.
  - Create is server-owned and includes name/slug availability/suggestions, 3:1 picker crop, Storage upload/progress, optional image URL, live category, privacy, verification-only membership, posting policy, preview/remove, naming notice, and terms acceptance.
  - Join/request/cancel/leave and community-like mutations are deterministic transactions returning authoritative counts. All directory cache keys and Discover copies are patched after mutation/deletion.
  - Visible first-page loads use foreground health probing, background preloads retain background priority, and those in-flight requests are isolated. A rejected startup preload can no longer force the screen into an API-unavailable state that only Retry repairs; background refresh also no longer drives the pull-to-refresh spinner.
- Still to do
  - Deploy the adjacent community APIs and manually verify every public/private/owner/moderator/site-admin/member/pending/declined/banned card state. Source completion is not runtime verification.
  - Honor future Admin category ordering/paging if that canonical contract grows beyond the currently bounded live category collection.

## Community detail — `app/communities/[id]/index.tsx`

- Done
  - Cached detail/header with banner, title/description, category/privacy/verification, creator avatar/name, created date, authoritative counts, filled like, share/report, join/request/cancel/leave, role, edit, dashboard/moderation, and server cascade delete.
  - Posts reuse community-origin post cards, media, likes/lists, comments/replies, selectable report reasons, author/moderator server-cascade deletion, community identity, authoritative counter updates, and cross-feed/detail cache reconciliation.
  - Live Events support create/edit/delete, image/video upload, recurrence, attendance state/count, authenticated reporting, server role checks, refresh/error/empty states, and custom confirmation. Live Polls support two-to-five options, duration, single/multiple voting, results, expiry, report/delete permissions, and reconciliation.
  - About includes category/privacy/verification/posting policy/rules/date/counts. Members include server search, cursor paging, canonical selected avatars, roles, friends/presence, profile links, and confirmed role/remove/ban bottom-sheet actions.
  - Owner/moderator dashboard includes Overview, Members, Requests, Activity, Reports, search/status filters, approve/decline, role management, assign/dismiss/resolve/hide actions, and authenticated content/report ownership checks. Dashboard/member/request resources now preload concurrently when the modal opens; Activity and Reports reuse the dashboard result, and every tab has an explicit force-refresh control.
  - Dashboard X/Android back dismissal and all five workspace tabs use a full-screen native modal with stable callbacks and reset-on-close state. The slug-page Host Event and Create Poll shortcuts open their real composer; Create Post, Share Invite, tabs, header actions, member tools, moderation actions, event reporting, and destructive confirmations are wired to typed handlers.
  - Community Create Post now uses live semantic Light/Dark/System tokens for its modal, inputs, chips, media controls, and contrast-safe Post button.
  - Create/edit use the same core fields, availability check, banner crop/upload/remove, rules, semantic Light/Dark/System tokens, and modern modal UX. The legacy mock detail/event/poll components and competing misspelled service were removed.
- Still to do
  - Replace Share Invite with searchable friend selection and authenticated invite-message delivery. Canonical shared links already open the exact native community.
  - Add community event likes and event discussions/replies, plus dedicated native date/time/map controls. Current event attendance and media are live.
  - Community, post, event, and poll reports now use selectable categories, reasons, and details. Evidence attachments remain post-only.
  - Add mobile multi-select for bounded dashboard bulk report operations and deeper activity preview/navigation.
  - Clean up superseded Storage objects after banner/event replacement or community deletion, and manually verify every permission/state combination.
  - External: deploy web APIs/rules, reconcile production counters if desired, and perform physical-device/manual acceptance. No automated checks were run.

## Events — `app/events/index.tsx`

- Done
  - Existing event list/create/like/RSVP shell remains reachable only according to page access.
  - Coming Soon and other unavailable states render a blocking dark-glass modal above the route, matching the web interaction instead of exposing the underlying prototype page.
  - Events and all bundled future routes are blocked immediately from canonical defaults even while remote page-access/profile subscriptions are still hydrating.
- Still to do
  - Replace the prototype event comments/local reply behavior and complete detail, ticketing, review, calendar, and owner workflows before enabling full product status.

## Jobs — `app/jobs/index.tsx`

- Done
  - Existing browse/create shell is protected by canonical availability settings.
  - Category paging uses a native horizontal `ScrollView`; the Fabric-crashing `react-native-swiper` dependency is no longer used by the page.
- Still to do
  - Replace simulated job application/upload flow, connect all visible actions, add saved/detail/employer management, and hide incomplete controls until live.

## Market — `app/market/index.tsx`

- Done
  - Existing browse/filter service shell and canonical Coming Soon/page-access protection.
- Still to do
  - Product permalink, ownership/create/edit/delete, checkout/seller workflows, and removal of prototype behavior before enabling broadly.

## Blogs — `app/blogs/index.tsx`, `app/blogs/[id]/index.tsx`

- Done
  - Existing list/detail read surfaces and availability protection.
- Still to do
  - Replace simulated Create Blog success path, complete ownership/social actions, pagination, and rich creation workflow.

## E-Learning — `app/eLearning/index.tsx`

- Done
  - Canonical Coming Soon/page-access protection keeps prototype material from being represented as a completed product.
- Still to do
  - Replace static/local schedules and complete the web course, lesson, quiz, assignment, grade, discussion, instructor, and CXC route family.

## Admin — `app/admin/index.tsx` and `app/admin/*`

- Done
  - All twelve canonical web admin destinations now render native workspaces instead of an “Admin Overview” handoff: dashboard, analytics, user management, testers, stickers, reports, products, page access, moderation, community categories, marketplace categories, and communities.
  - Authenticated role-gated metrics; live user search; status/role/account filters; pagination; CSV sharing; role, account status, verification, archive/restore/permanent-delete workflows; and self-protection rules.
  - Report status/severity/search filters, report-detail slug routing, the web moderation action set, required reason/duration inputs, and secure server mutations.
  - Page-access Pages/Activity Log tabs, full overlay/navigation/preview/button editor, bulk status changes, initialize/reset defaults, and global route enforcement.
  - Tester registration modes, lifecycle tabs, applications/invitations/testers, notes/status mutations, and secure tester invitation creation.
  - Live products, communities, categories, sticker packs/assets, and aggregate analytics with native loading, empty, error, refresh, filter, detail, and action states.
  - Shared authorization result controls admin navigation and rendering; services own Firestore/API contracts and server APIs remain the boundary for privileged Auth, moderation, tester email, and lifecycle operations.
- Still to do
  - Add web-equivalent analytics date ranges/trends/route breakdowns, complete sticker pack/sticker create/edit/seed forms, deepen product/community-specific field controls, and add secure user import.
  - Add a moderator-specific shell if moderators should enter reports without full administrator access.
  - Deploy the checked-in Firestore rules and reachable web APIs before runtime verification; the agent did not deploy them.
  - Manually verify every role mutation, lifecycle action, page-setting precedence, and authorization failure.

## Post detail and Not Found — `app/post/[id].tsx`, `app/+not-found.tsx`

- Done
  - Minimal post route and branded native fallback route exist.
- Still to do
  - Full permalink post detail/comments/share parity and stronger recovery/navigation treatment.

## Intentionally protected future domains

### Ads — `app/ads`, `app/ads/create`, `app/ads/manage`

- Done
  - Valid canonical Coming Soon routes and page-access protection.
- Still to do
  - Booking, payment, proof, reviews, host/offers, and admin workflows.

### Wallet, Saved, Games, GeoGuesser, Wordle, E-Hub, Help, and Project Management

- Routes: `app/eWallet`, `app/saved`, `app/games`, `app/triniGeoGuesser`, `app/wordle-game`, `app/ehub`, `app/help`, `app/projectManagement`.
- Done
  - Canonical Coming Soon routes, navigation status/badges, and global route protection.
- Still to do
  - Complete service-backed product definitions and live workflows before enabling any route.

## Cross-page release work still required

### 2026-08-13 instant-loading implementation

- Done in source — Home: active feed loading delegates to `FeedResourceService`; each user/scope/filter has an independent SQLite/Zustand resource, a 60-second stale threshold, and 48-hour retention.
- Done in source — Home filters: Home/Friends/Communities `All` pages preload first and seed Photos/Videos/Sound/Polls/Events snapshots. Authoritative filter reconciliation runs later at background priority.
- Done in source — Community feed: joined-community posts come from canonical `communityVariantDetails` and include navigable community identity fields.
- Done in source — Discover: suggested friends, communities, events, and jobs hydrate from one shared resource with independent section statuses and retained successful sections.
- Done in source — Communities: cached directory/categories render during refresh and Friends-filter loading; failures exit loading and preserve stale content.
- Done in source — Chat detail: FlashList v2 starts from the newest message, preserves position when older messages prepend, and displays a New Messages affordance when the reader is away from the bottom.
- Done in source — Chat theme: primary message text, incoming surfaces, header, composer, timestamps, actions, and attachment UI use semantic light/dark/system colors.
- Done in source — Preload lifecycle: Home starts first; a permission-aware two-worker queue preloads enabled metadata and cancels on background/logout. Coming Soon/disabled routes are excluded.
- Partial — Admin/Profile/Chat summaries already have shared services and are included through their existing startup hydrators. Additional per-workspace Admin preload adapters remain unnecessary until manual profiling proves overview hydration insufficient.
- Interaction-only by design — arbitrary search text and unknown detail IDs are not globally downloaded; recent/parent-visible destinations remain the bounded strategy.
- Manual verification pending — all device acceptance scenarios; no automated checks were run per project policy.
- External — deploy the adjacent web feed API update before validating Communities-scope parity in a released app.

### 2026-08-13 stabilization evidence

- Feed/Post interactions: server-backed comment, like, share, and repost operations remain canonical; Android local-API traffic is now enabled for development builds and network failures are typed rather than exposed as raw Java exceptions.
- Comments: composer/edit/reply inputs have explicit semantic theme colors; posting still requires a reachable authenticated web API because moderation and notification rules must not be bypassed with insecure client writes.
- Communities: detail reads recover through Firestore on a typed timeout/network failure; secure membership and moderation mutations remain authenticated API operations.
- Chat: only the bounded modern Firestore message head is observed in realtime; the authenticated cursor API provides bounded legacy fallback. Root call pushes resolve to the global coordinator and unanswered ringing expires at 45 seconds.
- Notifications: foreground presentation and tap routing are wired; physical-device push requires notification permission, a registered Expo token, a custom development/release build, and deployment of the updated web endpoint.
- Profile: own Posts/Friends/Followers/Following totals now recover from canonical Firestore records when network-stat enrichment cannot reach the API.
- Navigation: bottom tabs use the actual device bottom inset and no longer occupy the Android system-navigation touch region.
- Validation: implementation was source-reviewed only. Per project direction, no TypeScript, lint, Metro, automated, browser, build, or device checks were run by the agent.
- Follow-up: verified the configured LAN IP still belonged to the development machine, while TCP port 3000 had no listener. Added the combined `npm run dev:full` workflow and started the local web API with logs under `Ourlime-Web/logs/`.
- Follow-up: comment/reply and community-post reads use API-first, typed Firestore recovery. Protected comment, like, share, and repost writes remain authenticated server operations; `npm run dev:full` prevents local development from starting without that server.
- Follow-up: Chat initially opens at the latest measured message, does not jump down after older-message pagination, and reserves the live Android bottom inset for its composer. Shared bottom sheets and the comments composer use the same inset policy.

### 2026-08-13 chat, reactions, drawer, notifications, relationships, and presence milestone

- Done in source — Chat detail uses chronological FlashList bottom-first rendering with no `scrollToEnd`, timeout, animation-frame, or content-size scrolling. Older 30-message pages load automatically at the top with a compact spinner/retry state; prepends preserve visible content; optimistic sends do not invoke scrolling; the New Messages action uses guarded `scrollToIndex` only after list readiness.
- Done in source — Community posts carry explicit `origin: 'community'`. Community detail and Communities feed normalize authoritative counter/viewer-like/author/media/community fields. Desired-state likes authenticate the viewer, deduplicate legacy like documents, clamp counters at zero, preserve other users in `likedUserIds`, return `{ liked, likeCount }`, and patch feed/detail entities. Community likes lists read the community like collection.
- Done in source — `AppDrawerProvider` is mounted above routes and owns `closed | opening | open | closing`. Feed and Profile reuse it; first-tap opening is atomic, duplicate interaction is disabled during transitions, all close paths converge, and navigation waits for the closing animation.
- Done in source — Notifications use canonical `/api/notifications` pages and the server unread count, hydrate the latest bounded page from user-scoped SQLite, and observe `userNotifications/{uid}/items` only as an invalidation signal. Server-backed read/unread/read-all/delete and authenticated friend-request actions are wired.
- Done in source — Inbox types cover friend request/accepted/declined, follow, like/comment/repost/mention, community invite/report/accepted/rejected/removed, role/report actions, and beta management. Message/voice/video remain push-only. Typed destinations cover chat, post, profile, community, Limes, and authorized Admin fallbacks; background and cold-start response IDs are deduplicated.
- Done in source — Own Profile has a shared cached relationship hub for Friends, Requests, Active, Following, Followers, and Suggestions. Incoming requests show Accept/Decline; outgoing requests show Cancel; relationship actions invalidate all sections.
- Done in source — Web and mobile send foreground heartbeats every 60 seconds, immediate online updates, and best-effort offline updates. The server uses timestamps, a two-minute stale cutoff, and Activity Status privacy. Presence is included in relationship cards, chat summaries, and chat headers.
- Done in source — community detail now hydrates its viewer/community-keyed post snapshot from SQLite, keeps cached content visible during revalidation failures, and shares post patches/removals/creation with normalized Home/Communities feed resources.
- Done in source — relationship-hub mutual counts are batch-derived from accepted friendship graphs rather than per-card requests.
- Still to do — add cursor pagination to the community-detail snapshot and manually verify multi-client presence and every reaction/cache reconciliation path. Notification history paginates automatically near the modal end, while each relationship section exposes bounded Load more.
- External/manual — remote push cannot be verified in Expo Go. A reachable deployed API plus signed Expo development/production build is required for lockscreen delivery, invalid-token cleanup, and foreground/background/cold-start acceptance.
- Validation note — per project instruction, no tests, TypeScript check, lint, Metro, browser/device automation, build, deployment, or migration was run for this milestone.
- Follow-up: Event-post Attend/Attending state now follows the live verified Firebase user and the shared web `eventAttendees` contract instead of relying on a one-time UI auth snapshot.
- Follow-up: Initial chat positioning remains pinned to the newest message through the layout-settling window, including late media sizing, unless the user intentionally starts scrolling.
- Follow-up: liked regular/poll posts render a filled red heart. Post, profile, community, blog, Lime, event, job, market-product, and authorized-report shares use canonical HTTPS routes claimed by the app, with an `ourlime://` mobile-web banner fallback.
- External app-link release work: configure the Android signing SHA-256 fingerprint and Apple Team ID in the deployed web environment, deploy Ourlime-Web, and create a new signed native build. Until that happens, canonical URLs truthfully fall back to web and the banner can still invoke the custom scheme.

### 2026-08-13 native calling, stable chat history, requests, and themes

- Done in source — Calling: mobile and web share authenticated call sessions, participant-bound Agora credentials, opaque channels, first-answer-wins device IDs, a 45-second expiry, and typed terminal reasons. Server checks authentication, friendship, blocks, participation, state, expiry, and allowed actor for every transition.
- Done in source — Native incoming calls: the mobile root coordinator registers distinct Android FCM and iOS APNs VoIP device transports. CallKeep/Telecom/CallKit display system Answer/Decline UI; PushKit reporting is configured before the iOS JS bridge; Android has an entrypoint background handler and calling foreground/full-screen permissions.
- Done in source — Active call UX: the obsolete preview-only chat modal was removed. One global call screen owns Agora audio/video, mute, speaker, camera enable/disable, camera flip, minimize/restore, remote participant state, and terminal cleanup.
- Done in source — Chat history: the full legacy chat-array listener was removed. The screen observes only the newest message-subcollection window and uses the authenticated cursor API for bounded legacy fallback. FlashList remounts once when the first populated snapshot arrives, preventing a long chat from retaining an empty initial layout.
- Done in source — Requests: Profile Friends -> Requests defaults to Incoming and provides independent Incoming/Outgoing SQLite/Zustand keys, server search, pagination, refresh, and mutation invalidation. Accept/Decline are incoming-only; Cancel is outgoing-only; private request/suggestion sections are hidden on public profiles.
- Partial — Themes: expanded semantic tokens and direct `useAppTheme()` subscriptions now cover navigation, Profile About/Friends, Chat, global calls, legal screens, drawers, settings, feeds, communities, and core Admin surfaces without navigator remounts. Older future-domain forms and secondary modals still contain hard-coded neutral colors and remain a route-by-route remediation item.
- External/manual — Expo Go cannot provide Agora, CallKit, PushKit, Android Telecom, or terminated-app remote call verification. Configure native credentials/entitlements, deploy the web APIs and participant-read/server-write `calls` Firestore rule, produce signed native builds, and manually verify Android/iOS/web calls, lock-screen behavior, audio routes, DND limitations, 45-second timeout, chat anchoring, requests, and theme contrast.
- Validation note — No tests, TypeScript checks, lint, Metro, builds, deployments, migrations, browser automation, or device automation were run by the agent.

### 2026-08-14 API availability and universal links

- Done in source — Local startup: `dev:full` discovers the LAN address, binds and starts Ourlime-Web, waits for `/api/health`, then launches Expo with the reachable URL. It no longer starts the app while port 3000 is unavailable.
- Done in source — API outages: one shared availability probe and backoff prevents notifications, conversations, activity, and relationship resources from producing independent eight-second timeouts. Existing snapshots remain visible and manual foreground retries can probe recovery.
- Done in source — Notifications: cache hydration and the invalidation listener share one refresh operation; the listener's initial snapshot does not duplicate the initial API request.
- Done in source — Link inventory: Post, Profile, Community, Blog, Lime, Event, Job, Market Product, and authorized Admin Report URLs use one typed resolver and canonical `https://ourlime.com` share builder.
- Done in source — Routing: existing details open exactly; Lime IDs select the Limes tab; Event, Job, and Market identifiers are retained on their current parent/Coming Soon pages; legacy profile paths normalize to `/profile/[username]`.
- Done in source — Authentication: protected cold-start links persist for up to 24 hours and resume after verified login. Page access, roles, privacy, blocks, membership, and not-found behavior remain authoritative after routing.
- Done in source — Web parity: web share components use one canonical service, the Open in App banner covers all supported destinations, and Android/iOS association path inventories match.
- External/manual — deploy the web health/association routes, supply real Android SHA-256 signing fingerprints and Apple Team ID, install a newly signed build, and manually verify OS-level App/Universal Links. The currently deployed `/.well-known` endpoints remain unavailable until deployment.
- Validation note — no automated checks, lint, TypeScript, Metro, browser/device run, build, deployment, or migration was performed.

- Deploy the changed web messaging APIs and Firestore rules; do not execute the migration automatically.
- Manually verify all user roles, page access statuses, caches across logout/account switching, offline behavior, notification routes, uploads, and destructive actions.
- Continue removing legacy prototype behavior from hidden/future domains before changing their page status to enabled.
- Maintain OOP service boundaries, zero `any`, typed props, direct React hook imports, and explicit safe-area edges in future work.
