# Ourlime Mobile - Product Requirements and Web Parity FRD

Last audited: 2026-08-12

Web source: `C:\Users\aaron\Github\Ourlime-Web`

Mobile source: `C:\Users\aaron\Github\Ourlime-Web\Ourlime-Mobile`

## 1. Purpose

This is the master feature-requirements document (FRD) for bringing Ourlime Mobile to functional and design parity with Ourlime Web while using native iOS and Android interaction patterns.

It answers four questions for every product area:

1. What exists on the web?
2. What exists in the mobile source today?
3. What is incomplete, mocked, disconnected, or missing?
4. What must be true before the feature can be called complete?

This document is evidence-based. The existence of a route, component, button, modal, or service does **not** by itself mean the feature works end to end.

The current corrective source audit is [`docs/WEB-MOBILE-FULL-PARITY-REAUDIT.md`](docs/WEB-MOBILE-FULL-PARITY-REAUDIT.md). It supersedes any older checkpoint statement that conflicts with its verified findings.

For a concise page-by-page Done/Still-to-do checklist, see [`docs/MOBILE-PAGE-BY-PAGE-STATUS.md`](docs/MOBILE-PAGE-BY-PAGE-STATUS.md).

For a ready-to-copy external agent handoff, see [`docs/GEMINI-CONTINUATION-PROMPT.md`](docs/GEMINI-CONTINUATION-PROMPT.md).

## P0 implementation checkpoint — 2026-08-12

| Milestone | Status | Current evidence |
| --- | --- | --- |
| Repository TypeScript baseline | **Previously reported green; not revalidated** | Automated validation is no longer part of this repository workflow. No compiler, lint, Jest, Expo, browser, or device command was run during the corrective re-audit. |
| Canonical routing/navigation | **Done in source; manual QA pending** | Both drawers read `lib/navigation/AppNavigation.ts`, duplicate route aliases were removed, `AuthorizationService` supplies one role result, and `PageAccessContext` applies canonical visibility/status rules and preview badges. |
| Auth recovery/legal/deep links | **Done in source; device QA pending** | Forgot/reset password, verification result, Terms, and Privacy routes exist; `AuthService` owns Firebase actions; scheme is `ourlime`; notification routing uses a typed registry. |
| Home feed scopes and failures | **Done in source; server deployment pending** | `home`, `friends`, and `communities` scopes reach the canonical API. Failed requests produce retryable errors and successful zero results produce empty states. Community membership filtering was added to the web feed server. |
| Profiles and moderation | **Done in source; authenticated QA pending** | Public profiles use the canonical server response, author-filtered posts, privacy/block behavior, visible friends/communities, friendship cancellation/removal, block/unblock, report, and typed chat navigation. |
| Push notifications | **Done in source; physical-device verification is an external release check** | Real Expo device tokens, Android channels, authenticated register/unregister/send APIs, foreground handling, and typed tap destinations are implemented. No client call to Expo's push gateway remains. |
| Core social pages | **Partial; substantially implemented** | Home, Communities, Chat, Discover/Search, own/other profiles, and core Admin workspaces use typed services and live contracts. Deeper profile, community moderation/events/polls, global search, and advanced Admin modules remain. |
| Active mock removal | **Not complete outside the current core scope** | Coming Soon overlays prevent normal access to Events, Jobs, Market, Blogs, E-Learning, Projects, Ads, Wallet, Saved, Games, E-Hub, and Help. Legacy prototype code remains behind those overlays and is not production behavior. |
| OOP service migration | **Partial** | Exposed core social surfaces use service classes. Remaining web-only/Coming Soon domains and advanced admin workspaces still require service-backed implementations before enabling them. |
| Zero `any` / React namespace discipline | **Previously reported complete; not revalidated** | The corrective audit did not execute repository scans. New work must continue to follow the zero-`any`, type-props, and direct-hook-import rules. |
| Automated tests | **Removed by project policy** | Repository-owned `*.test.*`/`*.spec.*` files were deleted. Validation is manual and user-controlled. |

## 2. Audit Method and Status Definitions

The audit inspected:

- all 104 web `app/**/page.tsx` routes;
- all 54 current mobile `app/**/*.tsx` route/layout files after canonical and Coming Soon routes were added;
- feature component trees under both repositories;
- mobile services, direct Firebase access, navigation destinations, placeholder data, TODO handlers, and `any` usage;
- the detailed Home and post parity documents under `docs/`.

Runtime behavior requiring an authenticated session, device permissions, push delivery, Firestore rules, or native builds remains unverified unless explicitly stated.

| Status | Meaning |
| --- | --- |
| **Implemented** | The visible surface and its primary live read/write paths exist in source. Runtime QA may still be required. |
| **Partial** | A meaningful portion exists, but required controls, live data, mutations, states, or subroutes are missing. |
| **Prototype** | The screen is mainly static, mocked, locally simulated, or backed by TODO handlers. |
| **Missing** | No equivalent mobile route or usable native destination exists. |
| **Native adaptation** | Web capability exists in a deliberately different mobile pattern without losing functionality. |
| **Web only** | Desktop visual behavior should not be copied to native. |

No area should be labelled complete until it satisfies the Definition of Done in section 14.

## 3. Executive Audit Findings

### 3.1 Strongest current areas

- Home feed reads, refresh, pagination, filters, widgets, post creation, media upload/crop, polls, comments, likes, repost/share actions, reporting, blocking, and owned-post deletion.
- Real-time notification context and the Home notification modal.
- Limes vertical video feed, video creation, comments/replies, likes, following feed, mute/pause, and sharing.
- Direct chat detail, including rich messages, attachments, documents, voice notes, stickers, replies, forwarding, shared-content panels, block/remove-friend controls, and call UI.
- Own/other-user profile shells, profile editing, relationship actions, and timeline/gallery/about presentation.
- Firebase Auth persistence is configured with AsyncStorage, and Firebase initialization emits structured diagnostic logs.

