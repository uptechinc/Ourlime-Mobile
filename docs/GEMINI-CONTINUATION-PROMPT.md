# Gemini Continuation Prompt — Ourlime Mobile

Copy the prompt below into Gemini after opening the Ourlime repositories.

```text
You are continuing development of Ourlime Mobile, an Expo Router React Native TypeScript application that must reach functional and design parity with the adjacent Ourlime-Web Next.js application.

Repositories:
- Mobile: C:\Users\aaron\Github\Ourlime-Web\Ourlime-Mobile
- Web reference/backend: C:\Users\aaron\Github\Ourlime-Web

Start every task by reading these files in full, in this order:
1. Ourlime-Mobile\AGENTS.md
2. Ourlime-Mobile\PROJECT_CONTEXT.md
3. Ourlime-Mobile\docs\MOBILE-PAGE-BY-PAGE-STATUS.md
4. The relevant focused parity document:
   - Home/posts: docs\HOME-PAGE-WEB-MOBILE-PARITY-AUDIT.md and docs\POST-PARITY-TODO.md
   - Cross-page parity/admin/routes: docs\WEB-MOBILE-FULL-PARITY-REAUDIT.md
   - Profile and Communities: docs\PROFILE-COMMUNITIES-WEB-MOBILE-PARITY-AUDIT.md

`docs\MOBILE-PAGE-BY-PAGE-STATUS.md` is the working source-of-truth checklist. For the page/domain you are changing:
- Read its Done bullets to preserve existing work.
- Implement only a clearly listed Still to do item, unless the user gives a new requirement.
- Compare the corresponding currently rendered Ourlime-Web route/components/services before changing mobile behavior.
- Update that page's Done/Still to do bullets immediately after completing a milestone.
- Do not mark any item runtime-verified unless the user manually verified it.

Project goal:
- Match the web product’s features, permissions, live data contracts, profile/media behavior, and visual hierarchy with clean native iOS/Android UX.
- A native layout may differ from desktop; do not copy desktop-only hover effects, rails, cursor effects, or wide-screen layout literally.
- Do not enable Coming Soon/protected domains until their listed live service-backed requirements are actually implemented.

Required architecture:
- Use Service-Oriented OOP. Business logic, Firestore/API calls, caching, record normalization, uploads, mutations, and diagnostics belong in typed singleton service classes under `lib/services/` or the appropriate domain service folder.
- UI components are presentation-only. Hooks own React lifecycle and call services. Routes compose screens/hooks/components.
- Never place new direct Firebase/Firestore/Storage access in route or UI files.
- Extend existing canonical services before creating competing service implementations.
- Keep Firebase/authenticated Ourlime-Web APIs authoritative. Do not add mock or fallback arrays.

Strict TypeScript and React Native rules:
- Zero `any`; use explicit types, `unknown`, guards, or typed generics.
- Use `type ComponentNameProps = { ... }`; never use `interface` for props/types.
- Never write `import React from 'react'`; import hooks directly.
- Screens with headers must use `SafeAreaView` from `react-native-safe-area-context` with `edges={['top', 'left', 'right']}`.
- Keep fixed headers outside `KeyboardAvoidingView`.
- Use typed Expo Router destinations/params; do not introduce web-style `/page` navigation.
- Preserve the Ourlime colors: emerald `#10b981`, bright green `#01eb53`, red `#c64d53`.

Current data-loading and authentication architecture that must be preserved:
- Firebase and authenticated web APIs are the server source of truth.
- **Authentication & Registration Parity**:
  - `login.tsx`: Email/Password auth, account status checks (`deleted`, `disabled`, `EMAIL_NOT_VERIFIED`), UI error banners without `console.error` LogBox redbox overlays.
  - `Register`: 1-to-1 Web Parity with `/api/beta/registration-mode` ('open', 'invite_only', 'closed', defaulting to 'invite_only').
  - `BetaAccessView`: Displays exact Web title, detail copy, user-add icon badge, dark glass container, and side-by-side or stacked action buttons matching `https://ourlime.com/register`.
  - `BetaApplicationModal`: Modal for beta tester applications (Full Name, Email, Invited By -> POST `/api/beta/apply`).
  - Full 8-step registration flow: Step 0 Welcome -> Step 1 Account Type -> Step 2 Basic Info (with TermsModal & PrivacyModal popups, debounced email & username availability checks) -> Step 3 Demographics (DOB, Gender, Student Level) -> Step 4 Location (Country, Phone, City) -> Step 5 Avatar (Cartoon/Realistic SVGs & custom photo upload) -> Step 6 Interests -> Step 7 Identity Verification & Submit -> Verification Success Modal.
  - `forgot-password.tsx` & `reset-password.tsx`: Password recovery request & `oobCode` verification with exact Ourlime-Web dark glass design parity, eye toggle password visibility, and authorized continue URL.
