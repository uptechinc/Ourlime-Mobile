# Ourlime Mobile: edge cases and potential bugs

Written on 2026-10-04 after an emulator test run, based on the current code (not guesses). Each item names the file it
comes from, a concrete scenario, and a suggested fix. Severity: **High** (data loss, privacy, or a feature stops
working), **Medium** (wrong numbers, duplicates, confusing states), **Low** (polish).

> **Applies to every page:** the Firestore rules are currently open ("keep it simple and open for now"). Many checks
> below (blocks, edit windows, counts, roles, visibility) only run inside the app, so anyone calling Firestore
> directly can skip them. Locking the rules down is the biggest single risk reducer once you're ready.

---

## Fix status (app only, 2026-10-04)

**Fixed in the app:** 1.1, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9 · 2.1, 2.2, 2.3, 2.4, 2.6, 2.7, 2.8, 2.9 · 3.1 (partly), 3.2, 3.3,
3.6, 3.7, 3.8, 3.9 · 4.1, 4.3, 4.4 · 5.1, 5.2, 5.3, 5.4 · 6.1 (partly), 6.2, 6.3, 6.4, 6.5, 6.6 · 7.1, 7.2, 7.3 (partly),
7.4, 7.5, 7.6, 7.8

**Already handled before this pass:** 1.10 (resend button after sign-up), 2.5 (feed pages are de-duplicated by post ID),
3.5 (joins/leaves use `increment`), 4.2 (Start/Complete busy guard), 4.5 (due dates are read as local dates).

**Needs a server, rules or website change (not done, app only):**
- 1.2: the sign-up rate limit lives in Cloud Functions.
- 1.3 server side: `startRegistration` still checks usernames with an exact match. The app now reserves names at
  `usernames/{lowercase}`, but the website and the function don't use that yet.
- 3.1: the app now loads every community (not just 250), but each load still reads all memberships. Stored
  member/friend counts need a Cloud Function.
- 3.4: website posts don't increment `postCount`; the app re-counts them.
- 6.1: private Limes are now dropped inside the service (never cached or shown). Stopping them being downloaded at all
  needs a `visibility` index and rules.
- 7.3, 7.7: the edit window and blocks are enforced in the app only; real enforcement needs rules or a function.
- 7.9, 7.10: `callPairs` rules and call heartbeats are server work.

---

## 0. What was verified on the emulator (Pixel 6, debug build via Metro, 2026-10-04)

| Fix | Result |
|---|---|
| E-Projects "secure session is still connecting" on a fresh install | ✅ Fixed: board opens, New Task form opens, task created with HIGH priority and a due date |
| New Task form (replaces the old "Task drafts" screen) | ✅ Title, priority, column, assignee and due date picker all work; "Task created" toast shows |
| Events page Starts/Ends pickers | ✅ Date dialog, then time dialog; End fills in automatically (start + 2 h) |
| Community "Host an event" pickers | ✅ Validation messages, auto End, readable dates; Edit pre-fills the pickers |
| Community "Posts" count | ✅ 1 → 2 on post, 2 → 1 on delete, updates straight away |
| Join/Leave stuck on "Updating…" | ✅ Waits only for the write now (about 3–5 s on the emulator; was the write plus two full re-fetches) |
| "Community of the week" empty cover | ✅ The Storage cover link now loads |
| Share sheet spinner on first open | ✅ Chats show within about 1 s |
| Crop 1:1 lag | ✅ Ratio applies in about 1 s on the debug emulator |
| `ourlime://communities` opened a 404 | ✅ Fixed (it now opens the Communities directory) |
| App preview pill covering page titles | ✅ Moved above the tab bar |

Found during the test run, **not fixed** (listed in the sections below): the communities directory is fetched twice at
startup, a Firestore index is missing, the community page takes about 10 s to load on the emulator, the login screen
flashes on cold-start links, and some share-sheet avatars are blank.

---

## 1. Sign up / Login