### 3.2 Highest-risk gaps

- **104 web page routes versus a much smaller mobile product surface.** Entire web domains and many detail/workflow routes have no native destination.
- **Active prototype flows.** Event comments, Job applications, Blog creation, and E-Learning schedules still expose mock, local-only, unwired, or simulated-success behavior.
- **Admin is not fully parity-complete.** Overview metrics, user role/lifecycle management, moderation reports, and page-access management are live and role-gated. Analytics, testers, stickers, products, categories, communities, and detailed audit workspaces remain web-only.
- **Profile depth remains partial.** Live counts and timelines are present, but Friends, Reposts, Profile Customization, full gallery/album management, and several settings subflows remain.
- **Chat depth remains partial.** Conversation discovery, presence, rich messages, attachments, and real audio URL playback are present; native recording/playback controls, business/discovery tabs, and call-device verification remain.
- **Home design/function gaps remain.** Suggested-user requests, owner visibility, and remove-repost are now service-backed; shared card tokens, fullscreen media, YouTube previews, hashtag/location navigation, and comment moderation depth remain.

## 4. Non-Negotiable Product and Engineering Requirements

### 4.1 Native UX

- Use `SafeAreaView` from `react-native-safe-area-context` with explicit edges on screen headers.
- Keep fixed headers outside keyboard-avoiding containers.
- Use full-screen screens for deep workflows, full-screen modals for rich creation, and bottom sheets for short action menus.
- Support pull-to-refresh, paginated lists, keyboard avoidance, native share, device media permissions, haptics where useful, and accessible touch targets.
- Preserve the Ourlime palette: `#10b981`, `#01eb53`, `#c64d53`, and the established gradient tokens.
- Do not copy desktop hover, cursor trail, floating-particle, tilt-card, or hard-coded presence effects.

### 4.2 OOP service boundary

UI components must not own Firestore queries, collection names, storage uploads, relationship rules, notification mutation rules, or domain transformations.

Required layering:

```text
Expo route/screen
  -> typed component props
  -> custom feature hook
  -> singleton OOP domain service
  -> Firebase/API/native integration
```

Every service must have one domain responsibility, strict typed inputs/outputs, controlled errors, and a clean public API. Existing direct Firebase UI access is migration debt, not an accepted pattern.

### 4.3 Required states for every data screen

Every list/detail/form must include:

- initial loading skeleton;
- authenticated and authorization checks;
- live data or explicit empty state;
- retryable error state;
- pull-to-refresh where appropriate;
- pagination/infinite loading for unbounded collections;
- disabled/loading/success/failure states for mutations;
- offline/network-loss behavior where practical;
- no dummy-data fallback after a live request fails.

## 5. Global Mobile Shell and Navigation

### 5.1 Current mobile shell — Implemented for P0 navigation exposure

Bottom tabs currently expose:

- Feed;
- Discover;
- Limes according to the canonical page-access and role policy;
- Chat;
- Profile.

Home and Profile drawers use the same typed registry, authoritative role result, availability status, and badges. They expose live core destinations plus valid Coming Soon destinations; Admin is shown only to authoritative admins.

Global page access is applied before route rendering and navigation. A matching Coming Soon parent also protects child routes, while permitted developer preview state is labelled.

### 5.2 Required work

- [x] Consolidate `SlideOutMenu` and `AppDrawerNav` into one typed source of truth for labels, permissions, icons, and destinations.
- [ ] Replace all `as any` route casts with typed Expo Router destinations.
- [x] Remove duplicate `page.tsx` route aliases and keep one canonical route implementation per screen.
- [x] Add valid Coming Soon routes for Projects, Ads/Create/Manage, Wallet, Saved, Games/GeoGuesser/Wordle, E-Hub, and Help.
- [x] Apply page-availability/coming-soon policy before rendering and navigation.
- [x] Use one authoritative role policy for Home, tabs, Profile, drawers, route guards, and admin actions.
- [ ] Add consistent deep-link handling for posts, Limes, profiles, communities, events, blogs, jobs, products, notifications, and chats.

## 6. Page-by-Page FRD and Parity Matrix

### 6.1 Login — `app/(auth)/login.tsx` — Partial

**Web baseline**

- Email and password fields, show/hide password, validation, loading and account-state errors.
- Sign in, Sign Up link, Forgot Password, email-verification handling, disabled/deleted/account-status checks, and authenticated redirect.

**Mobile present**

- Native animated login design, email/password validation, password visibility, `AuthService.login`, success/error states, Sign Up navigation, AsyncStorage auth persistence, and redirect to tabs.

**To do**

- [x] Replace the Forgot Password console TODO with a real route and `AuthService` method.
- [x] Match web verification/account-status handling before allowing entry.
- [x] Remove `catch (err: any)` and type Firebase Auth failures.
- [ ] Add keyboard focus progression, accessibility labels, password-manager/autofill hints, and device QA.

### 6.2 Registration — `app/(auth)/register.tsx` and `mobile/Register` — Partial

**Web baseline**

- Welcome/beta access, invitation badge, account type, account credentials, demographics, location, avatar/upload, optional details, interests, verification, terms, and privacy steps.

**Mobile present**

- Five-step account type, personal information, avatar, location/demographics, interests flow; field validation; progress indicator; terms/privacy modals; account creation submission.

**To do**