- `LocalCacheService` owns user-scoped Expo SQLite snapshots, schema versioning, corruption recovery, expiry, and eviction.
- Zustand resource store is presentation state only.
- `AppDataProvider` hydrates auth-scoped cache, handles app lifecycle, restarts/stops foreground listeners, invalidates from push notifications, and clears old-account state on logout.
- Feed/profile/chat screens must render cached content first, silently revalidate, and never replace cached content with a full-page loader/error during refresh failure.
- Feeds use independent cache keys by user + scope + filter + author, preserve scroll offsets, and buffer newer head posts behind the New Posts pill.
- Conversation summaries are server-written under `users/{uid}/conversationSummaries`; subscribe only to newest 50 while foregrounded.
- Message history reads newest 30 first, paginates older messages, observes only the current message head, persists bounded local history, and supports legacy chat-array fallback during migration.
- Use `CachedImage`/`expo-image` for remote avatars, covers, gallery images, and feed imagery; preserve emerald initial fallback via `UserAvatar`.

Current Admin architecture and status that must be preserved:
- All twelve canonical web Admin destinations now have native routes under `app/admin`: dashboard, analytics, user management, testers, stickers, reports, products, page access, moderation, community categories, marketplace categories, and communities. Do not replace them with web-only messages or an Admin Overview button.
- `AdminAccessService`, `AdminMetricsService`, `AdminUserService`, `AdminModerationService`, `AdminPageAccessService`, and `AdminWorkspaceService` own authorization, live reads, normalization, mutation dispatch, and audit behavior.
- User Management includes status/role/account filters, paging, CSV sharing, role/account/verification/lifecycle detail tabs, archive/restore, and permanent-delete confirmation. Never simulate import success; implement a secure provisioning API before enabling import.
- Moderation includes report search/status/severity, report-detail slug routes, the web action vocabulary, mandatory reasons, optional durations, and authenticated server actions.
- Page Access includes Pages and Activity Log tabs, individual status/navigation/preview/overlay/badge/action-route fields, bulk status updates, initialize defaults, and reset defaults.
- Tester management uses secure beta APIs for invitations, tester Auth enforcement, application decisions, invitation actions, and registration mode. Direct client mutations must not replace server email/Auth behavior.
- Products, communities, categories, sticker packs/assets, and analytics are live native workspaces. Remaining Admin parity debt is advanced analytics date-range trends, full sticker create/edit/seed forms, specialized product/community field controls, secure user import, and a moderator-specific shell.
- The adjacent web `firestore.rules` contains the required authoritative admin access changes but has not been deployed. Do not claim runtime completion until rules and APIs are deployed/reachable and the user manually verifies them.

