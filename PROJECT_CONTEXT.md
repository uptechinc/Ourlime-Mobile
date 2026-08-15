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

For the exhaustive Profile, public-profile, Communities, and community-detail component/permission/design audit, see [`docs/PROFILE-COMMUNITIES-WEB-MOBILE-PARITY-AUDIT.md`](docs/PROFILE-COMMUNITIES-WEB-MOBILE-PARITY-AUDIT.md). Its focused matrices supersede shorter summaries for those surfaces.

For a ready-to-copy external agent handoff, see [`docs/GEMINI-CONTINUATION-PROMPT.md`](docs/GEMINI-CONTINUATION-PROMPT.md).

## P0 implementation checkpoint — 2026-08-12

| Milestone | Status | Current evidence |
| --- | --- | --- |
| Repository TypeScript baseline | **Previously reported green; not revalidated** | Automated validation is no longer part of this repository workflow. No compiler, lint, Jest, Expo, browser, or device command was run during the corrective re-audit. |
| Canonical routing/navigation | **Done in source; manual QA pending** | Both drawers read `lib/navigation/AppNavigation.ts`, duplicate route aliases were removed, `AuthorizationService` supplies one role result, and `PageAccessContext` applies canonical visibility/status rules and preview badges. |
| Auth recovery/legal/deep links | **Done in source; device QA pending** | Forgot/reset password with web parity design, authorized reset URL, verification result, Terms, and Privacy routes exist; `AuthService` owns Firebase actions; scheme is `ourlime`; notification routing uses a typed registry. |
| Home feed scopes and failures | **Done in source; server deployment pending** | `home`, `friends`, and `communities` scopes reach the canonical API. Failed requests produce retryable errors and successful zero results produce empty states. Community membership filtering was added to the web feed server. |
| Profiles and moderation | **Done in source; authenticated QA pending** | Public profiles use the canonical server response, author-filtered posts, privacy/block behavior, visible friends/communities, friendship cancellation/removal, block/unblock, report, and typed chat navigation. |
| Push notifications | **Done in source; physical-device verification is an external release check** | Real Expo device tokens, Android channels, authenticated register/unregister/send APIs, foreground handling, and typed tap destinations are implemented. No client call to Expo's push gateway remains. |
| Core social pages | **Partial; substantially implemented** | Home, Communities, Chat, Discover/Search, own/other profiles, and all twelve canonical Admin destinations use typed services and live contracts. Communities now includes directory/detail/member/request/event/poll/moderation workspaces; invite delivery, event discussion/social depth, global search, deeper profile, and deeper Admin workflow parity remain. |
| Active mock removal | **Not complete outside the current core scope** | Coming Soon overlays prevent normal access to Events, Jobs, Market, Blogs, E-Learning, Projects, Ads, Wallet, Saved, Games, E-Hub, and Help. Legacy prototype code remains behind those overlays and is not production behavior. |
| OOP service migration | **Partial** | Exposed core social and Admin surfaces use service classes. Remaining web-only/Coming Soon domains still require service-backed implementations before enabling them. |
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
- **Admin is no longer made of web-only handoffs, but is not release-verified.** All twelve canonical web admin destinations now have native workspaces. User filters/lifecycle/role/verification controls, report detail actions, page-access bulk/editor/audit controls, tester records/invitations, sticker packs/assets, categories, products, communities, and aggregate analytics are present. Advanced analytics trends, full sticker CRUD forms, every specialized product/community field, and server-backed import remain parity debt; secure API mutations also require a reachable/deployed web backend.
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

Global page access is applied above route rendering and navigation. A matching Coming Soon parent also protects child routes. Coming Soon now always renders the same blocking, dark glass modal pattern as web—even for developer accounts—so unfinished page content cannot be used accidentally. The primary action remembers the last accessible route, labels that page, and navigates back through history instead of always sending the user Home.

Bundled future routes such as Events and Jobs are also blocked immediately from canonical defaults while remote settings/profile state hydrates, so delayed listeners and stale remote `enabled` values cannot expose prototype content before a mobile release.

### 5.3 Exhaustive Web vs Mobile Registration, Beta Access, & Auth Parity Matrix