- [x] Replace `data.mock.ts` avatar/legal content with canonical assets and real legal routes.
- [x] Implement “Use your own photo” with the native picker and service-owned Storage upload.
- [ ] Add web beta access, invitation, optional profile, and verification steps where still required by product policy.
- [~] Avatar typing and canonical assets are complete. Registration still uses native alerts for a small number of validation/result messages and should migrate to `CustomModal` during UX polish.
- [ ] Confirm duplicate email/username rules, date parsing, age policy, account type rules, verification mail, rollback, and partially-created-account recovery.

### 6.3 Password, verification, and legal routes — Implemented in source

Web routes with no equivalent complete mobile flow:

- `/forgot-password`;
- `/reset-password`;
- `/verify/[uId]`;
- `/verify-email`, `/verify-email/success`, `/verify-email/failure`;
- `/terms-and-conditions`;
- `/privacy-policy`.

**To do**

- [x] Create native screens and typed auth/legal services.
- [x] Support email deep links and expired/invalid/success states.
- [~] Link login and registration to the shared legal/auth flows; settings and deletion links remain follow-up work.

### 6.4 Home — `app/(tabs)/index.tsx` — Partial, high functional coverage

The detailed control-level comparison is maintained in:

- `docs/HOME-PAGE-WEB-MOBILE-PARITY-AUDIT.md`;
- `docs/POST-PARITY-TODO.md`.

**Web baseline sections and controls**

- Header: logo/navigation, user search, notification badge/panel, profile/account menu.
- Left rail: profile card, games, Home/Friends/Communities scopes, weekly activity.
- Center: feed source toggle, All/Photos/Videos/Sound/Polls/Events filters, composer, feed cards, pagination, empty/loading/error states.
- Composer: text, emoji, photo/video, crop/aspect/zoom, poll, event, location, hashtags, mentions, upload progress, submit/cancel.
- Cards: profile links, avatar/badges, timestamp/visibility, text/mentions/hashtags, location/map, media/video, poll/event/repost variants, likes/comments/share/repost, likes list, moderation menu.
- Right rail: promoted carousel, suggested users, community/job/event discovery.
- Comments: create, mention, reply, edit, like, delete, pagination, timestamps.

**Mobile present**

- App header/profile/error diagnostics, drawer, notification modal, feed source chips, all six content filters, refresh/pagination/dedupe, skeleton/empty/error states, widget injection, and new-post prepend.
- User-scoped SQLite snapshots plus shared in-memory feed resources render saved pages immediately, retain separate scope/filter/author cursors and scroll positions, reconcile silently after 60 seconds, preserve content on offline failures, and buffer head changes behind a non-jumping New Posts pill.
- Composer with caption/description, media, cropper, hashtags, poll options, location, uploads, progress, validation, and Firestore creation through services.
- Regular, media, video, repost, poll, and event cards with avatars, identity badges, maps, likes, comments, share/repost, relationships, reporting/blocking, and owned-post deletion.
- Promoted, activity, suggested-user, and games widgets are injected into the mobile feed.

**To do**

- [ ] Implement real Friends and Communities backend feed scopes; both currently map to the all-post query.
- [ ] Verify poll media display, sound playback, event navigation, hashtag navigation, mention navigation, and fullscreen media on both platforms.
- [x] Ensure every Home Firebase read/write is behind `PostService`, `CommentService`, `RelationshipService`, `ModerationService`, `EventService`, `LocationService`, or a dedicated service.
- [x] Replace remaining direct Firebase imports and `any` in the Home tree.
- [ ] Reconcile “Feeling”/emoji/event quick actions so labels match their real behavior.
- [ ] Validate permissions, Storage failures, optimistic rollback, duplicate actions, offline recovery, Firestore indexes, and live multi-user updates.

### 6.5 Notifications — Home modal present; dedicated route missing — Partial

**Web baseline**

- Dedicated page and header panel; unread badge; All/Unread/Friends/Likes/Comments/Mentions/Communities filters; unread-first/newest sort; show/hide read; selection; bulk read/unread/delete; mark all read; friend-request accept/decline; pagination and deep links.

**Mobile present**

- Global notification provider, header unread badge, modal, categories, sorting, read collapsing, selection/bulk actions, mark all read, friend-request actions, and empty state.

**To do**

- [ ] Add a full-screen notification route for deep links and long histories, or formally designate the modal as the native adaptation.
- [ ] Verify every notification type resolves to an existing mobile destination.
- [ ] Add paginated history, permission prompts, native token lifecycle, foreground/background/tapped handling, and lockscreen delivery.
- [ ] Install/configure `expo-notifications` if push remains an Expo requirement and test development/release builds.

### 6.6 Search — `app/(tabs)/Search.tsx` — Partial

**Web baseline**

- Global discovery/search across users, posts, Limes, communities, and relevant product entities, with profile navigation and relationship actions where shown.

**Mobile present**

- Debounced live user search through `SearchService`, profile avatars/usernames, refresh, skeleton, empty/error presentation, and other-user profile navigation.

**To do**

- [ ] Add typed result tabs for People, Posts, Limes, Communities, Events, Jobs, Blogs, and Market if globally searchable on web.
- [ ] Add recent searches, clear history, result counts, safe highlighting, pagination, and no-results suggestions.
- [ ] Ensure Firestore queries are indexed, bounded, privacy-aware, and fully owned by `SearchService`.

### 6.7 Discover — `app/(tabs)/Discover.tsx` — Partial

**Web baseline**

- Discovery experience tied into social/user discovery and Home mobile surfaces.

**Mobile present**

- Search field; live suggested people; Add Friend state; Featured Communities, Upcoming Events, and Featured Jobs sections; See All/View All/Browse All/Apply/Join controls; refresh.

**To do**

