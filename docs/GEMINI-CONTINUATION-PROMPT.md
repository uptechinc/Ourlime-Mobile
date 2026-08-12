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

Current data-loading architecture that must be preserved:
- Firebase and authenticated web APIs are the server source of truth.
- `LocalCacheService` owns user-scoped Expo SQLite snapshots, schema versioning, corruption recovery, expiry, and eviction.
- Zustand resource store is presentation state only.
- `AppDataProvider` hydrates auth-scoped cache, handles app lifecycle, restarts/stops foreground listeners, invalidates from push notifications, and clears old-account state on logout.
- Feed/profile/chat screens must render cached content first, silently revalidate, and never replace cached content with a full-page loader/error during refresh failure.
- Feeds use independent cache keys by user + scope + filter + author, preserve scroll offsets, and buffer newer head posts behind the New Posts pill.
- Conversation summaries are server-written under `users/{uid}/conversationSummaries`; subscribe only to newest 50 while foregrounded.
- Message history reads newest 30 first, paginates older messages, observes only the current message head, persists bounded local history, and supports legacy chat-array fallback during migration.
- Use `CachedImage`/`expo-image` for remote avatars, covers, gallery images, and feed imagery; preserve emerald initial fallback via `UserAvatar`.

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
