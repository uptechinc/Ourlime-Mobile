# Recon: Ourlime mobile admin and Saved (2026-11-24)

This is the shared context for the admin bug sweep (Agent B), the admin redesign (Agent A) and Saved (Agent C). Paths are relative to `Ourlime-Mobile/` unless they start with `web:`, which means the repo root (the Next.js app).

## 1. Design system

**Mobile theme**
- The real source is `lib/contexts/ThemeContext.tsx`, exposed through `useAppTheme()`, which returns `{ theme, isDark, colors, setTheme }`.
  - It supports light, dark and system modes, saves the choice, and follows `Appearance`.
  - `constants/Colors.ts` is the unused Expo template. Ignore it.
- Light tokens:
  - Surfaces and text: canvas `#f8fafc`, surface `#fff`, control `#f1f5f9`, text `#0f172a`, secondaryText `#334155`, mutedText `#64748b`, border `#e2e8f0`.
  - Accent: `#10b981` (accentText `#047857`).
  - States: destructive `#dc2626` (surface `#fef2f2`), warning `#fffbeb`/`#92400e`, success `#ecfdf5`/`#047857`.
- Dark tokens: canvas `#020617`, surface `#0f172a`, elevated `#111c31`, control `#1e293b`, border `#334155`, accentText `#34d399`.
- `tailwind.config.js` holds only the brand colours: `greenTheme #10b981`, `greenBright #01eb53`, `redTheme #c64d53`, `themeStart/End #01eb53/#2dd4bf`.
  - It has no type, spacing, radius or shadow scale.
- Admin components use inline `style={{}}` with `colors.*`. They barely use NativeWind (8 `className` uses in `components/admin`).
- Typography is ad hoc: weights `800`/`900`, sizes 10 to 21.
- Radius is ad hoc: 13 to 15 for cards and buttons, 22 for dialogs, 999 for pills.
- Shadows are almost absent: only `components/ui/AppHeader.tsx:111` has one.

**Where mobile disagrees with the web `admin-*` palette** (`web:tailwind.config.ts:71-119`, `web:.agents/rules/admin-ui-colors.md`)

| Topic | Web `admin-*` | Mobile today |
|---|---|---|
| Token depth | soft/muted/border/DEFAULT/strong/solid/hover for each state | one surface and one text colour per state |
| Danger hue | rose (`#be123c`, `#e11d48`, `#fff1f2`) | red (`#dc2626`, `#fef2f2`, `#b91c1c`) |
| Pending | `#b45309`, solid `#d97706`, border `#fde68a` | warning surface and text only; `AdminDialog` hardcodes `#d97706` and `#10b981` |
| Buttons | soft tint, border and base text; no saturated fills | solid fills with white text (`AdminDialog` confirm buttons, selected tabs in `app/admin/index.tsx:256`, sticker tabs) |
| Raw hex | banned | everywhere: `AdminSecurityWorkspace` about 49, `AdminActivityLogsWorkspace` 12, `ModerationSection` 9, `UserManagementSection` 8 |
| Theme use | n/a | `components/profile/AdminTab.tsx` hardcodes a dark slate panel and ignores the theme |
| Dark mode | none | full |
| Info colour | `admin-info-*` exists but is discouraged | none |

## 2. Navigation and flow

**Tabs** (`app/(tabs)/_layout.tsx`): Home, Discover, Limes, Chat, Profile, Search.

**Ways into admin**
- `components/profile/ProfileHeader.tsx:160` and `components/profile/AdminTab.tsx` push `/admin`, the latter with a `section` param.
- The slide-out menu entries in `lib/navigation/AppNavigation.ts:38-39` link to `/admin` and `/admin/approvals`.
- `DeepLinkService` maps `/profile/admin` to `/admin`.
- `PreloadRegistryService` preloads admin data.

**Structure**
- There is no `app/admin/_layout.tsx`. Each screen is a root stack route.
- `app/admin/index.tsx` (703 lines) is the hub.
  - Its section switcher is `overview | users | moderation | page_access | security | seller_review`, rendering `UserManagementSection`, `ModerationSection`, `PageAccessAdminSection`, `AdminSecurityWorkspace` and `SellerReviewSection`.
  - It also links to the standalone workspaces.