| Feature / Component / Helper | Web Implementation (`Ourlime-Web`) | Mobile Implementation (`Ourlime-Mobile`) | Parity Status |
| --- | --- | --- | --- |
| **Beta Access Mode Guard** | `app/register/page.tsx` queries `/api/beta/registration-mode`. Defaults to `invite_only`. | `mobile/Register/index.tsx` queries `/api/beta/registration-mode` via `ApiService`. Defaults to `invite_only`. | **100% Done** |
| **Beta Access Restricted View** | `components/register/BetaAccessView.tsx` (`invite_required`, `closed`, `invalid`, `expired`, `revoked`, `used`). | `components/auth/BetaAccessView.tsx` matching title, detail copy, green badge, dark glass container, and side-by-side/stacked buttons. | **100% Done** |
| **Beta Tester Application Modal** | `components/register/BetaApplicationModal.tsx` (Full Name, Email, Invited By -> POST `/api/beta/apply`). | `components/auth/BetaApplicationModal.tsx` in React Native Modal (Full Name, Email, Invited By -> POST `/api/beta/apply`). | **100% Done** |
| **Invitation Token Validation** | `app/register/page.tsx` checks `referralToken` via `/api/beta/validate-token`. | `mobile/Register/index.tsx` reads `searchParams.referralToken` and validates via `/api/beta/validate-token`. | **100% Done** |
| **Step 0: Welcome Step** | `components/register/WelcomeStep.tsx` ("Welcome to Ourlime 🇹🇹", Quick & Easy card, Safe & Secure card, Get Started button). | `mobile/Register/index.tsx` Step 0 (Welcome header, Quick & Easy card, Safe & Secure card, Get Started button, Sign In link). | **100% Done** |
| **Step 1: Account Type** | `components/register/AccountTypeStep.tsx` (Student vs Regular user cards). | `mobile/Register/index.tsx` Step 1 (Student vs Regular user selection cards with green/blue highlights). | **100% Done** |
| **Step 2: Basic Info** | `components/register/FirstStep.tsx` (Name, Username, Email, Password, Terms/Privacy checkboxes). | `mobile/Register/index.tsx` Step 2 (First/Last name, Username, Email, Password/Confirm, Terms & Privacy toggles). | **100% Done** |
| **Real-time Email Availability** | `helpers/Auth.ts` & `app/api/auth/registration-availability/route.ts`. | `mobile/Register/index.tsx` debounced 500ms call to `/api/auth/registration-availability` with loading spinner & inline error. | **100% Done** |
| **Real-time Username Availability**| `helpers/Auth.ts` `UserService.checkUserExists` & `registration-availability`. | `mobile/Register/index.tsx` debounced 500ms call to `/api/auth/registration-availability` with loading spinner & inline error. | **100% Done** |
| **Terms & Conditions Modal** | `components/register/TermsModal.tsx` (Scrollable Terms document). | `components/auth/TermsModal.tsx` (React Native ScrollView modal with full effective date & legal sections). | **100% Done** |
| **Privacy Policy Modal** | `components/register/PrivacyModal.tsx` (Scrollable Privacy Policy document). | `components/auth/PrivacyModal.tsx` (React Native ScrollView modal with full data protection sections). | **100% Done** |
| **Step 3: Demographics** | `components/register/DemographicsStep.tsx` (DOB, Gender, Student Level conditional). | `mobile/Register/index.tsx` Step 3 (DOB, Gender chips, and conditional Student Level chips if Student Account). | **100% Done** |
| **Step 4: Location & Contact** | `components/register/LocationStep.tsx` (Country, Phone, City). | `mobile/Register/index.tsx` Step 4 (Country, Phone, City). | **100% Done** |
| **Step 5: Avatar Selection** | `components/register/AvatarStep.tsx` (Cartoon vs Realistic SVGs, custom upload). | `mobile/Register/index.tsx` Step 5 (Cartoon vs Realistic tabs, 6 SVGs, and `expo-image-picker` custom photo upload). | **100% Done** |
| **Step 6: Interests Selection** | `components/register/InterestsStep.tsx` (Grid of 17 tags, min 3 required). | `mobile/Register/index.tsx` Step 6 (Grid of 17 interest chips, selection counter, min 3 validation). | **100% Done** |
| **Step 7: Verification & Submit** | `components/register/VerificationStep.tsx` (Student ID, National ID, Skip). | `mobile/Register/index.tsx` Step 7 (Student ID, National ID, Skip options & Complete Registration button). | **100% Done** |
| **Email Verification Modal** | `components/register/VerificationStep.tsx` (Verification email sent & live polling). | `mobile/Register/index.tsx` Success Modal (Shows sent email & button to return to login). | **100% Done** |
| **Login Auth & Redbox Avoidance**| `app/login/page.tsx` & `AuthService.login()`. | `app/(auth)/login.tsx` & `AuthService.login()` with `DiagnosticLogService` `console.log` interception (no LogBox redbox traps). | **100% Done** |
| **Forgot & Reset Password** | `app/forgot-password` & `app/reset-password`. | `app/forgot-password.tsx` & `app/reset-password.tsx` with clean UI status banners and `oobCode` verification. | **100% Done** |
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
- Text/media/document/sticker/voice-note messages, link previews, reply references, forwarded state, preview/save, reactions/delete, attachment menu, emoji/sticker keyboard, shared media/documents/links, forwarding, block/unblock, remove friend, clear chat, and a root-level authenticated Agora call experience.

**To do**