- [ ] Replace static `DISCOVER_COMMUNITIES`, `DISCOVER_EVENTS`, and `DISCOVER_JOBS` arrays with live OOP services.
- [ ] Wire Join Community and Apply to real mutations/workflows.
- [ ] Add Limes/trending content if present in the approved discovery product design.
- [ ] Add loading/empty/error/pagination states independently for each discovery module.

### 6.8 Limes — `app/(tabs)/Limes.tsx` — Partial, strong coverage

**Web baseline**

- For You/following vertical feed, autoplay/pause/mute, author/profile/follow, caption/mentions, audio label, like, threaded comments, share, report, previous/next controls, and Lime creation.

**Mobile present**

- Firestore reel and friendship reads, vertical feed, For You/Following tabs, create button/modal, video picker/upload, visibility/category/caption/mentions, pause/mute, like counts, comments/replies/edit/delete, follow, and share.

**To do**

- [ ] Move Firestore queries/mutations from the route and components into `LimeService` and related domain services.
- [ ] Add/verify report flow, author/profile navigation, delete-own-Lime, visibility enforcement, share deep links, view tracking, and pagination beyond the current bounded fetch.
- [ ] Enforce duration/aspect/size rules, transcoding/thumbnail behavior, upload cancellation, and background interruption recovery.
- [ ] Replace remaining emoji glyphs with the icon system where appropriate.

### 6.9 Chat list — `app/(tabs)/Chat.tsx` — Partial

**Web baseline**

- Chat launcher/window with Friends, Business, and Discover tabs; conversation search; unread/activity state; real-time messaging entry.

**Mobile present**

- Messages header, conversation search, avatars, last activity, unread state, empty/error/retry states, refresh, older-summary pagination, and navigation to chat detail.
- A shared conversation resource hydrates up to 200 user-scoped summaries from SQLite before network work, observes only the newest 50 server-written summary documents while foregrounded, and repairs missing summaries from accepted friendships.

**To do**

- [x] Move friendship/user queries out of the screen and into `MessagingService`/`RelationshipService`.
- [x] Replace collection-wide user fallback scans with bounded canonical friend/conversation queries.
- [~] Real-time ordering, unread badges, accepted-friend insertion, and bounded pagination are implemented; typing/presence refinement and archive/pin state remain.
- [ ] Define Business and Discover equivalents or mark them intentionally out of mobile scope.

### 6.10 Chat detail — `app/chat/[id]` — Partial, strong coverage

**Web baseline**

- Text, emoji, sticker, reactions, photo/video, documents, voice notes, replies, link previews, forwarding, message menu, delete, chat settings, shared media, voice/video call.

**Mobile present**

- Disk-first latest-30 message hydration, bounded 100-message local history, older-message cursor pagination, realtime message-head observation, optimistic text/attachment insertion, authenticated read state, and legacy-array fallback.
- Text/media/document/sticker/voice-note messages, link previews, reply references, forwarded state, preview/save, reactions/delete, attachment menu, emoji/sticker keyboard, shared media/documents/links, forwarding, block/unblock, remove friend, clear chat, and video-call UI.

**To do**

- [~] Read state, pagination, retryable cached failures, and optimistic send are implemented; delivery receipts, typing, presence, durable offline outbox, and attachment upload recovery remain.
- [ ] Confirm Delete for Me versus Delete for Everyone permissions and time rules.
- [ ] Verify call signaling, ringing/answered/declined/missed/end states, reconnect, permissions, speaker/mic/camera controls, and background calls on real devices.
- [ ] Replace system alerts and remaining route/icon casts with typed custom UI.
- [ ] Confirm chat mute suppresses push but not in-app unread state.

### 6.11 Own Profile — `app/(tabs)/Profile.tsx` — Partial

**Web baseline**

- Persistent profile shell; header/cover/avatar; share; edit images; counts; Timeline, Reposts, About, Friends, Gallery, and Profile Customization; products/jobs/business/admin/settings destinations.

**Mobile present**

- Header, cover/avatar, edit profile, Timeline/About/Gallery tabs, conditional Admin tab, settings, refresh, drawer, skeleton/error state, logout, live post/friend/following counts, and truthful timeline retry states.

**To do**

- [ ] Add Reposts, Friends, and Profile Customization functionality; incomplete actions are hidden instead of simulating success.
- [ ] Complete About parity: basic info, contact, address, education, work, interests/skills, and social links with privacy rules.
- [ ] Complete Gallery parity: albums, create/edit/delete album, upload, image preview, and ownership controls.
- [ ] Verify cover/avatar upload, crop, deletion, cache invalidation, and propagation to all cards/messages.
- [ ] Add share-profile deep link and route access for products/jobs/business-account areas.

### 6.12 Other User Profile — `app/profile/[username].tsx` — Partial

**Web baseline**

- Other-user header, relationship/follow controls, posts/details, About, Friends, Photos/Videos, community/following/follower sliders, privacy/block state.

**Mobile present**

- Profile fetch by username, cover/avatar/name/username/counts, follow/friend actions, Timeline/About/Gallery, relationship service, skeleton/error states.

**To do**

- [x] Friends and Joined Communities use the privacy-aware profile service response.
- [~] Share, block/report, message, and relationship cancellation/removal states are present; followers/following lists and mutual-connection depth remain incomplete.
- [ ] Enforce private profile and blocked-user rules on every tab and count.

### 6.13 Settings — `app/settings/index.tsx` — Partial

**Web baseline**

- Account settings, themes, email notification controls, profile privacy, activity status, message permissions, block list, security, two-factor authentication, change password, activity logs, and account deletion.

**Mobile present**

- Account fields, profile visibility, direct-message toggle, push/email/mention preferences, blocked users/unblock, save, and sign out.