| # | Sev | Edge case / bug | Where | Suggested fix |
|---|---|---|---|---|
| 1.1 | **High** | **A half-finished sign-up leaves a stuck account.** `register()` creates the Auth user and signs in first, *then* uploads the photo and ID documents and writes the profile. If any later step fails (no network, upload error), the `finally` only signs out. The Auth account exists, but the profile is incomplete. Retrying says "An account with this email already exists"; signing in finds a profile with no `registrationStatus: 'complete'`. | `lib/services/AuthService.ts` `register()` | Mark the profile `registrationStatus: 'started'` on the server in `startRegistration`. On sign-in, detect an incomplete status and resume the remaining steps (or let the server delete accounts abandoned for more than 24 h). |
| 1.2 | Medium | **The sign-up rate limit barely works.** "10 attempts per hour" is a `Map` in the function's memory. Every Cloud Functions instance has its own map, and it resets on each cold start. | `functions/src/RegistrationService.ts` | Store attempt counters in Firestore (doc per IP hash, with a TTL) or use App Check plus reCAPTCHA. |
| 1.3 | Medium | **Usernames are case-sensitive and can race.** The check is `where('userName','==',x)`, so `Ron` and `ron` can both exist. Two people signing up with the same name at once can both pass the check. | `RegistrationService.ts`, `ProfileService.ts`, `BasicInformationService.ts` | Save a `userNameLower` field and reserve it in a transaction on a `usernames/{lower}` doc. Look users up by the lowercase field. |
| 1.4 | Medium | **The username check can show a stale result.** The 500 ms delayed check doesn't cancel older requests, so a slow reply for an old value can say "taken" for the name now typed. | `mobile/Register/index.tsx` | Keep a request counter or the latest value and ignore replies that don't match it. |
| 1.5 | Medium | **Age can be off by a day.** `new Date('YYYY-MM-DD')` reads the date as UTC. In Trinidad (UTC-4), someone born on the 15th counts as born on the 14th at 8 PM, so on their birthday the age check can be a day early or late. This matters at the 13/18 boundaries. | `mobile/Register/index.tsx` `calculatedAge` | Parse the parts as a local date (`new Date(y, m - 1, d)`) or reuse `dateOfBirthService.parse`. |
| 1.6 | Medium | **Login requires 8+ character passwords.** Older accounts made with Firebase's 6-character minimum (or on the website) can't even try to sign in from the app. | `app/(auth)/login.tsx` `handleLogin` | Only check that the password isn't empty on login, and keep the 8-character rule for sign-up and reset. |
| 1.7 | Low | **"Resend verification" sends the raw email.** `resendEmailVerification(email, …)` doesn't trim it, so a trailing space from autofill gives "invalid email" even though login trims. | `login.tsx` `handleResendVerification` | Use `email.trim()`. |
| 1.8 | Low | **Login screen flashes on cold-start links** (seen on the emulator). An `ourlime://…` link opened while the app is closed shows the login screen briefly. Firebase hasn't restored the session yet, so `+native-intent` sends the link to `/(auth)/login` and then continues. | `app/+native-intent.tsx` | Wait briefly for `onAuthStateChanged` (or show the splash) before deciding the user is signed out. |
| 1.9 | Low | **Double-tap on Login.** `isSubmitting` is state, so two taps in the same frame can both start sign-in. | `login.tsx` | Add a ref guard, as the call buttons have. |
| 1.10 | Low | **Unverified email after "Login".** After sign-in, a user whose email isn't verified is signed out with a message. If the verification email itself failed (`verificationEmailSent: false`), they can only resend it from the login screen. Make sure that path is obvious. | `AuthService.ts` | Show the resend button on the "check your email" step after sign-up too. |

## 2. Feeds