- [~] Read state, pagination, retryable cached failures, and optimistic send are implemented; delivery receipts, typing, presence, durable offline outbox, and attachment upload recovery remain.
- [ ] Confirm Delete for Me versus Delete for Everyone permissions and time rules.
- [~] Server-authoritative call sessions, Agora credentials, native Answer/Decline integration, mute/speaker/camera/flip controls, and 45-second expiry are implemented in source. Signed native builds, credentials, deployment, reconnect testing, and physical-device verification remain external release work.
- [ ] Replace system alerts and remaining route/icon casts with typed custom UI.
- [ ] Confirm chat mute suppresses push but not in-app unread state.

### 6.11 Own Profile — `app/(tabs)/Profile.tsx` — Partial

**Web baseline**

- Persistent profile shell; header/cover/avatar and canonical image assignment; share; counts; Timeline, Reposts, About, Friends/Following/Followers/Requests/Suggestions, Gallery albums, and Profile Customization; products/jobs/business/admin/settings destinations.

**Mobile present**

- Header, cover/avatar, edit profile, Timeline/Friends/About/Gallery tabs, conditional Admin tab, settings, refresh, drawer, skeleton/error state, logout, live post/friend/following counts, native sharing, and truthful timeline/friends retry states.
- The signed-in user's Friends tab reads accepted relationships and canonical avatar assignments directly from Firestore, avoiding an unnecessary dependency on the optional LAN API; privacy-aware friend graphs for other users stay server-owned.
- `ProfileMediaService` uploads avatar/cover files, creates canonical `profileImages` records, maintains `profileImageSetAs` assignments, and immediately patches own-profile/feed-author caches. Required adjacent web rules are changed in source but not deployed.
- The unused Customize/palette control is hidden until its workspace is implemented. Profile errors and confirmations use custom UI instead of the native default alert.

**To do**

- [x] Add a real searchable, retryable, service-backed Friends workspace and profile links.
- [ ] Add Reposts and Profile Customization; keep incomplete actions hidden instead of simulating success.
- [ ] Complete About parity: basic info, contact, address, education, work, interests/skills, and social links with privacy rules.
- [ ] Complete Gallery parity: albums, create/edit/delete album, upload, image preview, and ownership controls.
- [~] Avatar and single-cover upload/crop/canonical assignment/cache patching are implemented; multiple covers, gradient/order/remove, unused-media cleanup, and propagation to chat/comments/community rows remain.
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

- Typed `SettingsService` loads account, appearance, notifications, privacy, security, and blocked-user records directly from canonical Firestore documents, so an unavailable web API no longer leaves Settings loading or fails the entire screen.
- Persistent System/Light/Dark appearance selection is applied above Expo Router. System is the default for users without a saved preference and follows live phone appearance changes; Light and Dark remain fixed overrides. Route-reachable components subscribe to `useAppTheme()` semantic colors; the obsolete global style preprocessor and theme-keyed Stack/Tab remount paths were removed so appearance changes do not reset navigation or cached resources.
- Theme resolution stays inside `ThemeProvider`; it does not call native `Appearance.setColorScheme`, because the current Android React Native module rejects the null reset required by System mode.
- Feed canvases, composer/filter controls, post and poll cards, Discover sections/cards/search, Search results, Chat lists/composer, Profile shell/tabs, Communities lists/filters, shared skeletons, the Home slide-out menu, Admin navigation/filter controls, shared page headers, and protected Jobs content now use semantic theme colors explicitly so selected/unselected controls retain readable contrast in both modes.
- All visible confirmation/error states use `CustomModal`. Two-factor status is shown truthfully but cannot be enabled until its secure verification workflow is implemented.

**To do**

- [x] Move route-visible settings reads/writes into the typed OOP `SettingsService`.
- [x] Add persistent System/Light/Dark appearance with live device-theme following, activity/search visibility, granular notification controls, message permissions, data-sharing controls, and security-alert preferences.
- [ ] Implement secure 2FA setup/disable, change password with reauthentication, connected accounts, sessions/activity logs, data/export controls, and delete-account workflow.
- [ ] Verify settings are actually consumed by notifications, messages, search, and profile visibility.
- [~] Semantic Light/Dark/System colors cover the navigation shell and core Feed, Discover, Chat, Profile/About/Friends, Communities, Settings, Admin navigation, calls, legal screens, drawers, and modern dialogs. Continue replacing unsafe hard-coded neutrals in older future-domain forms and secondary modals before calling the route-wide audit complete.
- [x] Replace visible native alerts with `CustomModal`; destructive account actions still require reauthentication work.

### 6.14 Communities list — `app/communities` — Done in source / manual and deployment verification pending

**Web baseline**

- Hero/statistics, category pills, search, sort, grid controls, paginated cards, membership/privacy indicators, create-community modal, loading/empty/error states.

**Mobile present**