**To do**

- [ ] Move all Firestore/Auth access into typed settings/security services.
- [ ] Add theme/appearance, activity status, granular notification preferences, message permissions, 2FA, change password, sessions/activity logs, data/export controls, and delete-account workflow.
- [ ] Verify settings are actually consumed by notifications, messages, search, and profile visibility.
- [ ] Replace native alerts with `CustomModal` and add destructive-action reauthentication.

### 6.14 Communities list — `app/communities` — Partial

**Web baseline**

- Hero/statistics, category pills, search, sort, grid controls, paginated cards, membership/privacy indicators, create-community modal, loading/empty/error states.

**Mobile present**

- Firestore community reads, featured/community sections, search, sort/category controls, grid/list state, create-community form, Join/Request behavior, View and Report actions.

**To do**

- [ ] Move direct queries and creation/membership rules into `CommunityService`.
- [ ] Remove `any`, web-style class usage, static profile counts, simulated navigation alerts, and hard-coded categories.
- [ ] Add real membership state, cancel request, leave, ownership/admin badges, pagination, and robust empty/error/retry states.
- [ ] Use image picker/upload/crop instead of image URL entry.

### 6.15 Community detail — `app/communities/[id]` — Prototype/Partial

**Web baseline**

- Header, back, privacy/access checks, join/request/leave, share/report, edit/delete, dashboard; sidebar members/moderation; right sidebar discovery; posts/comments; polls/voting; events/comments; media; member remove/ban; post moderation.

**Mobile present**

- A route-level screen with community data/member/post state and create post/event/poll modals exists, plus a separate `mobile/CommunityDetail` implementation.

**Known prototype debt**

- The legacy `mobile/CommunityDetail` implementation and its mock/TODO handlers were removed.
- The canonical community list/detail routes use `CommunityService` and truthful missing/error states.
- Advanced moderation, polls, member administration, and community creation remain P1 and are not exposed as simulated success actions.

**To do**

- [x] Choose one canonical community-detail route and remove the duplicate mock implementation.
- [ ] Implement all reads/mutations in typed Community, CommunityPost, CommunityMember, CommunityPoll, and CommunityEvent services.
- [ ] Match web roles, permissions, private access, owner/admin moderation, share/invite, report, dashboard, post/comment, poll, and event workflows.
- [ ] Add real-time/paginated posts and member lists with native bottom-sheet actions.

### 6.16 Events — `app/events` — Prototype

**Web baseline**

- Hero/stats; Upcoming Events; categories/tags; search; grid/list; filters/clear/apply; create/edit; like/bookmark/share; pagination.
- Event detail: attendance/RSVP, tickets, live stream, copy link, notification preferences, report, gallery, tags, schedule, speakers/socials, discussions/replies/edit, FAQ, ratings/reviews, information, and similar events.

**Mobile present**

- Popular events, filters, content list, create modal, search/category/tag/filter state, likes, registration state, and PageHeader.

**Known prototype debt**

- The exposed Events screen loads canonical records through `EventService`; the `dummyEvents` constant is dormant source debt.
- The actively rendered `EventCommentModal` loads hard-coded event/comment records and mutates comments/replies only in local state.
- One event composer instructs users to “Use a React Native image picker here” and uses placeholder date-picker alerts.

**To do**

- [ ] Replace the active event-comment mock/local workflow with a service-backed discussion contract. Live event reads and creation are present.
- [ ] Add native event detail route `/events/[id]` with all web detail modules and controls.
- [ ] Use native date/time, location/map, image picker/cropper, timezone, recurrence if supported, validation, and edit/delete ownership rules.
- [ ] Implement RSVP/ticket/bookmark/share/discussion/rating/notification flows and attendee counts.

### 6.17 Jobs — `app/jobs` — Prototype/Partial

**Web baseline**

- Job title/keyword/company search, location search, categories/counts, Professional Jobs, Quick Tasks, Freelance Projects, job detail, save/share/apply, application modal, and multi-type job creation.

**Mobile present**

- Search, Advanced control, category chips, three job-type lists, Create Job modal, View All, No jobs state, application and creation components.

**Known prototype debt**

- The `dummyJobs` constant is dormant; list reads and creation use typed `JobsService` contracts.
- The active Job Application modal has no document picker/upload or persistence. Submit logs a payload and closes as simulated success.

**To do**

- [ ] Implement `JobService` for search, pagination, detail, saved jobs, applications, ownership, and typed creation.
- [ ] Add job detail route, application history/status, attachments/resume upload, edit/delete/close job, and employer navigation.
- [ ] Make Advanced filters and all category counts live.

### 6.18 Market — `app/market` — Prototype

**Web baseline**

- Promotions, category browsing, search, filter drawer, category/price/color/size filters, Featured tabs, grid/list, favorites, product cards, product detail/sidebar, seller profile/chat, and profile product add/edit/manage routes.

**Mobile present**

- Promotion slider, search, product filters, category cards, tabs, grid/list, favorites, product detail sidebar state, and seller chat state.

**Known prototype debt**

- The screen reads through `MarketService`. A large dormant dummy-data generator and commented fallback remain source debt, while product-detail and ownership workflows remain incomplete.

**To do**

- [~] Use `MarketService` exclusively at runtime and remove the dormant generator/commented fallback during cleanup.
- [ ] Add native product detail route `/market/[id]`, seller profile/chat, favorites persistence, stock/variant selection, ownership actions, and pagination.
- [ ] Add product create/edit/manage workflows matching web profile product routes.
- [ ] Define purchase/contact/checkout behavior and moderation/reporting requirements.

### 6.19 Blogs list — `app/blogs` — Prototype/Partial