| # | Sev | Edge case / bug | Where | Suggested fix |
|---|---|---|---|---|
| 2.1 | **High** | **Likes can be lost when two people like at once.** Feed post likes read `likesCount.likeCount`, add 1 in the app, and write the absolute number back. Two likes at the same moment both write `N + 1`. | `lib/services/PostService.ts` `toggleLike` (non-community branch) | Use `increment(±1)`, as community posts do, or a transaction. |
| 2.2 | Medium | **Duplicate like counters.** When a post has no `likesCount` doc yet, two first likes each create one (`doc(collection(...))`), and later reads pick one at random (`limit(1)`). | same | Use a fixed doc ID (`likesCount/{postId}`). |
| 2.3 | Medium | **Community likes can double-count.** Community post likes are saved under random IDs without a transaction. A fast double-tap or two devices can create two like docs and add 2. | `PostService.toggleLike` (community branch) | Use the doc ID `${postId}_${userId}` (like feed posts) and write it in a transaction. |
| 2.4 | Medium | **Profile post count goes to the wrong person.** Deleting a post subtracts 1 from `currentUserId`'s `postsCount`, not the author's. An admin deleting someone's post lowers the admin's own count. | `PostService.deletePost` | Read `userId` from the post being deleted. |
| 2.5 | Medium | **Feed order across pages after reposts.** We now sort each page by the original post's date, but pages are still fetched by raw doc time. A repost can pull an old post into page 1, and the same post can appear in two pages. | `PostService` feed and `lib/posts/FeedQuery.ts` | Remove duplicates by post ID across pages in the feed store (keep the first position). |
| 2.6 | Medium | **Only one upload at a time.** `PostSubmissionService.start` throws "A post is already uploading" while one is running. Posting from a community while a feed upload runs fails. | `PostSubmissionService.ts` | Queue submissions, or block the Post button with that message before the user writes everything. |
| 2.7 | Low | **Upload retry only lives in memory.** The message says "Your draft is kept for retry while this app stays open". Killing the app loses the failed upload. | same | Save failed submissions to the local draft store. |
| 2.8 | Low | **Missing Firestore index** (seen on the emulator). The `ActivityService` `userPosts` query (`userId` + `createdAt`) logs "The query requires an index" on every start. | `ActivityService` | Create the composite index (the link is in the log) and add it to `firestore.indexes.json`. |
| 2.9 | Low | **Drafts expire on the device clock.** "Expires in X days" and deleting expired drafts use `Date.now()`, so a wrong phone clock deletes drafts early or keeps them too long. | `DraftExpiryService.ts` | Use `serverTimestamp` for `createdAt` and compare against the server time from the last read. |

## 3. Communities