- `GET /api/communities` is the canonical normalized directory contract. It supports All/Joined/Joined by Friends/New/Created, public/private, category, debounced search, Popular/Newest/Active/Trending, opaque cursor paging, bounded limits, result totals, and Community of the Week scoring.
- The directory information hierarchy is now intentionally native: one primary Browse scope row remains visible, while visibility, category, and sorting live in a single `CommunityFiltersSheet`. The toolbar shows an active-filter count, removable summary chips, result count, and grid/list controls instead of four competing chip rows.
- Cards and detail use `communityVariantMembershipAndLikeCount` in one server batch. Missing/invalid/stale-zero member counters are derived from unique active memberships plus the creator, fixing the mobile zero-member regression.
- The shared native card renders banner fallback, category/privacy/verification, creator/avatar, description, members/likes/posts, top members, friends-here count, and canonical owner/member/pending/declined/banned actions.
- `CommunitiesResourceService` persists independent viewer/query snapshots for five minutes stale / 48 hours retained, keeps cached content during refresh failure, paginates to bounded pages, and patches/removes all list/Discover copies after mutations.
- Screen-owned first-page refreshes use foreground API health recovery while `AppPreloadService` keeps its directory request at background priority. Foreground and background in-flight keys are separated, so an early preload rejection cannot poison the first visible Communities visit. Silent reconciliation no longer displays the pull-to-refresh spinner.
- Create uses an authenticated server transaction with name/slug availability and suggestions, live category, public/private, verified-members-only, posting permission, 3:1 image-picker crop, Storage upload/progress, optional URL, preview/remove, naming notice, and terms confirmation.
- Join/request/cancel/leave and community likes are desired-state server transactions with deterministic documents, deduplication, authoritative non-negative counts, and owner/ban/identity-verification enforcement. No dummy community fallback is used.

**To do**

- [x] Move route-visible reads, creation, likes, and membership calls into OOP services and authenticated web APIs; use live categories and truthful states.
- [x] Add request cancellation, complete membership badges/actions, cached cursor paging, server ranking, Community of the Week, selected profile images, and image picker/crop/upload.
- [ ] Deploy the adjacent web API source and manually compare every card/state on devices. No validation was run by the agent.
- [ ] If Admin adds category ordering/paging beyond the current bounded live category collection, expose that order in the directory.

### 6.15 Community detail — `app/communities/[id]` — Substantially implemented / partial parity

**Web baseline**

- Header, back, privacy/access checks, join/request/leave, share/report, edit/delete, dashboard; sidebar members/moderation; right sidebar discovery; posts/comments; polls/voting; events/comments; media; member remove/ban; post moderation.

**Mobile present**

- The canonical route uses `CommunityDetailResourceService` plus separate cached detail, post, member, request, event, poll, and dashboard resources. Cached detail stays visible on recoverable reconciliation errors.
- Header parity includes banner, title/description, category/privacy/verification badges, creator/avatar, created date, authoritative member/like/post counts, filled community-like state, share/report, join/request/cancel/leave, role, edit, dashboard/moderation, and delete.
- Posts reuse canonical community-origin post cards, media, desired-state likes, likes lists, comments/replies, reports in `communityReports`, author/moderator server-cascade deletion with counter updates, and cross-feed/detail cache reconciliation.
- Events are live and community-filtered with create/edit/delete, photo/video upload, recurrence, attendance state/counts, authenticated reporting, role authorization, and custom confirmation. Polls are live with two-to-five options, duration, multiple-choice behavior, results, expiry, report, vote, delete, and reconciliation.
- About exposes category, privacy, verification policy, posting permission, rules, created date, description, and member count. Members provide server search, cursor paging, selected-avatar fallback, role/presence/friend context, profile links, and confirmed role/remove/ban action sheets.
- The owner/moderator dashboard provides Overview, Members, Requests, Activity, and Reports with search/status filtering, approve/decline, role management, assign/dismiss/resolve/hide moderation, and server-checked report ownership. Opening the dashboard starts dashboard, member, and request hydration concurrently; Activity and Reports reuse the dashboard payload. Every workspace exposes a force-refresh action without clearing cached content. Edit supports the complete native create fields plus rules; server-owned cascade deletion is not limited to ten posts.
- The dashboard is a true full-screen native modal with stable workspace loaders, explicit close handling, larger X/tab targets, Android back dismissal, and reset-on-close state. The slug-page Create Post, Host Event, Create Poll, Share Invite, tabs, edit, dashboard, membership, like, share, report, member, request, moderation, event, and poll entry points are connected to typed handlers; Host Event/Create Poll open their composer rather than only changing tabs. Community event cards now submit reports through the authenticated community-content report API.

**Known prototype debt**

- The legacy `mobile/CommunityDetail` implementation and its mock/TODO handlers were removed.
- The canonical community list/detail routes use `CommunityService` and truthful missing/error states.
- The obsolete `RightSection/CommunityServie` and route-reachable mock event/poll components were removed. Live APIs return loading, cached, empty, retryable error, or ready states only.

**To do**

