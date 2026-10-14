---
name: roles-and-permissions
description: How Ourlime user roles, page access statuses (admin_only, coming_soon, beta_only…), staff preview, feature roles and Firestore rules fit together on web and mobile — and why a gated page is never a bug to "fix".
---

# Ourlime Roles & Permissions

Use when a page shows an access overlay ("Administrator Access Required", "Coming Soon", "Beta Access Only", "Page Unavailable", a "Preview:" pill), when adding a page or route, or when touching anything that checks a user's role.

## 0. The rule that matters most

**A gated page is an admin decision, not a bug.** Page availability is set live by admins in the page-access admin UI (web `app/profile/admin/page-access`, mobile `components/admin/PageAccessAdminSection.tsx`) and stored in Firestore `pageAccessSettings/{pageId}`. "Unavailable" pages are intentionally limited to admins/developers/testers while they are finished.

Never "fix" an access overlay by:
- editing `pageAccessSettings` docs or a user's `role` / `isAdmin` / `isDeveloper` fields,
- widening `authorizationService.canAccessStatus` (mobile) or `canRoleAccessPage` (web),
- removing or bypassing `PageAccessOverlay` / `PageAccessBoundary`, or adding route aliases/exemptions so one entry point skips the gate.

Explain to the user which setting gates the route and that an admin can change its status. Only change gating code when the user explicitly asks.

Example (2026-10): non-admins tapping a shared Lime in chat saw "Administrator Access Required" because `pageAccessSettings/limes` is `admin_only`. That is the intended behaviour.

## 1. Roles (from `users/{uid}`)

Fields: `role` (fallback `accountType`), `isAdmin`, `isDeveloper`, `isSuperAdmin`, plus verification/lifecycle fields (`identityVerificationStatus`/`verificationStatus`, `accountStatus`, `accountLifecycleStatus`, `isSuspended`, `isBanned`). Users cannot edit their own role fields (`firestore.rules` `canUpdateOwnUserProfile`). No role custom claims exist; the only claims are `registrationAuthorized` and the staff-preview `previewPage`/`previewUntil`.

| Platform | Resolver | Notes |
|---|---|---|
| Mobile | `lib/services/AuthorizationService.ts` `resolve()` → `usePageAccess().authorization` | Roles `user \| premium \| moderator \| tester \| admin \| developer`; precedence admin > tester > developer > moderator > premium > user. `isAdmin` = `isAdmin===true` or role `admin`. `isDeveloper` = `isDeveloper===true` or role `developer`/`dev`. |
| Web | `context/AuthContext.tsx` → `src/store/useProfileStore.ts` | `isAdmin` = `isAdmin===true` or role `admin`/`super_admin`. Developer only via `role==='developer'`. |
| Rules | `firestore.rules` `isAdministrator()` | `isAdmin==true`, `role=='admin'` or `accountType=='admin'` (not super_admin/developer). |

Caution: mobile `lib/services/AdminAccessService.ts` treats developers/super-admins as admins for admin tools, but Firestore rules do not, so their writes can be denied.

## 2. Page access statuses

| Status | Mobile (`canAccessStatus`) | Web (`lib/pageAccess/accessPolicy.ts` `canRoleAccessPage`) | Firestore `settingAllows` |
|---|---|---|---|
| `enabled` | everyone | everyone | everyone |
| `coming_soon` / `maintenance` / `disabled` | admin, tester | admin, tester, developer | nobody (preview reads only) |
| `beta_only` | admin, tester, premium | admin, tester, developer | premium |
| `developer_only` | admin, tester, developer | admin, tester, developer | nobody (preview reads only) |
| `admin_only` | admin | admin | admin |

**Staff preview.** Mobile: developers/admins who fail normal access get "Enter read-only staff preview" (not for `admin_only`, and only if `showPagePreview !== false`); `decision.canRead` is true but `canMutate` false, and `pageAccessService.assertMutation(route)` throws. Web has no read-only mode — tester/developer/admin simply pass and see a "Preview:" pill.