| # | Sev | Edge case / bug | Where | Suggested fix |
|---|---|---|---|---|
| 3.1 | **High** | **The directory stops at 250 communities.** `getDirectoryPage` loads at most 250 communities (`MAX_SOURCE_COMMUNITIES`), plus every membership of every one of them, on each load. Community 251+ never appears, search only looks inside those 250, and load time grows with total membership. | `lib/services/CommunityDataService.ts` | Paginate on the server (Firestore `startAfter`). Store `memberCount` / `friendMemberIds` on the community (Cloud Function or batch) instead of reading every membership. |
| 3.2 | Medium | **The directory is fetched twice at startup** (seen on the emulator). Discover's "Featured Communities" and the Communities page each start their own full fetch; the first took about 23 s while the app was starting. | `CommunityService.fetchDirectory` callers | Share one in-flight request per query key (the same pattern as `CommunityDetailResourceService.inFlight`). |
| 3.3 | Medium | **The community page is slow** (about 10 s on the emulator). `getCommunityDetail` = `resolveAccess` (3 rounds) + the single-community directory build (memberships, friends, requests, bans, users, pictures, categories). The tap also doesn't navigate until the data is in. | `CommunityDataService.getCommunityDetail` | Run the access checks and the card build together (`Promise.all`). Navigate at once with the cached card (from the list) as placeholder data. |
| 3.4 | Medium | **Post counts are rebuilt with a count query.** Counts stored as `0` are re-counted (`getCountFromServer`) and corrected. That's one extra query per such community on each first load until it's fixed. Posts created on the **website** don't increment the counter, so they still drift. | `CommunityDataService` and the web post creation route | Increment `postCount` on the web too, or move counting to a Cloud Function trigger. |
| 3.5 | Medium | **Member count can drift.** Join/Leave now works out the count as old count ± 1. If two people join at once, each screen shows N + 1 until the background re-fetch (which now runs after). | `CommunityService.updateMembership` | Fine as a placeholder, but make sure the stored `membershipCount` uses `increment` on the server path. |
| 3.6 | Medium | **Private community requests.** Requesting access twice quickly, or cancelling while the owner accepts, can leave a `communityRequests` doc and a membership at the same time (`membershipState` uses membership first, then request status). | `CommunityDataService.updateMembership` | Use a transaction keyed by `${communityId}_${userId}` for request, membership and cancel. |
| 3.7 | Low | **The community composer shows Public/Friends/Private** (seen on the emulator). Community posts ignore this choice (they're stored as `visibility: 'community'`). | `CreatePostModal` when `communityId` is set | Hide the visibility chips for community posts. |
| 3.8 | Low | **Events and polls: forced reloads.** Fixed: a forced reload no longer reuses an older request. But `finally { inFlight.delete(key) }` can delete a newer request's entry. | `CommunityDetailResourceService.loadWorkspace` | Only delete if `inFlight.get(key) === request`. |
| 3.9 | Low | **Broken cover images** now fall back to the icon, but the card still downloads the broken URL on every scroll. | `CommunityCard`, `CommunityOfTheWeek` | Remember failed URLs in a module-level `Set`. |

## 4. E-Projects

| # | Sev | Edge case / bug | Where | Suggested fix |
|---|---|---|---|---|
| 4.1 | **High** | **Duplicate projects.** `createProject` falls back to a direct Firestore write when the server call *fails*. If the call timed out after succeeding on the server, the fallback creates a second project. | `lib/services/ProjectService.ts` `createProject` | Generate the project ID on the client and send it to the server (the server reuses it if it already exists), or only fall back on clear "function unavailable" errors. |
| 4.2 | Medium | **Task moves have no busy state.** `handleUpdateStatus` has no guard or optimistic update. "Start" becomes "Complete" only when the live update arrives, so a quick second tap moves the task straight to Done. | `app/projectManagement/[id]/index.tsx` | Disable the button for that task while saving and show the next state straight away. |
| 4.3 | Medium | **Unguarded task actions.** `handleToggleSubtask`, `handleAddTimeEntry` and `handleDeleteTask` don't check `writeCapability` or have a double-tap guard. Viewers see a server error instead of a clear message, and a double tap logs time twice. | same file | Use `handleCapabilityAction` and a per-action busy ref, as for comments and subtasks. |
| 4.4 | Medium | **No "connecting" state for the session.** The session bridge now retries on its own, but if `nativeSession` endpoint is down, every action says "still connecting" with no Retry button. | `NativeSessionService`, project screens | When status is `retryable_failure`, show its `error` with a **Retry** button that calls `retryNativeSession()`. |
| 4.5 | Low | **Due dates are calendar dates only.** Tasks store `dueDate` as `YYYY-MM-DD` with no time zone. If anything later compares it with `new Date('YYYY-MM-DD')` (UTC midnight), people in Trinidad (UTC-4) see it a day off. | `CreateTaskSheet` / task cards | Always read due dates as local calendar dates. |

## 5. Profile

| # | Sev | Edge case / bug | Where | Suggested fix |
|---|---|---|---|---|
| 5.1 | Medium | **Usernames are case-sensitive in links** (`/profile/[username]`, mentions, deep links). `ourlime.com/profile/Ron` and `/profile/ron` are different, and changing your username breaks old links and @mentions. | `ProfileService.ts`, `LinkPreviewDataService.ts`, `NotificationService.ts` | Look up users by a `userNameLower` field and keep an `oldUserNames` redirect list. |
| 5.2 | Medium | **Username change can race.** The check reads and then writes without a transaction, so two people can take the same name. | `lib/profile/abouts/basicInformation/BasicInformationService.ts` | Same `usernames/{lower}` reservation as 1.3. |
| 5.3 | Medium | **Post count drift.** `postsCount` goes up on app-created home posts only. Website posts, Limes and community posts don't count, and deletes by admins hit the wrong user (2.4). | `PostService`, web routes | Count with `getCountFromServer` on the profile (and cache it), or keep one server-side counter. |
| 5.4 | Low | **Followers and friends counts.** `followersCount || stored` treats a real `0` as "missing" and falls back to the stored number, so unfollowing everyone can still show the old count. | `ProfileService.toProfile` | Use `??`, not `||`, when the live count is known. |

## 6. Limes

| # | Sev | Edge case / bug | Where | Suggested fix |
|---|---|---|---|---|
| 6.1 | **High (privacy)** | **Private and friends-only Limes are downloaded to everyone.** The feed query has no `visibility` filter; the app hides private Limes after downloading them. Anyone inspecting traffic (or a changed app) can see them. | `lib/services/LimeService.ts` `fetchFeed` + `app/(tabs)/Limes.tsx` `displayedLimes` | Add `where('visibility','==','public')` for For You, plus a separate friends query (`in` on friend IDs), and enforce it in the rules. |
| 6.2 | Medium | **Short "Following" feed.** It scans only the newest 50 Limes and keeps the ones from people you follow. Following a few quiet accounts gives an empty or short feed, and `hasMore` can stop early. | `LimeService.fetchFeed` | Query `where('userId','in', followingChunk)` in chunks of 30. |
| 6.3 | Medium | **Empty pages stop pagination.** If every Lime on a page is hidden (deleted or private), the page renders nothing; depending on `hasMore`, the user sees "no more Limes" while more exist. | Limes screen / `LimeResourceService` | Keep fetching until at least N visible items or the end. |
| 6.4 | Medium | **"Reposted by" loads every reposter.** `attachReposters` reads every repost marker and every reposter profile for each page, just to show 3 bubbles. | `LimeService.attachReposters` | Read up to 3 profiles (you and friends first), show the count from `stats.reposts`, and load the full list when the sheet opens. |
| 6.5 | Low | **Repost count can disagree with the bubbles.** The number comes from `stats.reposts`, while the bubbles list only reposters who are friends. "+N" is worked out from the list, so a Lime with 10 reposts from strangers shows no bubbles while the count says 10. | `Limes.tsx` | Decide one rule: "+N" from the total count minus visible bubbles. |
| 6.6 | Low | **Your repost bubble falls back to your Auth display name.** It's swapped for your profile later, but a slow network shows "You" with no photo for a while. | `Limes.tsx` `withViewerReposter` | Use the cached own profile (`useResourceStore.ownProfiles`) straight away. |

## 7. Chats (and calls)

| # | Sev | Edge case / bug | Where | Suggested fix |
|---|---|---|---|---|
| 7.1 | **High** | **Some messages stay unread forever.** "Mark read" loads at most 100 received messages, with no sort order (`limit(100)`, no `orderBy`), and marks only those. In a chat with more than 100 received messages, the rest may never be marked read, so ticks and read receipts stay wrong. | `lib/services/ChatDataService.ts` (mark-read) | Query `where('status','!=','read')` in pages until none are left (batches of 450 or fewer), or store `lastReadAt` per user instead of updating each message. |
| 7.2 | Medium | **Message times come from the phone's clock** (`Timestamp.now()`). A phone with the wrong time sends messages that sort into the past or future, for both people. | `ChatDataService.sendMessage` | Use `serverTimestamp()` for ordering, and keep the client time only for showing a pending message. |
| 7.3 | Medium | **The edit window is checked only in the app** (`Date.now() - createdAt > 20 min`). Changing the phone clock allows late edits, and with open rules anyone can edit. | `ChatDataService` edit | Enforce it in the rules or a callable function using server time. |
| 7.4 | Medium | **Shared unread counter.** `chats/{chatId}.unreadCount` is one number for both people. Each message adds 1 whoever sent it, and either person reading resets it to 0. Per-user summaries are right, so anything reading the chat doc's count is wrong. | `ChatDataService.sendMessage` / mark-read | Remove that field or make it per user (`unreadCount.{userId}`). |
| 7.5 | Medium | **Duplicate messages on retry.** There's no client message ID, so a send that timed out but actually landed, followed by a retry, appears twice. | `sendMessage` | Generate the message doc ID on the client and use `set` (repeating the same send then does nothing). |
| 7.6 | Medium | **The old chat-doc message array keeps growing** (`chats/{id}.messages` is still updated on read and edit). Long old chats hit the 1 MB document limit and every update to them fails. | `ChatDataService` | Stop writing the array; read old messages once and move them to the subcollection. |
| 7.7 | Medium | **Blocks are checked only in the app.** `sendMessage` reads both block lists and then writes. With open rules (or a block applied between the read and the write), a message can still go through. | `ChatDataService.sendMessage` | Enforce blocks in the rules / server. |
| 7.8 | Low | **Blank avatars in the share sheet** (seen on the emulator): some chats show an empty green circle with no photo or initial. | `ShareContentSheet` recipient rows | Fall back to the initial when `profileImage` is empty or fails. |
| 7.9 | Low | **Calls: the "calling on another device" pill depends on `callPairs` being readable.** It reads the `callPairs` collection, and if the rules are tightened later it silently stops showing (the server block still works). | `useCallElsewhereNotice` (web + app) | Add a rule: participants can read `callPairs/{a_b}` when their UID is in the key. |
| 7.10 | Low | **Calls: a 4-hour safety window.** A call that crashes without ending blocks a new call between the same two people for up to 4 hours. | `CallSessionService` / `callServer` | Add a heartbeat (`lastSeenAt`) to active calls and treat 2 minutes without one as ended. |

---

### How to re-run the emulator checks

```bash
npx expo start --dev-client --port 8081
adb reverse tcp:8081 tcp:8081
adb shell am start -a android.intent.action.VIEW -d "exp+ourlime://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

Sign in with a test account, then follow section 0.