Current Profile and Communities architecture and status that must be preserved:
- `docs\PROFILE-COMMUNITIES-WEB-MOBILE-PARITY-AUDIT.md` is the exact component/state/design/permission checklist for these domains; do not rely only on the shorter page summary.
- Own Profile has cached Timeline, searchable service-backed Friends, About, Gallery, role-gated Admin, native sharing, and profile editing. Reposts and Customize remain hidden/incomplete; full About, albums, following/followers/requests, Products/Jobs/Business Account remain explicit debt.
- `ProfileMediaService` is the canonical mobile avatar/cover mutation. It uploads through `PostMediaService`, writes `profileImages` and `profileImageSetAs` assignments compatible with web resolvers, updates `users`, and patches profile/feed caches. Do not regress to picker URIs or user-document-only assignment.
- The adjacent Storage/Firestore rules required for profile uploads are changed in source but not deployed. Multiple covers, gradients, order, remove/delete, and cross-domain propagation still need implementation and manual verification.
- Communities list supports All/My Joined/Joined by Friends/New/My Created, privacy/live-category filters, all four web sort choices, search, create, join/request, and truthful states through `CommunityService`.
- Join/request/leave uses the authenticated web `/api/communities/membership` endpoint. It and the relevant rules are not deployed. Do not replace it with trusted UI-level direct writes.
- Canonical community detail currently has access gates, join/request/leave, native share, server report, Posts/About, creation/comments/likes, and typed slug links. Events, Polls, Members/requests, invites, dashboard, edit/delete, post/member moderation, role actions, and full settings remain required.
- Never expose a dead profile/community control. Use modern Ourlime `CustomModal`/bottom sheets for confirmations, reports, and destructive actions; never `Alert.alert`, browser confirm, toast-only destructive UX, or simulated success.
- Profile timelines intentionally show only content-type filters; do not re-add the Home/Friends/Communities feed-scope selector there.
- Community detail uses the web API first and a read-only Firestore fallback only for network timeouts/server failures. Preserve explicit authentication/authorization failures and keep secure mutations server-owned.
- `SettingsService` owns canonical user/account/appearance/notification/privacy/security/blocked-user documents. `SettingsTheme` is `system | light | dark`; System is the default and `ThemeProvider` listens for live phone appearance changes while it is selected. Light/Dark are fixed overrides. `ThemeProvider` synchronizes the OOP `ThemeStyleService` before descendants render, because updating it in an effect leaves legacy native styles on the previous palette. The root Stack and Tabs are keyed by the resolved scheme to refresh retained navigation surfaces; preserve that behavior while converting touched pages to semantic theme colors.
- Never implement System mode by calling `Appearance.setColorScheme(null)`: the current Android native Appearance module declares that parameter non-null and crashes. Keep fixed overrides and System resolution within `ThemeProvider`, using `Appearance.getColorScheme()` plus `Appearance.addChangeListener()` only.
- Use `useAppTheme().colors` for touched interactive surfaces. Feed composer/filter/post/poll UI, the Home `SlideOutMenu`, Admin root tabs/user filters, `PageHeader`, and Jobs are explicit examples; selected controls use emerald/blue with white text and unselected controls use `colors.control`, `colors.border`, and readable theme text.
- Coming Soon must always block the underlying route with the global dark-glass `PageAccessOverlay`, including for developers. Parent Coming Soon status must continue to override child/slug routes. Its primary action returns through navigation history and labels the last accessible page; do not restore a hard-coded Back/Return Home action.
- Bundled future-route defaults are a release safety boundary: Events and every registry entry whose default is `coming_soon` must block immediately even while Firestore page settings or the authorization profile are loading. Do not let a delayed listener expose prototype content or allow a stale remote `enabled` value to override that boundary before the mobile feature is released.
- `RelationshipService.getFriends` resolves the signed-in user's own accepted Firestore relationships and canonical profile-image selection directly, so own Profile does not depend on the optional LAN web API. Other-user friend graphs remain on the privacy-aware authenticated API. Do not add mock friends or expose another user's private graph through a client fallback.
- Jobs category paging uses a native horizontal paged `ScrollView`. Do not reintroduce `react-native-swiper`; its internal ref crashes under the Fabric renderer.

Backend compatibility rules:
- If secure behavior or a missing canonical contract requires web work, modify the adjacent Ourlime-Web API/service/rules in the same milestone.
- Messaging uses authenticated server APIs, server-maintained conversation summaries, dual-write legacy metadata + message subcollection, and a manual idempotent migration utility. Do not deploy APIs/rules or execute migrations unless the user explicitly asks.
- All privileged server mutations must independently enforce authorization; hidden mobile buttons are not security.

Status reporting and docs:
- Maintain `PROJECT_CONTEXT.md` and `docs/MOBILE-PAGE-BY-PAGE-STATUS.md` after each meaningful milestone.
- Keep status wording honest: Done in source, Partial, Prototype, Hidden/Coming Soon, or manual verification pending.
- Preserve existing user changes in the dirty worktree. Do not reset, checkout, or overwrite unrelated work.

Validation policy for this project:
- Do NOT create automated test/spec files.
- Do NOT run tests, Jest, TypeScript checks, lint, Expo/Metro, browser automation, simulator/device runs, builds, deployments, or database migration unless the user explicitly changes this instruction.
- The user performs manual verification. Report manual acceptance scenarios instead of claiming validation passed.

How to work:
1. Identify the next highest-priority actionable Still to do item in `docs/MOBILE-PAGE-BY-PAGE-STATUS.md` that the user asked for.
2. Inspect the matching live web route/components/services and matching mobile code before editing.
3. Make a focused, service-backed implementation with truthful loading, empty, error, retry, refresh, and pagination states as applicable.
4. Preserve cache/resource behavior and role/page-access rules.
5. Update the page-by-page status document and `PROJECT_CONTEXT.md` when the implementation changes the documented state.
6. Give a concise handoff: what changed, what remains, manual checks the user should perform, and whether web API/rules deployment is required.

Do not claim 100% parity until every page's required workflow is live, authorization-safe, source-complete, and manually verified.
```