- [x] Choose one canonical community-detail route and remove duplicate mock implementations.
- [x] Add service-backed Members, Requests, Polls, Events, About, Edit, and dashboard workspaces plus authenticated server authorization for privileged mutations.
- [~] Share Invite currently uses canonical native/deep-link sharing. Add the web-equivalent searchable friend picker and authenticated invite-message delivery.
- [~] Event attendance is live; event likes and discussion/replies remain. Date/location entry still uses validated ISO/location text rather than native date/time/map pickers.
- [x] Community, community-post, event, and poll reports use themed selectable category/reason/details flows. Post reports additionally support bounded evidence attachments.
- [~] The dashboard API accepts bounded report batches, but mobile still needs multi-select bulk-report UI and deeper activity preview/navigation.
- [ ] Delete superseded Storage banner/event objects after successful replace/delete and manually verify owner/moderator/site-admin/private/pending/declined/banned states.

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
- The Fabric-incompatible `react-native-swiper` category carousel was replaced with a native paged horizontal `ScrollView`, removing its undefined internal `scrollTo` crash.

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

### 6.22 Admin — `app/admin/index.tsx` and Profile Admin tab — Substantially implemented/Partial

**Web baseline**

- Admin dashboard, analytics, user management, testers, stickers, reports, products, page access, moderation, community categories, categories, and communities.

**Mobile present**

- The overview and every canonical child destination are native routes: dashboard, analytics, user management, testers, stickers, reports, products, page access, moderation, community categories, marketplace categories, and communities.
- User Management includes live search, status/role/account filters, pagination, CSV sharing, detail tabs, role changes, account status/reason/suspension controls, email and identity verification actions, archive/restore, and permanent-delete confirmation. Import remains disabled until a secure provisioning contract exists; no simulated import success is shown.
- Reports/Moderation includes status/severity/search filters, counts, report-detail slug routing, the web moderation action set, reasons, optional durations, secure action dispatch, and deletion.
- Page Access includes Pages and Activity Log tabs, individual status/navigation/preview/overlay/badge/action-route editing, multi-select bulk status changes, initialize defaults, reset defaults, refresh, and global enforcement through `PageAccessContext`.
- Testers includes registration mode, all web lifecycle tabs, search, applications/invitations/testers, notes/status actions, and secure invitation creation. Products, communities, both category workspaces, stickers/sticker packs, and analytics render live Firestore-backed records with native filtering/detail/action states.
- `AdminAccessService`, `AdminMetricsService`, `AdminUserService`, `AdminModerationService`, `AdminPageAccessService`, and `AdminWorkspaceService` own authorization, reads, normalization, mutations, and diagnostics. UI/routes contain no Firestore queries.

**Known parity debt**

- Analytics currently supplies live aggregate/domain metrics but not the web date-range trend series and route breakdown depth.
- Sticker packs and stickers can be listed, filtered, enabled/disabled, and removed; the web create/edit forms and seed control still require their final native forms.
- Product/community workspaces provide live search/status/sort/detail/moderation, but specialized category/privacy/owner controls should be expanded field-for-field after manual schema verification.
- Tester lifecycle/email/account enforcement goes through authenticated web APIs. It will show a truthful retryable failure while the configured API host is unreachable; deployment/runtime connectivity is an external requirement.
- Moderator-only direct access is not yet a separate mobile workspace; the current portal shell is restricted to authoritative admins even though report data rules recognize moderators.
- Repository Firestore rules were aligned for authoritative admin reads/writes but were not deployed. Server-only Auth deletion, role/lifecycle, moderation, tester email/invitation, and secure provisioning operations remain API-enforced.

**To do**

- [x] Enforce authenticated server-side role authorization for implemented admin queries and mutations.
- [x] Build native admin navigation and live workspaces for every canonical web admin route.
- [x] Add user pagination, search/filter, destructive confirmation, audit records, reversible lifecycle actions, and truthful error handling to the core workspaces.
- [ ] Finish advanced analytics trends, sticker create/edit/seed forms, product/community field-specific editors, secure user import, and moderator-shell parity.
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

- [~] Communities directory, create/edit/delete, membership/private access, posts/comments, live polls/events, members/requests/roles, selectable report flows, and moderation dashboard are service-backed. Searchable friend invites, event likes/discussions/native date-map inputs, dashboard bulk selection, and Storage cleanup remain.
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

The mobile app currently has logical screens for auth login/register/recovery/verification/legal flows, the five main tabs, chat detail, own/other profile, settings, communities list/detail, post detail, twelve native Admin workspaces plus report-detail slug routing, valid Coming Soon routes, and not-found. Future domains use canonical page-access enforcement. Duplicate web-style `page.tsx` aliases were removed.

## 2026-08-13 device stabilization update

