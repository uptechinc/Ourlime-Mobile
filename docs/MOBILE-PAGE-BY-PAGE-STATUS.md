# Ourlime Mobile — Page-by-Page Implementation Status

Updated: 2026-08-12

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
- Still to do
  - Add direct follow/friend controls to result rows.
  - Add typed tabs and pagination for posts, communities, events, jobs, blogs, market, and Limes; recent history and highlighted results.

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
  - Text, attachments, stickers, voice-note URLs, replies, forwarding, reactions, delete-for-me/delete-for-everyone, edit rules, shared content panels, link previews, block/remove friend, and call UI source work.
  - Idempotent non-executed migration utility exists at `Ourlime-Web/scripts/migrateChatMessages.ts`.
- Still to do
  - Durable offline outbox, delivery receipts, typing/presence, native voice recording/playback controls, attachment retry/recovery, and full call signaling/device permissions.
  - Deploy server APIs/rules before relying on the new contract, then manually validate dual-read/dual-write behavior and clear-chat semantics.

## Own profile — `app/(tabs)/Profile.tsx`

- Done
  - Shared disk-first own profile summary with five-minute revalidation, profile counts, header/cover/avatar, edit profile, Timeline, searchable Friends, About, Gallery, conditional Admin tab, settings, drawer, error/refresh states.
  - Profile edits immediately patch own summary and cached feed author records; cached images cover avatar, cover, gallery, and feed assets.
  - Timeline/gallery reuse author-scoped feed resources rather than independent duplicate fetches.
  - Avatar/cover selection uses native cropping and `ProfileMediaService`; it uploads to Storage, writes web-compatible `profileImages`/`profileImageSetAs` assignments, updates the user record, and patches caches. Required rules are changed in source but not deployed.
  - Native profile sharing is wired. The nonfunctional Customize palette control is hidden.
- Still to do
  - Reposts, Profile Customization, following/followers/requests/suggestions, friend row actions, full albums/gallery ownership, products/jobs/business account routes, and complete About/privacy fields.
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
  - System/Light/Dark selection applied above navigation and across route backgrounds/text/borders, status bars, tab navigation, headers, drawers, and custom dialogs. System is the default and follows live phone appearance changes; the preference is saved locally and to the appearance document. Theme compatibility state is updated before route rendering, and retained Stack/Tabs surfaces are refreshed when the resolved system scheme changes.
  - Feed composer/scopes/filters/cards/polls, Discover sections/cards/search, Search results, Chat lists/composer, Profile shell/tabs, Communities lists/filters, shared skeletons, the active Home drawer, Admin tabs/user filters, shared page headers, and Jobs now use explicit semantic surfaces and contrast-safe selected states in both themes.
  - Profile/activity/search visibility, message permissions, data-sharing choices, granular notification choices, security alerts, blocked-user removal, save/sign-out, and custom modal states.
- Still to do
  - Secure 2FA enrollment/disable, password change with reauthentication, connected accounts, session/activity logs, export, and account deletion.
  - Continue replacing legacy hard-coded neutrals with explicit semantic theme colors whenever a page is touched; the global compatibility bridge currently keeps those existing pages synchronized.
  - Deploy the adjacent nested `userSettings` Firestore rule and manually verify each preference is consumed by Search, Chat, notifications, presence, and profile privacy.

## Communities list — `app/communities/index.tsx`

- Done
  - Live list, search, All/My Joined/Joined by Friends/New/My Created, public/private/live-category filters, Popular/Newest/Active/Trending controls, community creation, join/request handling, privacy/banned checks, truthful loading/empty/error states, and OOP service ownership.
  - Membership join/request/leave uses the authenticated `/api/communities/membership` contract rather than trusting a route-level client mutation.
- Still to do
  - Community-of-the-Week/statistics, server-backed search/pagination/trending/activity rank, banner upload/crop, verified-member/posting policies, cancel request, fuller badges, invite workflows, and manual permission verification.
  - Deploy the membership API and relevant Firestore rules before runtime completion can be claimed.

## Community detail — `app/communities/[id]/index.tsx`

- Done
  - Live detail/feed/create/comment/like flows, privacy/access/banned states, join/request/leave, native share, server-backed report, Posts/About, and permission-aware visible actions.
  - Network/server failure on `/api/communities/fetch` falls back to live Firestore community, membership, request, and count records instead of leaving the route empty; auth/permission errors remain explicit.
  - Public-profile joined-community links and community member/profile links resolve to canonical native slug routes.
- Still to do
  - Paginated members and join requests; invites; selectable report reasons; polls; events; media; post/member moderation; owner/admin dashboard; edit/delete; role management; and deeper community settings.
  - Use modern Ourlime bottom sheets/custom confirmations for leave/delete/ban/remove/promote/report actions; never native default alerts or simulated success.

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

- Deploy the changed web messaging APIs and Firestore rules; do not execute the migration automatically.
- Manually verify all user roles, page access statuses, caches across logout/account switching, offline behavior, notification routes, uploads, and destructive actions.
- Continue removing legacy prototype behavior from hidden/future domains before changing their page status to enabled.
- Maintain OOP service boundaries, zero `any`, typed props, direct React hook imports, and explicit safe-area edges in future work.
