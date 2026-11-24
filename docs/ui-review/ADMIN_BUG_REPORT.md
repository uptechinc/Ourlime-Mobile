# Admin bug sweep (mobile), 2026-11-24

**Scope:** every screen under `app/admin/*` and the components and services behind them. These were mobile-only changes: no web code and no `firestore.rules` were edited. Shared root causes are listed under *Needs decision*.

**Commits** (Ourlime-Mobile `main`):

| Commit | Screen group |
|---|---|
| `72fae30` | B1: admin gate, users, security, page access, testers, activity logs |
| `81bdbe4` | B2: products, communities, stickers, categories, moderation, reports, seed stickers |
| `5d83be8` | B3: jobs, couriers, pets, game content, e-learning, seller review, child safety, support |

**What the statuses mean:**
- **verified**: a unit test covers the fix and passes (`bun test lib/services/*.test.mjs`).
- **fixed**: the code path was traced end to end and corrected, but has **not** been run on a device or emulator.
- **needs decision**: see the list at the end.

Line numbers point to roughly where the change is; they move as files change.

## Findings

### Access and gating

| Screen | Action | Symptom | Root cause | Fix | Status |
|---|---|---|---|---|---|
| All admin | Admin check | The app and the Firestore rules disagreed on who counts as admin. `accountType:'admin'` was rejected when `role:'user'` was set. super_admin and developer accounts passed the service checks, but the rules then denied their writes. | `AuthorizationService` used `role \|\| accountType`. `AdminAccessService` also accepted super_admin, developer and dev. | New `AuthorizationService.isAdministratorRecord()` matches the rules' `isAdministrator()` exactly. `AdminAccessService.resolveIdentity` and `AdminUserService` now use it (`lib/services/AuthorizationService.ts:15-45`, `AdminAccessService.ts:43-56`). | verified (4 new tests) |
| All admin | Reviewer check | The app recognised moderators more loosely than the rules do. | Ad-hoc parsing of role, accountType and userType | `isReviewerRecord()` = admin, or `role === 'moderator'` exactly. This matches the rules' `isModeratorOrAdministrator()`. | verified |
| child-safety, support, every `/admin` route | Open | child-safety and support had no gate in the app. | There was no `app/admin/_layout.tsx`. | Added a new `app/admin/_layout.tsx`. It gates the whole stack and shows a loading state, a "Couldn't verify" screen with retry, and a lock screen. Screens are not registered twice. | fixed |
| Hub, workspaces | Header back | Back did nothing when the screen was opened from a deep link. | Plain `router.back()` | It now falls back to `/(tabs)` from the hub and to `/admin` from the shell (`app/admin/index.tsx`, `AdminWorkspaceShell.tsx:45-53`). | fixed |

### Overview, users, testers, security, page access

| Screen | Action | Symptom | Root cause | Fix | Status |
|---|---|---|---|---|---|
| Overview | Return, refresh | Counts and the approvals badge went stale. There was no pull-to-refresh. | Fetched once on mount. The cache was not bypassed on retry. | Refetch on focus. Pull-to-refresh and Retry force a fresh load (`app/admin/index.tsx`). | fixed |
| Hub skeleton | Load | 13 placeholder rows for 16 real rows | Stale constant | `AdminSkeletons.tsx:15` | fixed |
| Users | Search, paging | Only the first 50 users ever loaded, and search only covered those 50. | `hasMore` / `nextCursor` were ignored. | Load more (cursor, de-duplicated), a "Showing X of Y loaded" label, and empty states (`UserManagementSection.tsx`). | fixed |
| Users | Load fails | Empty list plus a popup, with no retry | Error was shown only in the modal | Inline error with retry | fixed |
| Users | Verify email | An audit failure was reported as a failed verification. | Two separate writes | One `writeBatch` that updates the user and writes to `adminLogs`. The rules allow both writes for admins (`AdminUserService.verifyEmail`). | fixed |
| User content | Restore fails | The error was hidden behind the modal. | Error shown at page level only | `restoreError` is now shown inside the dialog (`AdminUserContentWorkspace.tsx`). | fixed |
| Testers | Registration mode | A double tap sent the request twice. | No guard | Busy guard; buttons disabled while saving | fixed |
| Testers | Approve, reject | The server-created invitation didn't appear. | Only the row was patched locally | Silent re-fetch after success | fixed |
| Testers | Update, mode, invite | A `{success:false}` response showed as "updated". | The response was never checked | `requireApiSuccess` in `AdminWorkspaceService` | fixed |
| Testers | List | Every status was shown in green. | Hardcoded `successText` | `getStatusColor` | fixed |
| Security | Load fails | Blank area | `return null` | Error state with retry | fixed |
| Security | Remove IP or whitelist entry | Removed on one tap | No confirm | Danger `AdminDialog`; it closes only once the save succeeds. | fixed |
| Security | Add rule fails | The inputs were cleared anyway. | `handleSave` swallowed the error | Now returns a boolean; inputs clear only on success | fixed |
| Security | Add an invalid IP | Said "updated", but the rule was silently dropped. | The service filters out invalid rules | `updateSettings` throws on a new invalid rule (`AdminSecurityService.ts:~65`). | fixed |
| Page access | Load | Pages with no `order` field showed their default status. | `orderBy('order')` excludes docs that lack the field | Full read, then sorted with the existing merge (`AdminPageAccessService.ts:~66`). | fixed |
| Page access | Edit, bulk | The audit recorded `previousStatus: "unknown"`, and the activity tab went stale. | The service had no previous values | Previous values are passed in; the audit log refreshes silently. | fixed |
| Page access | Load fails | Editable defaults were shown, so saving could overwrite the real config. | Failure fell through to the defaults | Error state with retry | fixed |