**Resolution.** Settings are merged over each platform's registry by **id**; a stored doc wins entirely, including its `route`.
- Mobile `PageAccessService.normalizeRoute` strips query/trailing slash, maps `/(tabs)/X` aliases, `/ehub`→`/market`, `/profile/admin`→`/admin`. `resolveSetting`: a non-enabled `system` (`*`) doc overrides all; otherwise longest exact/prefix match, preferring any non-enabled match.
- Mobile global gate: `<PageAccessOverlay/>` in `app/_layout.tsx`, plus `PageAccessBoundary` layouts (blogs, ehub, market, projectManagement); the drawer gates with `getDecision`/`triggerOverlay`.
- Web global gate: `PageAvailabilityWrapper` + `PageAccessOverlay` in `app/layout.tsx`.

**Known gap (do not silently "fix").** Expo tab pathnames are `/Limes`, `/Discover`, `/Chat`, `/Profile`, `/Search` (capitalised, group stripped). They match no setting, so the tab screens themselves are not gated, while sub-routes are (`/limes/viewer` → `limes`, `/chat/[id]` → `messages` if its stored route is `/chat`). Closing this gap would immediately lock non-admins out of the Limes tab while `limes` is `admin_only`, so it's a product decision: report it, don't change it.

**Registry route differences.** Same id, different routes: `messages` (web `/messages`, mobile `/chat`), `profile-settings` (web `/profile/settings`, mobile `/settings`), `admin` (web `/profile/admin`, aliased on mobile). Mobile admin "reset/initialize defaults" writes mobile routes and can overwrite web routes.

## 3. Feature-level roles

- **Communities** (`lib/services/CommunityDataService.ts`): `owner` (community `userId`), `admin`, `moderator`, `member`, `none` from `communityVariantMembership`; bans in `bannedCommunityMembers`. Posting/hosting/polls follow `canCreateContent` (`postingPermission`, `verifiedMembersOnly`) → `permissions.canHostEvent` / `canCreatePoll`.
- **Projects** (`lib/types/project.ts`): `owner | admin | member | viewer`, membership `accepted | pending`. Pending invitees can read; accepted owner/admin/member write on active projects; owner/admin manage; viewers read-only. Count members as accepted only.
- **Marketplace sellers:** `sellerApplications/{uid}` (server-written); listing requires an approved `publicStores/{uid}` and a non-suspended account.
- **Support tickets:** admin or developer (server-side only).
- **Child-safety reviewers:** admin or active `childSafetyReviewers/{uid}` (server-side only).
- **Posts/blogs:** creating requires a verified identity (`PostAuthorizationService`, rules `isVerifiedUser()`).
- **Reports:** moderators and admins.

## 4. How to check access in code

- Mobile: `const { authorization, getDecision } = usePageAccess();` → `getDecision(route).canRead / .canMutate / .isDeveloperPreview`; `authorization.isAdmin / isDeveloper` for role checks; call `pageAccessService.assertMutation(route)` before writes on gated pages.
- Web: `usePageAccess(route)` → `canAccess`, `effectiveStatus`, `isDevelopmentPreview`; `useProfileStore` for `role` / `isAdmin`.
- Server (functions): `AccessPolicyService.actor()` / `assertPage()`.

## 5. Adding a page

1. Add an entry with the **same id** to both registries: mobile `lib/pageAccess/PageRegistry.ts`, web `lib/pageAccess/pageRegistry.ts`. Keep routes compatible or aliased in `normalizeRoute`.
2. Mobile: wrap the route folder's `_layout.tsx` in `PageAccessBoundary` if it needs a boundary; the global overlay covers the rest. Web: the global wrapper covers it.
3. If the page writes protected data, add a rules check (`canUseReliabilityPage('<id>', …)`) and extend staff-preview claims if needed.
4. Create the Firestore doc through the admin UI ("initialize defaults"), not by writing it directly.
5. Keep `lib/services/AuthorizationService.test.mjs` (mobile) and `lib/pageAccess/accessPolicy.test.ts` (web) in sync.

## 6. Known client/rules mismatches (report, don't paper over)

- Testers pass `coming_soon`/`beta_only` on the clients but `settingAllows` denies them, so reliability-page data (marketplace, blogs, projects, eLearning) reads fail for testers.
- Premium users pass `beta_only` on mobile and in rules, but web blocks them.
- Developers count as admins in mobile `AdminAccessService` but not in rules.