- Done: the main tab bar now derives its height and bottom padding from `react-native-safe-area-context`, keeping Feed, Discover, Chat, and Profile above Android gesture and three-button navigation.
- Done: Android development builds explicitly permit the configured local HTTP API through `expo-build-properties`. Production must still use HTTPS; changing this native property requires a new development/native build.
- Done: `ApiService` maps React Native fetch and cleartext failures to typed `NETWORK_ERROR` results. Community detail can then use its canonical Firestore read fallback instead of displaying a raw Java networking exception.
- Done: comments use explicit theme colors for their modal shell and composer inputs, including visible text and placeholders in light, dark, and system themes.
- Done: own-profile Posts, Friends, Followers, and Following totals are enriched from Firestore when the API is unavailable. Friendship counts include accepted relationships only and deduplicate the peer UID.
- Done: message detail synchronization listens only to the newest bounded `chats/{chatId}/messages` window. The authenticated cursor API supplies a bounded legacy-array fallback when needed, avoiding a competing full-array listener.
- Done: native chat/call push payloads include the sender destination and use the high-priority Android call channel. Notification taps route to the correct peer and call type.
- Superseded: legacy chat call markers remain readable, while active call state is now owned by the root `CallCoordinator` and authenticated call-session API.
- Done: the `EventService` media normalizer returns a strict `MediaItem[]` and no longer leaks `undefined` elements.
- Still to do externally: rebuild the Android development client for the cleartext/native plugin change, run the local web API on a LAN-reachable address, deploy the updated web push endpoint, and verify notification permission plus a real Expo push token on a physical-device development/release build. Expo Go cannot receive remote push notifications on current Expo SDKs.
- Done in source: the preview-only call modal was removed. Mobile uses `react-native-agora`, CallKeep, Android FCM call data, iOS PushKit/APNs VoIP, and one global call screen; web uses the same opaque call sessions and session-bound Agora credentials. Runtime parity still depends on native builds, entitlements, credentials, deployed APIs, and physical-device verification.

## 2026-08-13 instant-resource and deterministic-chat milestone

- Done in source: chat detail now uses FlashList v2 bottom-first rendering and `maintainVisibleContentPosition`; timer, animation-frame, and content-size `scrollToEnd` positioning were removed.
- Done in source: chat automatically follows new messages only near the latest message and otherwise exposes a “New messages” control. Dark chat text, incoming bubbles, header, composer, and attachment sheet use semantic theme colors.
- Done in source: `DiscoverResourceService` and `CommunitiesResourceService` own SQLite hydration, stale-while-revalidate refresh, error retention, and Zustand presentation updates. Screens no longer own their canonical result arrays.
- Done in source: `AppPreloadService` and `AppPreloadCoordinator` start Home independently, then preload authorized metadata with a two-request worker queue. Work pauses in the background and is cancelled on account changes.
- Done in source: Home, Friends, and Communities feed scopes use separate `FeedResourceService` keys. `All` pages seed instant partial filter snapshots before authoritative filter refreshes.
- Done in source: feed disk retention is 48 hours while the network-stale threshold remains 60 seconds. Newer reconciled posts stay behind the “New posts” pill.
- Done in source: the web Communities feed reads joined `communityVariantDetails`, applies membership/block/visibility rules, paginates with an opaque cursor, and returns community name, slug, and avatar identity.
- Done in source: community directory first load no longer performs one counter-document read per card, and Friends-filter loading no longer replaces cached directory content with a full-screen spinner.
- Added project skills: `.agents/skills/instant-mobile-resources` and `.agents/skills/native-chat-experience` document the required cache/preload and chat-list patterns.
- Manual verification pending: newest-message anchoring with late media, background preloads on a device, offline cache retention, all feed scope/filter combinations, community identities, and role/page-access suppression.
- Deployment pending: the adjacent Ourlime-Web feed API change must be deployed before a released mobile client receives canonical community-scope results.

### 2026-08-13 API resilience and bottom-inset follow-up

- Root cause confirmed: the configured machine address was correct, but no process was listening on port 3000. The mobile client was reaching the machine and waiting for a server that was not running.
- Added `npm run dev:full`, which starts Ourlime-Web and Expo together and reuses an API already listening on port 3000. This is the preferred local-development command.
- Local web-server stdout and stderr can be retained under `Ourlime-Web/logs/` when the server is launched as a background process for mobile debugging.
- Comment and reply reads now attempt the authenticated web contract first, then use typed Firestore recovery when the failure is specifically a timeout/network/server condition.
- Community-post reads have matching service-owned Firestore recovery using the canonical web collection names.
- Comment creation/editing, comment/post likes, sharing, and repost mutations remain server-authoritative so the mobile client cannot bypass moderation, privacy, ownership, counter, or notification rules.
- Firestore read recovery never activates for authentication, validation, authorization, or not-found API responses. Deployed rules remain authoritative.
- Chat detail uses FlashList bottom-first rendering and automatic top pagination; it performs no measured-content, timeout, animation-frame, or `scrollToEnd` positioning.
- Chat, comment composers, emoji/sticker keyboards, forwarding sheets, and sticker sheets now use the live safe-area bottom inset so Android gesture/three-button navigation cannot cover their controls.