**Web baseline**

- Hero, search by title/tag/category/author, category filter, active filter chips/clear, content type, sort, grid/list, cards, pagination, sidebar/trending, create blog, loading/empty/error states.

**Mobile present**

- Header/create, hero carousel, search, filters, sort, grid/list, pagination state, trending/sidebar/newsletter-style sections, create modal, and back-to-top presentation.

**Known prototype debt**

- The Blogs screen and detail route use `BlogsAndArticlesService` for reads; the active Create Blog modal waits locally and reports simulated success without a persistence mutation. The unused `SAMPLE_BLOGS` constant remains cleanup debt.
- Navigation still raises a “functionality coming soon” alert even when routing.

**To do**

- [ ] Extend `BlogsAndArticlesService` to own live creation and ownership mutations; remove simulated success.
- [ ] Remove the dormant sample constant and stale placeholder code.
- [ ] Verify drafts/publish state, media upload, tags/categories, author rules, and error states.

### 6.20 Blog detail — `app/blogs/[id]` — Partial

**Web baseline**

- Rich content blocks; author/profile/follow; sources; like/bookmark/copy/share/report; comments/replies/likes; related blogs; edit controls for owners.

**Mobile present**

- Rich article rendering, back, author, follow, sources, like/bookmark/share, comments/replies, related content, and About Author sections.

**To do**

- [ ] Replace pervasive `any` content/comment models with typed blog contracts.
- [ ] Verify live bookmark, report, follow, comment/reply/edit/delete/like, source links, and related-post reads.
- [ ] Replace emoji controls with native icons and add rich-media/link accessibility.

### 6.21 E-Learning hub — `app/eLearning` — Prototype/Partial

**Web baseline**

- Main hub plus My Learning, course catalog/detail, modules, lessons, quizzes/create/take, assignments/create/submit, announcements, grades, discussions, course creation, instructor registration/courses/grading, CXC hub, past papers, MCQ, forums, schedules, resources, tutors, messages, and payments.

**Mobile present**

- Hero, course messages, learning materials, resources, tutors, and schedules with section/tab state.

**Known prototype debt**

- The active Schedules surface seeds mock subjects and performs create/edit/delete only in local state; calendar export reports coming soon.
- This entire domain remains exposed in the drawer even though full E-Learning is outside P0 and the web page registry defaults it to `coming_soon`.

**To do**

- [ ] Create typed Course/Lesson/Quiz/Assignment/Grade/Discussion/Instructor/Payment services.
- [ ] Add the full route tree and progress-aware student dashboard.
- [ ] Implement video lessons, downloads, quizzes, assignments, grading, discussions, announcements, payments, instructor tools, CXC tools, and completion certificates as required.
- [ ] Add offline/download policy, media progress persistence, and accessibility.

### 6.22 Admin — `app/admin/index.tsx` and Profile Admin tab — Prototype/Partial

**Web baseline**

- Admin dashboard, analytics, user management, testers, stickers, reports, products, page access, moderation, community categories, categories, and communities.

**Mobile present**

- Authenticated Admin Portal metrics, live paginated user search/listing, role changes, archive/restore actions, live moderation reports, report dismissal, and a canonical page-access editor. Profile admin actions navigate to these real workspaces.

**Known parity debt**

- Analytics, tester administration, stickers, product review, marketplace categories, community categories, community administration, and detailed audit/activity workspaces remain web-only.
- Moderator-only direct access is not yet a separate mobile workspace; the current Admin portal is restricted to authoritative admins.
- Native pagination/filter depth and reversible confirmations still need to be matched across every remaining admin domain.

**To do**

- [x] Enforce authenticated server-side role authorization for implemented admin queries and mutations.
- [ ] Build native admin navigation and real workflows for every remaining web admin route.
- [ ] Add pagination, search/filter, confirmation/reauthentication, audit records, reversible lifecycle actions, and error handling.
- [ ] Never rely on client-only role checks for privileged actions.
- [x] Consume and enforce canonical page-access settings before rendering or navigating to exposed destinations.

### 6.23 Not Found — `app/+not-found.tsx` — Present, needs product QA

- [ ] Ensure the screen uses Ourlime styling, SafeAreaView, a clear Home action, and telemetry for broken deep links.

## 7. Web-Only Route Families Still Missing on Mobile

These are not covered by the existing mobile route tree and must be implemented, deliberately embedded, or explicitly removed from mobile scope through a product decision.

| Web family | Web routes/features | Mobile requirement |
| --- | --- | --- |
| Post deep link | `/post/[id]` | Native post-detail route with comments and share/deep-link resolution. |
| Lime deep links | `/limes/[id]`, `/lime/[id]` | Canonical native Lime permalink and redirect compatibility. |
| Event detail/upcoming | `/events/[id]`, `/events/upcoming` | Event detail and filtered upcoming list. |
| Marketplace detail | `/market/[id]` | Native product detail; currently no route. |
| Profile friends | `/profile/friends` | Friends/followers/following/mutual lists and actions. |
| Profile products | `/profile/products`, add/edit/update | Seller product management. |
| Profile jobs | add/manage/update/delete | Employer job management. |
| Business account | `/profile/business-account` | Business onboarding/profile/metrics. |
| Profile administration | 12 web admin destinations | Full authorized admin workflows. |
| Ads | `/ads`, `/ads/create`, 17 marketplace/host/booking/admin routes | Campaign creation/management and ad marketplace booking lifecycle. |
| E-Hub | `/ehub` | Hub dashboard or explicit product de-scope. |
| E-Wallet | `/eWallet` | Balance, transactions, funding/withdrawal/payment policy. |
| Project management | `/projectManagement`, `/projectManagement/[projectId]` | Project list/detail, invites, tasks, stats, permissions. |
| Games | `/games`, `/wordle-game`, `/triniGeoGuesser`, game/leaderboard | Native/WebView game hub with authenticated scoring and leaderboards. |
| E-Learning subroutes | 22 routes below the hub | Full course/student/instructor/CXC workflow described above. |
| Auth/legal | forgot/reset/verify/email/legal routes | Native screens and email deep links. |