- These routes only redirect to `/admin?section=…`: `dashboard`, `moderation`, `reports`, `page-access`, `security`, `user-management`.
- Standalone workspaces (route, then component):

| Route | Component |
|---|---|
| `activity-logs` | `AdminActivityLogsWorkspace` |
| `analytics` | `AdminAnalyticsWorkspace` |
| `approvals` | `AdminPendingApprovalsWorkspace` |
| `categories`, `community-categories` | `AdminCategoryWorkspace` |
| `communities`, `products`, `stickers` | `AdminCollectionWorkspace` |
| `couriers` | `AdminCouriersWorkspace` |
| `pet-adoption` | `AdminPetsWorkspace` |
| `jobs` | `AdminJobsWorkspace` |
| `elearning-review` | `AdminLearningReviewWorkspace` |
| `game-content` | `AdminGameContentWorkspace` |
| `seed-stickers` | `AdminStickerSeedWorkspace` |
| `testers` | `AdminTestersWorkspace` |

- These screens are inline (no workspace component):
  - `reports/[reportId]` (1599 lines)
  - `child-safety/index` and `child-safety/[reportId]`
  - `support/index`
  - `support/[ticketId]`, which uses `components/support/SupportTicketConversationScreen`
- `ads/marketplace/admin/proof-verification` is a "not available yet" notice, the same as on web.

**Shared admin pieces**
- `AdminWorkspaceShell`: header, back button, link to the admin hub, page-access lock, pull-to-refresh, skeleton and error state.
- `AdminDialog`: tones positive, danger and pending.
- `AdminDeletedContentPanel` and `AdminBulkDeletionPanel`: used only by `ModerationSection`.
- `AdminSkeletons`.
- `MobileAdminDateFilter` and `MobileAdminExportModal`.
- From `components/ui`: `FilterBar`, `FilterSheet`, `PageHeader`, `CustomModal`, `AppToastHost`.

## 3. Security

**Rules**
- There is one shared `web:firestore.rules`; mobile has no rules file of its own.
- `isAdministrator()` (`:76-84`) reads the user's document and accepts `isAdmin`, `role == 'admin'` or `accountType == 'admin'`. It does not use custom claims.
- Users cannot promote themselves: the role fields are not self-editable, and `accountType` is limited to regular or student.

**Mobile checks**
- The UI gate is `usePageAccess().authorization.isAdmin`, from `lib/services/AuthorizationService.ts:25-44`. It accepts `isAdmin` or `(role||accountType) === 'admin'`.
- The service gate is `lib/services/AdminAccessService.ts:42-55`. It also accepts `isSuperAdmin`, `isDeveloper`, `super_admin` and `developer`/`dev`.
- The canonical definition, decided 2026-11-24, matches the rules: `isAdmin === true || role === 'admin' || accountType === 'admin'`. This is a mobile change only.

**No client gate:** `child-safety/*` and `support/*` have none and rely on the server API.

**Web checks**
- `web:middleware.ts:113-116` applies the security check to `/profile/admin` and `/api/admin`.
- Pages check `isAdmin`/`role`.
- Server routes use `web:lib/auth/serverRoles.ts:12-20`, which also accepts `super_admin`.

**Conclusions**
- No admin write is protected only by hiding the UI. Product, pet, courier, child-safety, support and games writes are server-only. Admin-owned collections need `isAdministrator()`.
- Gaps:
  - The three admin definitions disagree.
  - `reports` allows moderators in the rules (`:1696-1715`), but the mobile UI requires an admin. This needs a decision.

## 4. Feature parity

All 21 web pages under `web:app/profile/admin/` have a mobile counterpart.

The brief listed support, child-safety, seed-stickers and ads/marketplace/admin as mobile-only. That is wrong: web has them under `web:app/admin/` and `web:app/ads/marketplace/admin/`.