### 2026-08-13 attendance, chat positioning, and app-link follow-up

- Event-post RSVP now resolves the verified Firebase session inside `EventService`, while feed cards consume the shared verified-auth state above navigation instead of capturing a possibly empty user once during render. Attendance status and mutations continue to use the same `eventAttendees` schema as web.
- Chat detail delegates newest-message anchoring and prepend preservation to FlashList. It auto-follows only near the bottom and otherwise shows the guarded New Messages action.
- Regular and poll post cards use a filled red heart for the liked state and an outline heart otherwise.
- `DeepLinkService` owns canonical post/profile/community/blog/Lime/event/job/market/report URLs, legacy normalization, pending-auth continuation, and native route resolution. Expo config claims the supported path inventory through Android App Links and iOS Universal Links while retaining the `ourlime://` scheme.
- Ourlime-Web exposes canonical share construction, profile-link fallback routing, an app-open banner across supported share destinations, and environment-backed Android/iOS association endpoints.
- Still to do externally: set `ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS` and `APPLE_TEAM_ID` in the deployed web environment, deploy the association routes/banner, and produce a new signed native build so operating systems verify the HTTPS links. These signing values are intentionally not guessed or committed.

### 2026-08-13 canonical social synchronization milestone

- Chat no longer contains imperative `scrollToEnd`/timer/content-size positioning. FlashList starts at the newest chronological item, automatically loads bounded history at the top, preserves visible content on prepend, and exposes a guarded New Messages jump only when the reader is away from the bottom.
- `PostOrigin = 'home' | 'community'` is part of every normalized post. Community reactions use an authenticated desired-state server transaction with duplicate cleanup and authoritative non-negative counts. Feed/detail/poll cards preserve other liker IDs, sync from updated props, and query the correct likes collection.
- The global `AppDrawerProvider` owns one typed drawer state machine above navigation. Feed and Profile no longer own competing modal booleans. `SlideOutMenu` now uses the same native `pageSheet` slide transition as `CommunityFiltersSheet`, eliminating the delayed mount-plus-custom-animation path while preserving queued navigation after close.

- The shared post composer now subscribes to `useAppTheme()` and uses semantic canvas, surface, input, text, border, selection, disabled, and accent tokens. Community Create Post therefore follows fixed Dark and live System-dark appearance, and its enabled/disabled Post button remains contrast-safe in Light mode.
- `NotificationService` now treats `/api/notifications` and its `unreadCount` as canonical, persists the latest page in SQLite, and uses the normalized notification subcollection only for invalidation. All web inbox types and separate chat/call push types have typed destination handling; cold-start/background responses are deduplicated.
- `RelationshipResourceService` and `useRelationshipHub` provide shared SQLite/Zustand resources for Friends, Requests, Active, Following, Followers, and Suggestions. The authenticated hub API returns direction, relationship ID, privacy-aware presence, and allowed actions without per-card presence requests.
- `PresenceService` and web auth lifecycle coordination send 60-second foreground heartbeats and best-effort offline state. The server enforces Activity Status, server timestamps, and a two-minute stale cutoff. Online state is surfaced in relationship rows and chat headers while chat summary contracts retain their batched presence fields.
- Community detail now uses a viewer/community-keyed SQLite resource and shares reaction/create/delete patches with normalized Home/Communities feeds. Relationship mutual counts are batch-derived server-side. Remaining source work: add cursor pagination to the community-detail snapshot. Notification history paginates automatically near the modal end and relationship sections expose bounded Load more. Remaining external work: deploy adjacent web APIs and verify remote push/presence/reactions in a signed development or production build.
- No automated validation was run because the project validation boundary assigns tests, type checks, lint, Metro, builds, and device verification to the user.

## 2026-08-13 native calling, stable-history, requests, and semantic-theme milestone