### Activity logs

| Screen | Action | Symptom | Root cause | Fix | Status |
|---|---|---|---|---|---|
| Activity logs | Restore | Used native `Alert.alert` three times. | Native alerts | `AdminDialog` confirm plus toasts (`AdminActivityLogsWorkspace.tsx` `handleConfirmRestore`). | fixed |
| Activity logs | Search | Every keystroke fetched, and the input unmounted, so the keyboard closed. | Not debounced, and the loading state swapped in a skeleton | 350 ms debounce. Reloads use a refreshing state, so the toolbar stays mounted. | fixed |
| Activity logs | List | Crashed on a row with no `action`; showed "Invalid Date". | Rows were cast blindly | `toActivityLogItem()` and `formatLogTime()` | fixed |
| Activity logs | Leave and reopen; filters | The list went stale. Filtered-empty showed the "no logs yet" text. | Loaded on mount only; one empty message for both cases | Refetch on focus; separate filtered-empty text | fixed |
| Date filter | Presets | New entries were hidden after refresh. | `endDate` frozen at the time of the tap | Rolling presets have no end (`MobileAdminDateFilter.tsx`). | fixed |
| Export modal | Export | 0 rows did nothing. On error the modal closed as if it had worked. Tapping inside the card closed it. | The finally block always closed the modal; the backdrop wrapped the card | Toasts; the modal stays open on error; double-tap guard; the backdrop is a sibling of the card (`MobileAdminExportModal.tsx:41-70`). | fixed |

### Products, communities, stickers, categories

| Screen | Action | Symptom | Root cause | Fix | Status |
|---|---|---|---|---|---|
| Products, communities, stickers | Load, refresh | **Deleted products came back as "active".** | `fetchWorkspaceItems` never filtered `isDeleted` / `status:'deleted'`, and `readStatus` mapped "deleted" to active | `isSoftDeletedRecord` and `resolveWorkspaceStatus` (`lib/services/AdminWorkspaceRules.ts`), used by the new `fetchWorkspacePage` (`AdminWorkspaceService.ts:~200`). | verified |
| Products, communities, stickers | Paging | An arbitrary 100 records, with no way to see more | `limit(100)` with no `orderBy` | `orderBy(documentId())` plus a cursor, 50 per page, and Load more. No composite index needed. | verified (helper); UI traced |
| Products, communities | Stat cards | Wrong totals, including deleted items | Counted from the loaded page only | `fetchWorkspaceStats` uses server counts minus deleted items, refreshed after each write. It falls back to the loaded records if the count fails. | fixed |
| Communities | Filter, stats | Private communities were shown as public. | Only `privacy` was read, not `isPrivate` | `resolveCommunityPrivacy` | verified |
| Products | Status change | The UI showed "archived" or "disabled", but after a refresh the item showed "rejected". | The server stores every hiding decision as rejected | The UI now uses the status the callable returns. | fixed |
| Communities, stickers, categories | Any write | An error was shown although the change had saved. | `writeAudit` threw after the main write | Audit failure is logged as a warning only. | fixed |
| Products | Delete | A `{success:false}` response was treated as deleted. | The response was never checked | Throws when `success === false` | fixed |
| Products, communities, stickers, categories | Delete | One tap deleted with no confirmation. | No confirm | Danger `AdminDialog`. Products say "can be restored"; the others say "permanent". | fixed |
| Products, communities, stickers | Leave and reopen | Stale list | Loaded on mount only | Silent refetch on focus, with a guard against stale responses | fixed |