## 8. Component and Button Integrity Requirements

Every visible control in mobile must be classified as one of:

1. functional and service-backed;
2. navigation to a real route;
3. disabled with a truthful explanation;
4. hidden until implemented.

The following patterns are release blockers:

- `console.log('TODO...')` as a button handler;
- success alerts without a completed backend mutation;
- hard-coded counters presented as live data;
- random likes, registrations, prices, inventory, presence, or activity;
- dummy arrays after a failed network call;
- buttons navigating to nonexistent routes;
- “coming soon” inside a flow presented as complete;
- client-only authorization for admin/moderation operations.

## 9. Data, Real-Time, and Database Requirements

- Use the same canonical Firebase project, collection paths, field names, visibility rules, and relationship semantics as web.
- Centralize schema normalization for Firestore `Timestamp`, `Date`, strings, legacy fields, default avatars, usernames, and media records.
- Use `onSnapshot` only for genuinely real-time surfaces; unsubscribe on unmount and avoid duplicate listeners.
- Use cursor pagination, bounded limits, deduplication, and documented Firestore indexes.
- Do not scan entire `users`, posts, messages, or other unbounded collections from UI screens.
- Upload media to Firebase Storage before saving permanent documents; never persist device-local URIs.
- Use optimistic UI only with rollback and duplicate-action protection.
- All deletes must enforce ownership/role rules and distinguish archive, soft delete, and permanent delete.
- Diagnostic logs must record service name, operation, identifiers safe to log, result count/state, elapsed time, and typed errors without exposing secrets.

## 10. Media and Avatar Requirements

- Resolve avatar sources through `AvatarService`/`UserAvatar` for remote URLs, bundled defaults, legacy filenames, SVG/raster assets, and emerald-initial fallback.
- Keep web and mobile default avatar asset names synchronized.
- Support permission denied, limited-library access, cancellation, unsupported type, oversize file, upload failure, retry, and removal.
- Images require preview/crop/aspect/zoom where the web does; video requires preview, playback controls, duration/aspect validation, and thumbnails.
- Profile, post, comment, chat, Lime, community, event, job, blog, and market avatar/media rendering must share normalization rules.

## 11. Security, Privacy, and Moderation Requirements

- Enforce auth, account status, email verification where required, block state, private profiles, community membership, visibility, and admin roles in services/rules—not only UI.
- Report flows require category/reason/evidence as defined by web, mutation feedback, duplicate prevention, and moderator visibility.
- Block/unblock must immediately affect feed, profile, search, comments, chat, calls, and notifications.
- Destructive account/admin actions require confirmation and recent authentication where Firebase requires it.
- Do not log credentials, tokens, private message bodies, or unredacted sensitive profile data.

## 12. Accessibility and Native Quality Requirements

- Provide accessibility labels/roles/states/hints for icon-only actions, toggles, tabs, modals, media controls, and counters.
- Meet minimum touch-target sizes and readable contrast in light/dark themes.
- Support Dynamic Type/text scaling without clipped controls.
- Announce loading, errors, success, unread counts, selected filters, and modal state to assistive technology.
- Respect reduced motion and do not require gestures as the only way to perform an action.
- Verify keyboard navigation where supported and screen-reader order on iOS and Android.

## 13. Prioritized Delivery Plan

### P0 — Truthful, live, safe product

- [ ] Remove active mock/simulated behavior from Event comments, Job applications, Blog creation, and E-Learning schedules; remove dormant fixture generators afterward.
- [x] Finish route/navigation correctness: remove duplicate aliases, unify role evaluation, and enforce page availability.
- [x] Restore strict TypeScript: repository-wide TypeScript, zero-explicit-`any`, and zero-React-namespace checks pass.
- [x] Move route-reachable Firebase UI logic into OOP services; the UI scan reports zero direct `firebaseConfig` imports.
- [x] Complete auth recovery/verification/legal routes in source.
- [x] Complete other-profile privacy/block behavior and all Home backend feed scopes in source.
- [ ] Manually verify notification and push delivery end to end on the intended Android/iOS release targets.

### P1 — Core social/product parity

- [~] Communities list/create/join/private access/posts/comments are service-backed; moderation, polls, events, invites, and dashboard remain.
- [ ] Complete Events list/detail/RSVP/tickets/discussions/reviews.
- [ ] Complete Jobs live list/detail/apply/create/manage.
- [ ] Complete Market live list/detail/favorites/seller/product management.
- [ ] Complete Blogs live list/detail/create/social actions.
- [ ] Complete Profile About/Friends/Reposts/Gallery/Customization.
- [~] Discover people/communities/events/jobs and people search use live contracts; global multi-entity search and deeper pagination remain.

### P2 — Large missing domains

- [ ] Full E-Learning route tree and workflows.
- [~] Project Management has a valid Coming Soon destination; implementation remains future scope.
- [~] Ads/Create/Manage have valid Coming Soon destinations; implementation remains future scope.
- [~] Wallet and E-Hub have valid Coming Soon destinations; implementation remains future scope.
- [~] Games, GeoGuesser, and Wordle have valid Coming Soon destinations; gameplay remains future scope.
- [ ] Full mobile administration suite.

### P3 — Release hardening