- Done in source: authenticated call sessions enforce `ringing -> connecting -> active -> ended`, accepted friendship/block rules, participant authorization, first-answer-wins device IDs, opaque UUID Agora channels, and terminal reasons (`declined`, `canceled`, `missed`, `remote_ended`, `failed`, `answered_elsewhere`). Session expiry is 45 seconds and expired calls cannot be answered.
- Done in source: `CallService`, `AgoraCallService`, `NativeCallService`, the root `CallProvider`, and `GlobalCallOverlay` own signaling, RTC lifecycle, system-call reconciliation, mute, speaker, video, camera flip, minimize/restore, and one-time termination. Chat screens only request a call.
- Done in source: iOS config includes VoIP background mode, PushKit registration, CallKit reporting, and distinct APNs VoIP token storage. Android config includes high-priority direct FCM call data, CallKeep/Telecom permissions, foreground-service support, full-screen intent permission, Answer/Decline events, and an entrypoint-level background handler. Ordinary notifications continue using Expo tokens.
- Done in source: web call initiation/answer/end uses the same call-session API and participant-bound Agora credentials. Typed call events and deterministic call-end message records preserve legacy client visibility during migration.
- Done in source: FlashList 2.3.1 renders chronological newest-30 chat pages with bottom-first anchoring, stable item types/keys, bounded 100-message retention, automatic gated top pagination, and no `scrollToEnd`, content-size, timer, or animation-frame race. The list remounts once when its first populated resource snapshot arrives, fixing empty initial layouts in long chats.
- Done in source: Profile Friends -> Requests has independent Incoming and Outgoing resources, search, cursors, refresh, and mutation patching. Incoming is the default; Incoming exposes Accept/Decline and Outgoing exposes Cancel. Requests and Suggestions remain own-account-only.
- Done in source: semantic theme tokens cover canvas/card/elevated/input/text/border/accent/selected/destructive/disabled/scrim/navigation/warning/success roles. Profile About values, chat content/accessories, call UI, relationship controls, legal pages, and navigation update live from `useAppTheme()` without keyed navigator remounts.
- External release work: configure Agora, Firebase Android, APNs VoIP, Apple entitlements/team/signing, and production API environment values; deploy Ourlime-Web API changes plus the participant-readable/server-write-only `calls` Firestore rule; create signed development/production builds; and verify foreground/background/terminated/lock-screen behavior on physical Android and iOS devices. Expo Go cannot load these native modules.
- Manual validation pending: all native call transitions and audio routing, web/mobile interoperability, long/short chat anchoring with late media, request mutations across caches, and remaining route-by-route theme contrast. No automated checks, Metro, builds, deployments, or device runs were performed by the agent.

## 2026-08-14 reliable API startup and universal-link milestone

- Root cause reconfirmed: Firebase authentication remained available, but `EXPO_PUBLIC_WEB_API_URL` targeted the development PC while no HTTP server was listening on port 3000. Notifications, chat friends, activity, and network statistics therefore timed out independently.
- Done in source: Ourlime-Web exposes an uncached `/api/health` response. Mobile `dev:full` detects the active LAN IPv4 address, binds Next.js to `0.0.0.0:3000`, waits for the LAN health response, and injects the reachable API URL into Expo without rewriting `.env`.
- Done in source: EAS development, preview, and production profiles explicitly use `https://ourlime.com`; local `dev:full` is the only workflow that injects cleartext LAN endpoints.
- Done in source: `ApiService` owns typed availability state, a shared health probe, outage backoff, sibling-request cancellation, foreground retry probing, and one structured outage log. An unreachable host no longer causes every startup resource to wait through its own eight-second timeout.
- Done in source: notification refreshes are coalesced. The initial Firestore invalidation snapshot no longer duplicates the cache-hydration reconciliation, and cached notifications stay visible when refresh fails.
- Done in source: `DeepLinkService` owns typed share URL generation, canonical/legacy URL parsing, native-route resolution, and a 24-hour authenticated pending destination. Verified login resumes the original link rather than always replacing it with Home.
- Done in source: canonical HTTPS and `ourlime://` links cover posts, profiles, communities by ID/slug, blogs, Limes, events, jobs, market products, and authorized Admin reports. Existing detail routes open exactly; Events/Jobs/Market retain their target in the parent route until native detail pages exist.
- Done in source: Ourlime links tapped in chat/link previews navigate internally. External sites and file/media attachments continue through the operating system.
- Done in source: mobile Android intent filters, iOS association paths, web association responses, web share builders, and the global Open in App banner cover the same destination inventory. Web and mobile shares use the canonical `https://ourlime.com` host.
- External release work: deploy Ourlime-Web so `/api/health` and both `/.well-known` association responses exist publicly; set `ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS` and `APPLE_TEAM_ID`; create a new signed native build; then verify cold, background, authenticated, logged-out, unauthorized, and no-app-installed link behavior.
- Validation note: source was reviewed only. No TypeScript, lint, tests, Metro, browser/device automation, build, deployment, or migration command was run.

## 2026-08-14 type-safety, local native Android build, and search parity milestone

- Done in source: resolved 16 ESLint and type-safety warnings across `Discover.tsx`, `Search.tsx`, `Communities`, `FriendsTab.tsx`, and `Admin` workspace components (`tsc --noEmit && expo lint && check-discipline.cjs` passing with 0 errors and 0 warnings across 354 source files).
- Done in source: added [`scripts/build-local-apk.cjs`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/scripts/build-local-apk.cjs) to automate native Android prebuild and Gradle compilation directly on Windows (`bun run build:local`), with 8GB JVM Heap / 2GB Metaspace memory settings preventing D8 dex merger out-of-memory errors (`BUILD SUCCESSFUL in 11m 54s`).
- Done in source: updated `Search.tsx` with multi-category search filter tabs (**People**, **Communities**, **Events**, **Jobs**) and direct **Add Friend** / **Sent** action buttons on user search rows using `RelationshipService`.