Real differences:

| Web | Mobile |
|---|---|
| `seller-verification` (its own page) | the `seller_review` section of `/admin` (`SellerReviewSection`) |
| `reports` list page | `/admin/reports` redirects to moderation; only `reports/[reportId]` is a real screen |
| `dashboard` page | `/admin/dashboard` redirects to the overview |

## 5. Data layer

**No admin stores.** Admin uses no Zustand stores; the only exception is `useSupportTicketStore` in the support conversation screen. Screens load into local `useState` with no listeners.

**Refreshing**
- Lists load on mount and on pull-to-refresh.
- Only `AdminLearningReviewWorkspace` and `AdminPendingApprovalsWorkspace` refetch on focus.
- After a write, screens patch local state once the `await` succeeds. Toasts do not fire before the write finishes.

**Which service backs each screen**

| Screen | Service | Write path |
|---|---|---|
| products, communities, stickers | `AdminWorkspaceService` | products: `reviewProductListing` callable and `/api/admin/content/delete`; others: direct writes plus an `adminLogs` audit |
| categories | `AdminWorkspaceService` | direct writes to `customCategories`/`communityCategories` |
| analytics, testers, seed-stickers | `AdminWorkspaceService` | count queries; `adminApi` callable |
| jobs | `AdminJobsService` | direct writes to `jobs`, `users` and `private/profile` |
| page-access | `AdminPageAccessService` | batch writes plus audit |
| security | `AdminSecurityService` | `siteConfig/securityAccessControls` |
| users | `AdminUserService` | Firestore list, API fallback; role change via API |
| moderation | `AdminModerationService`, `AdminContentService` | API |
| pets, couriers, child-safety, support, game content | their own services | API |

**Known bug leads** (to confirm in the sweep)
- `AdminWorkspaceService.fetchWorkspaceItems` (`:173-177`):
  - It doesn't filter soft-deleted products, and `readStatus` maps `deleted` to active (`:139-144`, `:370-372`).
  - It uses `limit(100)` with no `orderBy`.
  - It writes the audit entry after the main write, so an audit failure shows an error even though the change was saved.
- `AdminJobsService`:
  - unbounded fetch;
  - `rejectionReason` at two different field paths;
  - no audit entry;
  - generic errors.
- `AdminContentService.reviewAppeal` falls back to a direct write on any API error, and doesn't check `restoreContent`.
- Native `Alert.alert`:
  - `AdminActivityLogsWorkspace.tsx:140,152,155`;
  - `app/admin/child-safety/[reportId].tsx:44,59,77`, which also never gets an error state if `getCase` fails;
  - the shared `SupportTicketConversationScreen`.
- `docs/EDGE_CASES_AND_POTENTIAL_BUGS.md:7` says the rules are open. That is stale.

## 6. Saved (current state)

**Saved pages**
- Web `web:app/saved/page.tsx` and mobile `app/saved/index.tsx` are both "Coming Soon" stubs, gated as `coming_soon` in the page registries.

**The "Saved" feed filter does nothing on either platform**
- Web: `mapFeedFilter` falls back to "all".
- Mobile: it matches `post.isSaved`, which is never set.

**Where saves are stored today**
- Jobs: `users/{uid}/savedJobs/{jobId}` `{jobId, savedAt}`, the same on both platforms.
- Blogs: `users/{uid}/savedBlogs/{blogId}`, written by the server only.
  - Web writes `{blogId, savedAt}`; the mobile callable writes `{userId, blogId, createdAt}`.
- Events: top-level `eventBookmarks/{autoId}` `{eventId, userId, createdAt}`. Duplicates are possible.
- Market and eHub product favorites: device-only.
  - Web uses localStorage `ourlime_market_favorites_v1` and `ourlime_ehub_favorites_v2`.
  - Mobile uses AsyncStorage (`MarketplacePreferenceService`, `EHubCommerceService`).
- Posts, limes, communities, courses, pets and eHub providers have no save feature.
  - Web `FeedPost` has a save button, but only in local state, and the component itself is dead code.