### Moderation, reports, seed stickers

| Screen | Action | Symptom | Root cause | Fix | Status |
|---|---|---|---|---|---|
| Moderation | Load | The error state never showed. | `.catch(() => [])` | `Promise.allSettled` plus an error banner per source with retry (`ModerationSection.tsx`). | fixed |
| Moderation | Return from report | Stale list | No refetch on focus | Silent refetch on focus | fixed |
| Moderation, appeals | Approve, reject | **An appeal could be marked approved while the content stayed deleted.** Legitimate 4xx rejections were overridden. | `reviewAppeal` fell back to a direct write on any error and ignored the `restoreContent` result | Falls back only when the server is unreachable. The fallback restores first and then marks the appeal, and refuses appeals already reviewed. Double-submit guard added (`AdminContentService.ts:~470`, `AdminAppealRules.ts`). | verified (rules); service traced |
| Report detail | Open an older report | "Report not found" | Searched only the newest 100 reports | Direct `getDoc(reports/{id})` (`AdminModerationService.ts:~76`) | fixed |
| Report detail | Delete | Deleted on one tap; `{success:false}` treated as success | No confirm; response unchecked | Danger `AdminDialog`; throws on failure | fixed |
| Seed stickers | Pull, run | Pull-to-refresh wiped the progress status mid-run; `{success:false}` was shown as a result. | No data to reload; response unchecked | Pull resets only when idle; guard against a second run; throws on failure | fixed |
| Deleted and bulk panels | Restore, ban, bulk delete | No defect found: results are checked, and loading and error states exist. | — | — | traced, OK |

### Jobs, commerce, e-learning

| Screen | Action | Symptom | Root cause | Fix | Status |
|---|---|---|---|---|---|
| Jobs | Load | Read the whole `jobs` collection. | No limit or ordering | `orderBy('basic_info.createdAt','desc')` and `limit(500)`. Shows a note when the list is cut off (`AdminJobsService.fetchJobs`). | verified |
| Jobs | Load | A missing field produced a wrong price or a crash. | Assumed every field exists | Pure `mapAdminJobDocument` in `AdminJobsRules.ts` | verified |
| Jobs | Reject | Wrote a top-level `rejectionReason`, which the `jobs` rules reject on the poster's later edits. | Inconsistent field paths | Writes `basic_info.rejectionReason` and `rejectedAt`. Approve clears them. | verified / fixed |
| Jobs | Reject dialog | An empty reason was allowed. | No validation | The reason is required in the UI and in the service. | verified |
| Jobs | All actions | No audit trail | No `adminLogs` write | Best-effort `writeAudit`. If it fails, the UI says "saved, audit not written". | fixed |
| Jobs | Errors | Generic "Failed to…" message | The real error was replaced | `describeJobActionError` | verified |
| Jobs | Double tap; last page | Duplicate write; empty page shown | State-based guard; page never clamped | `busyRef`; page clamped to the last page | fixed |
| Couriers | Switch tab | The tab row disappeared; a stale response could replace the list. | Tab switch set full-page loading; no request guard | Separate `listLoading` state; request-id guard; success toast; in-flight guard | fixed |
| Pets | Decision | No success feedback; double tap possible | — | Success toast and in-flight guard | fixed |
| Game content | Delete, save | Deleted item still shown when the reload failed; the success message was overwritten. | Relied on the reload | Item removed locally; message reads "Saved, but list couldn't refresh". | fixed |
| E-learning review | Confirm | Double submit possible | State-based guard | `savingRef` | fixed |
| Seller review | Load, filter | The empty text showed during loading and always said "submitted". | No loading state; hard-coded copy | Loading state; copy follows the current filter; stale-response guard; toasts | fixed |
| Approvals; ads/marketplace/admin | All | No defect found | — | — | traced, OK |

### Child safety and support