- [ ] Accessibility audit, reduced motion, Dynamic Type, and theme verification.
- [ ] Performance profiling for feed/Limes/chat/media-heavy screens.
- [ ] Offline/network transition behavior and upload recovery.
- [ ] Deep-link matrix, notification destination matrix, and navigation back-stack QA.
- [ ] Android/iOS permissions, small/large screen, notch, keyboard, and release-build QA.

## 14. Definition of Done for Every Page

A page is complete only when all applicable items pass:

- [ ] Every web section and action is implemented or documented as an approved native adaptation/de-scope.
- [ ] Every button performs a real action, reaches a real route, or is intentionally disabled/hidden.
- [ ] Reads and writes use typed OOP services with zero `any`.
- [ ] No active mock/dummy fallback is presented as server data.
- [ ] Loading, skeleton, empty, error, retry, refresh, pagination, and mutation states exist.
- [ ] Permissions, ownership, roles, privacy, blocks, and Firestore rules are enforced.
- [ ] Real-time listeners clean up and do not duplicate or leak.
- [ ] Media upload/crop/playback/remove and failure recovery are verified where applicable.
- [ ] Deep links and notification destinations resolve correctly.
- [ ] Accessibility and native interaction requirements pass.
- [ ] User-controlled manual source/build validation is completed under the current project policy.
- [ ] Manual QA passes on at least one Android and one iOS device/simulator.

## 15. Manual verification policy

Automated tests and agent-initiated validation commands are not part of this repository workflow. The user performs validation manually. Source reviews may inspect routes, imports, handlers, service boundaries, role gates, and placeholder signals, but must not present unexecuted runtime behavior as verified.

### Static quality commands (no build)

These commands do not launch Metro, create a native build, or run automated tests. Run them only when you choose to perform a static source-quality pass:

- npm run typecheck — strict TypeScript compiler check with no emitted files.
- npm run lint — Expo ESLint rules.
- npm run check:discipline — Ourlime rules: no explicit any, no interface, no React namespace imports, and safe-area import/edge requirements.
- npm run check — runs all three in sequence. bun run check can invoke the same package script when Bun is preferred.

The detailed manual checklist and current source findings are maintained in `docs/WEB-MOBILE-FULL-PARITY-REAUDIT.md`.

## 16. Exact Web Route Coverage Appendix

The following 104 web page routes were included in this audit. Dynamic segments are shown in brackets.

```text
/
/admin/seed-stickers
/ads
/ads/create
/ads/marketplace/admin/proof-verification
/ads/marketplace/become-host
/ads/marketplace/become-host/business
/ads/marketplace/become-host/influencer
/ads/marketplace/bookings/[bookingId]
/ads/marketplace/bookings/[bookingId]/payment
/ads/marketplace/bookings/[bookingId]/proof
/ads/marketplace/bookings/[bookingId]/review
/ads/marketplace/browse
/ads/marketplace/create-offer
/ads/marketplace/host-dashboard
/ads/marketplace/my-bookings
/ads/marketplace/my-offers
/ads/marketplace/offers/[offerId]
/ads/marketplace/offers/[offerId]/book
/ads/marketplace/offers/[offerId]/edit
/ads/marketplace/verification
/blogs
/blogs/[id]
/communities
/communities/[id]
/discover
/ehub
/eLearning
/eLearning/courses
/eLearning/courses/[courseId]
/eLearning/courses/[courseId]/announcements
/eLearning/courses/[courseId]/assignment/[assignmentId]
/eLearning/courses/[courseId]/assignments
/eLearning/courses/[courseId]/assignments/create
/eLearning/courses/[courseId]/discussions
/eLearning/courses/[courseId]/grades
/eLearning/courses/[courseId]/lesson/[lessonId]
/eLearning/courses/[courseId]/modules
/eLearning/courses/[courseId]/quiz/[quizId]
/eLearning/courses/[courseId]/quizzes
/eLearning/courses/[courseId]/quizzes/create
/eLearning/courses/create
/eLearning/cxc
/eLearning/cxc/forums
/eLearning/cxc/mcq
/eLearning/cxc/past-papers
/eLearning/instructor/courses
/eLearning/instructor/grading
/eLearning/instructor/register
/eLearning/my-learning
/events
/events/[id]
/events/upcoming
/eWallet
/forgot-password
/games
/jobs
/lime/[id]
/limes
/limes/[id]
/login
/market
/market/[id]
/notifications
/post/[id]
/privacy-policy
/profile
/profile/admin/analytics
/profile/admin/categories
/profile/admin/communities
/profile/admin/community-categories
/profile/admin/dashboard
/profile/admin/moderation
/profile/admin/page-access
/profile/admin/products
/profile/admin/reports
/profile/admin/stickers
/profile/admin/testers
/profile/admin/user-management
/profile/business-account
/profile/friends
/profile/jobs/add
/profile/jobs/delete
/profile/jobs/manage
/profile/jobs/update
/profile/products
/profile/products/add
/profile/products/edit/[id]
/profile/products/update
/profile/settings
/profile/viewOtherProfile/[username]
/projectManagement
/projectManagement/[projectId]
/register
/reset-password
/terms-and-conditions
/triniGeoGuesser
/triniGeoGuesser/game
/triniGeoGuesser/leaderboard
/verify/[uId]
/verify-email
/verify-email/failure
/verify-email/success
/wordle-game
```

The mobile app currently has logical screens for auth login/register/recovery/verification/legal flows, the five main tabs, chat detail, own/other profile, settings, communities list/detail, post detail, four live Admin workspaces, valid Admin child-route handoffs, and not-found. Future domains use valid Coming Soon routes and canonical page-access enforcement. Duplicate web-style `page.tsx` aliases were removed.