| Screen | Action | Symptom | Root cause | Fix | Status |
|---|---|---|---|---|---|
| Child-safety case | Load fails | Stuck on the placeholder forever, behind a native alert. | `getCase` error only called `Alert.alert` | Error view with "Try again" (`app/admin/child-safety/[reportId].tsx`). | fixed |
| Child-safety case | Actions | Native alerts; no success feedback; purge ran on one tap; after a purge the queue appeared twice in the history. | — | Inline note validation; toasts; danger `AdminDialog` before purge; `router.back()` when possible | fixed |
| Child-safety queue | Return; empty | Stale list; blank screen when empty | Loaded on mount only; no empty state | Refetch on focus; empty state that mentions the active filters | fixed |
| Support queue | Return; filter; error | Stale list; a slow response could overwrite a newer one; "No tickets" shown under the error | Loaded on mount; no request guard; empty check ignored the error | Refetch on focus; request-id guard; `!error` added to the empty check (`app/admin/support/index.tsx`). | fixed |

## Firestore rules check

I checked every direct client write against `firestore.rules`. Admins are allowed to make each one, and none is open to non-admins. Products, pets, couriers, child safety, support, games and seller verification only write through server functions or APIs. **No admin action is protected only by hiding the UI.**

## Needs decision

1. **Moderators and reports.** The rules let moderators read and update `reports` (`firestore.rules:~1696-1734`), and `AdminModerationService` uses `requireReviewer`. But the mobile report screens and the new `/admin` gate require admin. Decide whether to open them to moderators.
2. **super_admin and developer accounts.** On mobile these are no longer treated as admin; that was your decision. Web `lib/auth/serverRoles.ts` and `AuthContext` still accept `super_admin`, so web and the rules still disagree. This affects page-access bypass and `SecurityAccessGateService.checkAdmin`.
3. **Shared `components/support/SupportTicketConversationScreen.tsx` (not edited, because the member support flow uses it too):**
   - native `Alert.alert` at `:68, 86, 108, 127, 138`;
   - `:220` shows the status as "undefined" while loading;
   - Resolve and Close (`:412, :418`) run with no confirm.
4. **Web jobs.**
   - `app/profile/admin/jobs/page.tsx:231` has the same top-level `rejectionReason` bug.
   - Web still allows an empty reason.
   - Neither platform shows the rejection reason to the poster.
5. **Jobs without `basic_info.createdAt`** are left out of the admin list. The web server always sets it, but the rules don't require it.
6. **Audit atomicity.** Job and collection audits are best-effort: they run after the write. Putting them in the same batch would block the moderation action if the audit failed.
7. **Community delete is a hard delete.** It matches web, but it orphans memberships and posts and can't be undone. Switching to the soft delete in `/api/admin/content/delete` is an option.
8. **Stats approximations.**
   - Products "Approved" ignores `publicationState`.
   - The communities private count may include deleted ones.
   - `AdminMetricsService` counts archived users and resolved reports.
9. **Paging gaps.**
   - `fetchBetaOverview` uses `limit(100)` per collection.
   - Support `listStaff` has no cursor.
   - `SellerVerificationService.decodeApplication` throws on one malformed doc, which fails the whole queue.
10. **Server-side items.**
    - Child-safety errors come back as raw codes (`ACTION_NOTE_REQUIRED`).
    - `verifyEmail` sets only the Firestore flag, not the Firebase Auth email-verified state.
    - `resetDefaults` writes no audit entry, and its merge doesn't clear overrides.
    - `MobileExportService` does nothing when sharing is unavailable.
11. **iOS stacked modals.** A result popup shown over the full-screen user modal could be dropped on iOS. Not reproduced.

## Checks

| Check | Result |
|---|---|
| Unit tests | `bun test` on AuthorizationService, PageAccessService, PendingApprovalsRules, AdminWorkspaceRules, AdminAppealRules and AdminJobsRules: all pass (27 + 7 + 6 tests). |
| `tsc --noEmit` | Only 3 errors, all in `lib/email/EmailService.ts` ("Cannot find namespace 'nodemailer'"). They were there before this sweep, and the file is untouched. |
| `expo lint` | Clean on every changed file. One exception, already in the code before this sweep: `AuthorizationService.test.mjs` imports a `.ts` file, which the `import/namespace` rule can't parse. |
| `check:discipline` | 34 `safe-area-edges` violations, all already present, in projectManagement, jobs, events, eLearning, eHub and profile. None are in admin files. |
| Device / emulator | Not run. Every **fixed** row is code-traced only. |

Also updated: `docs/EDGE_CASES_AND_POTENTIAL_BUGS.md`. Its note that the Firestore rules were open was out of date.
