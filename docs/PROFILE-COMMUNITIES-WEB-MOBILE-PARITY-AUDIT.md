# Profile and Communities Web-to-Mobile Parity Audit

Audited: 2026-08-12  
Web source: `C:\Users\aaron\Github\Ourlime-Web`  
Mobile source: `C:\Users\aaron\Github\Ourlime-Web\Ourlime-Mobile`

This is the focused source-of-truth for Profile, public profiles, Communities, and community-detail work. `Done in source` does not mean deployed or manually verified. Native screens should preserve the web capability and information hierarchy without copying desktop rails, hover effects, or browser dialogs. All confirmations, reports, errors, and destructive actions must use Ourlime-styled native modals or bottom sheets; never `Alert.alert` or a simulated success message.

## Status legend

- **Done in source**: a real mobile UI and canonical service mutation/read exist.
- **Partial**: a usable subset exists, but the web contract is materially broader.
- **Missing**: no truthful mobile equivalent exists.
- **Manual/deployment pending**: source exists but needs rules/API deployment or user device verification.

# 1. Own Profile

## 1.1 Routes, shell, and navigation

| Web contract | Mobile status and evidence | Required work |
| --- | --- | --- |
| Persistent profile shell with static sidebar and right workspace | **Native adaptation.** `app/(tabs)/Profile.tsx` keeps the tab shell mounted and changes content in place. Drawer replaces the desktop sidebar. | Preserve tab state/scroll when navigating back; do not animate/rebuild the whole profile for an internal destination. |
| Main workspaces: Timeline, Reposts, Customize, About, Gallery | **Partial.** Timeline, Friends, About, Gallery, and role-gated Admin exist. | Implement Reposts and Customize from canonical services. Keep missing destinations hidden rather than exposing inert buttons. |
| Sidebar destinations for Friends, Settings, Products, Jobs, Business Account, and Admin | **Partial.** Friends is now a real profile tab; Settings and Admin routes exist. | Products, Jobs, and Business Account remain Coming Soon until their complete service-backed routes are ready. |
| Profile/settings navigation and role-based admin destinations | **Partial.** Admin rendering checks canonical profile role fields and Admin services independently authorize routes. | Manually verify ordinary, moderator, admin, archived, suspended, private, and blocked accounts. |

## 1.2 Header, identity, and profile media

| Web contract | Mobile status and evidence | Required work |
| --- | --- | --- |
| Cover/banner, avatar, full name, username, verified state, admin badge, bio/status | **Done in source.** `ProfileHeader`, `CachedImage`, and `UserAvatar` render the native header with emerald fallback initials. | Manually compare sizing, crop, contrast, long-name wrapping, and missing-image states on small and large devices. |
| Post, friend, follower, and following counts; count links | **Partial.** Live summary counts render; Friends opens the real Friends tab. | Add follower/following lists and make their counts navigable with privacy-aware pagination. |
| Share profile | **Done in source, native adaptation.** Native share sheet sends the canonical web profile URL. | Add share preview/copy-link affordances only if needed; verify deep link resolves to the correct public profile. |
| Change avatar through image library/upload and canonical assignment | **Done in source; rules deployment/manual verification pending.** `ProfileMediaService` uploads to Storage, creates `profileImages`, updates `profileImageSetAs` for `profile` and `postProfile`, updates `users.profilePicture`, and patches profile/feed caches. | Deploy the adjacent Storage/Firestore rules, then verify camera-roll permissions, crop, upload progress/failure, SVG/preset replacement, and propagation to posts/comments/chat/discover. |
| Change cover through uploaded library, multiple images, order, gradient, remove | **Partial.** Mobile crops/uploads one cover and writes canonical `coverProfile` assignment plus `users.coverPhoto`. | Add image-library management, multiple cover ordering, gradient selection, remove/restore, and cleanup of unused media. |
| Image cropper | **Partial native adaptation.** Expo picker uses 1:1 avatar and 16:9 cover editing. | If web-grade free crop/zoom/rotation is required, add a dedicated native cropper; preserve original and derived asset metadata. |
| Immediate cache propagation | **Done in source.** Own-profile and feed author caches are patched after save. | Expand invalidation to conversation summaries, comments, notifications, community membership rows, and public-profile aliases. |

## 1.3 Timeline and Reposts

| Web contract | Mobile status and evidence | Required work |
| --- | --- | --- |
| Author timeline with post cards, media, polls, reactions, comments, shares, menus | **Partial.** Author-scoped cached feed reuses mobile `PostCardSection`/poll/comment flows. The Home/Friends/Communities feed-scope selector is intentionally omitted on Profile; content-type filters remain. | Close remaining Home post-parity items and confirm profile-specific privacy/visibility behavior. |
| Cached hydration, retry, refresh, pagination | **Done in source.** Profile timeline uses the shared feed resource rather than a duplicate screen query. | Preserve per-profile offset and add bounded page continuation if the current author query has more pages. |
| Reposts workspace | **Missing.** | Add normalized repost attribution, original-post unavailable state, repost undo/permissions, and author-scoped pagination. |

## 1.4 Friends and relationship workspaces

| Web contract | Mobile status and evidence | Required work |
| --- | --- | --- |
| Friends list with search and profile links | **Done in source.** `FriendsTab` delegates to `RelationshipService.getFriends`, has loading/error/retry/empty/search states, avatars, and typed public-profile navigation. | Add cached SWR storage so return visits are immediate. |
| Friends, Following, Followers, Requests, Suggestions sections | **Partial.** Friends and Discover suggestions exist in separate native surfaces. | Add profile-native following/followers/requests/suggestions tabs with cursor pagination and count reconciliation. |
| Accept, decline/cancel, remove, follow/unfollow, message, block, report | **Partial.** Public-profile relationship actions exist; the own Friends tab is read-only. | Add modern action sheets and confirmations per row, permissions, optimistic updates, and rollback. |
| Presence and mutual connections | **Missing.** | Add privacy-aware presence and mutual-connection summaries through server contracts. |

## 1.5 About

| Web section | Mobile status | Required work |
| --- | --- | --- |
| Contact | **Partial read-only.** Email/phone fields exist where returned. | Add editing, verification state, and per-field privacy. |
| Address | **Partial.** A single location string renders. | Add structured country/city/address data and privacy controls. |
| Basic Info | **Partial.** Account type and DOB render. | Match canonical gender, student level, relationship/status fields, editing, validation, and visibility. |
| Work Experience | **Missing.** | Add create/edit/delete/reorder with modern forms and confirmations. |
| Education | **Missing.** | Add create/edit/delete/reorder with modern forms and confirmations. |
| Interests and Skills | **Missing on profile.** | Reuse canonical registration/profile records with editable chips and privacy behavior. |
| Social Links | **Missing.** | Add normalized provider URLs, validation, ordering, open-external behavior, and edit/delete. |

## 1.6 Gallery and customization

| Web contract | Mobile status and evidence | Required work |
| --- | --- | --- |
| Photo/video gallery | **Partial.** `GalleryTab` derives media from the author feed using cached images. | Support complete canonical media results, video playback, pagination, dates, and mixed-media filters. |
| Albums and album privacy | **Missing.** | Add album list/detail, create/edit/delete, cover image, privacy, and friend references. |
| Upload and image preview | **Missing as a gallery workflow.** | Add multi-select upload, progress/retry, full-screen preview, save/share, set profile/cover, and owner actions. |
| Delete media/set album cover | **Missing.** | Add service-owned destructive actions with Ourlime custom confirmations and cache reconciliation. |
| Profile Customization uploaded-image library and usage preview | **Missing; palette button is hidden.** | Implement the canonical uploaded-image library, preview, profile/post/cover assignment, gradient, ordering, and deletion before exposing Customize. |

## 1.7 Settings and linked profile domains

- **Implemented in source:** persistent Light/Dark native appearance and Settings styling, account fields, profile/activity/search visibility, message permissions, data-sharing controls, granular push/email/SMS/mention/message/comment preferences, security alerts, blocked users, sign out, and modern `CustomModal` states. Settings use canonical Firestore documents and no longer fail because `/api/profile/blocklist` is unreachable.
- **Still required:** migrate remaining hard-coded light colors to shared theme tokens, secure 2FA enrollment/disable, password change, connected accounts, sessions/activity logs, export, deletion/reauthentication, and proof every setting is consumed by feed/search/chat/profile services.
- **Products, Jobs, Business Account:** web routes are extensive; mobile must keep them Coming Soon until browse/manage/create/edit/delete permissions and secure services are complete.

# 2. Other-user Profile

## 2.1 Present in mobile

- Cached lookup by normalized username/UID, cover/avatar/identity/counts, private and block gates, Timeline, Friends, Communities, About, and Gallery.
- Follow/unfollow, add/cancel/remove friendship, message, native share, block/unblock, report, retry, and stale-cache behavior.
- Friend rows navigate to `/profile/[username]`; joined-community rows navigate to `/communities/[id]` rather than dead or web-style paths.

## 2.2 Remaining parity requirements

- Enforce each field/tab against the server’s visibility decision; never infer privacy solely from a top-level flag.
- Add followers/following/mutual connections, richer community sliders, presence where permitted, and cursor pagination.
- Match web blocked-by-me, blocked-by-other, private-not-friends, missing/deleted user, and self-profile redirect states.
- Ensure every user avatar/name in posts, comments, members, events, polls, search, chats, and notifications routes to the canonical profile route.
- Use custom report/relation/block sheets with selectable reasons and destructive confirmations; no native default alerts.

# 3. Communities List and Create Flow

## 3.1 Discovery surface

| Web contract | Mobile status and evidence | Required work |
| --- | --- | --- |
| Community of the Week | **Done in source.** The authenticated directory API applies the web member/like/post scoring and returns a compact native hero from the same normalized entity. | Deploy and manually compare the selected community with production web data. |
| All, Joined, Joined by Friends, New, Created | **Done in source.** All five scopes are server-filtered and independently cached by viewer/query. | Manually verify every scope with accounts that exercise each state. |
| Visibility and live categories | **Done in source.** All/Public/Private and the canonical live category collection feed the query contract through one themed Filters & Sort sheet with Apply/Reset and removable active summaries. | Honor future Admin category ordering/paging if the category contract outgrows its current bounded result. |
| Popular, Newest, Active, Trending | **Done in source.** Sorting is server-owned and uses normalized member, like, post, and activity data; it is grouped with secondary filters rather than competing with primary Browse scopes. | Validate ordering after deployment; do not reintroduce client approximations. |
| Search and result count | **Done in source.** Search is debounced and server-filtered; pages carry authoritative totals and opaque cursors. | Manual long-list and special-character verification remains. |
| Grid/compact list | **Done in source.** Both native layouts use the same card contract and preserve query state. | Tablet polish remains a manual UX check. |
| Loading, empty, error, retry, refresh | **Done in source.** SQLite SWR retains cached content, supports pull-to-refresh and bounded pagination, and never substitutes mock records. Visible foreground recovery is isolated from background preload work, and silent refresh does not show the native pull spinner. | Offline/device verification remains external. |

## 3.2 Community cards

- **Done in source:** banner/fallback, category/privacy/verification badges, creator selected-avatar/name, description, members/likes/posts/activity, top-member previews, friends-here summaries, slug, viewer role, and permission-derived actions.
- **Done in source:** View, Join, Request Access, Request Again, Cancel Request, Leave, Pending, Owner, Member, Banned, and inaccessible states are derived at the server boundary.
- **Done in source:** directory, Discover, detail, profile and Admin consumers share the normalized community model. Join/leave/request/cancel/like/delete mutations patch persisted directory queries and Discover copies.
- **Count correction:** `communityVariantMembershipAndLikeCount` is batch-loaded. A missing, invalid, or stale-zero member counter is derived from unique active membership IDs plus the creator, rather than displayed as zero.

## 3.3 Create Community

- **Done in source:** authenticated server creation, name and slug availability/suggestions, description limit, live category, public/private, verified-members-only, posting permission, naming/impersonation notice, terms confirmation, and deterministic owner/count records.
- **Done in source:** banner picker, 3:1 crop, preview/remove, optional image URL, upload progress, recoverable failure, and server validation. Picker URIs are never persisted as canonical media.
- **External:** deploy the API/rules and manually exercise duplicate names/slugs, interrupted uploads, and every page-access/role combination.

# 4. Community Detail and Sub-workspaces

## 4.1 Route, header, access, and links

- **Done in source:** canonical ID/slug route, cached detail hydration, back navigation, banner/title/description, category/privacy/verification badges, creator identity, date, authoritative counts, community-like, share, report, membership/request actions, role badge, edit, dashboard/moderation, and server-owned cascade delete.
- **Done in source:** private, banned, verified-members-only, posting, role, site-admin and page-access outcomes are authorized server-side; hidden controls are only presentation of those returned permissions.
- **Done in source:** profile and community links use typed native destinations and canonical HTTPS shares resolve back to the exact community.
- **Still required:** replace the generic Share Invite action with searchable friend selection and authenticated invite-message delivery.

## 4.2 Content tabs

| Web workspace | Mobile status | Required work |
| --- | --- | --- |
| Posts | **Substantially done.** Canonical post cards provide community identity, media, likes/lists, comments/replies, report, author/moderator server-cascade deletion, counter correction and cross-resource reconciliation. | Add pin/visibility moderation and verify every composer accessory against Home. |
| Events | **Partial parity.** Live create/edit/delete, image/video media, recurrence, attendance/count, authenticated report action, author/moderator controls, refresh/error/empty and modern confirmations are implemented. | Add event likes/discussions and dedicated native date/time/map inputs. |
| Polls | **Substantially done.** Live two-to-five option create, duration, single/multiple vote, results, expiry, selectable report reason/details, delete permission and reconciliation are implemented. | Add any canonical poll media fields exposed by web. |
| About | **Done in source.** Category, privacy, verification policy, posting permission, rules, created date, counts, and owner edit entry are present. | Manual content/long-text verification remains. |
| Members | **Done in source.** Cursor paging, server search, selected avatars, roles, friend/presence context, profile navigation and role/remove/ban sheets are present. | Manual role matrix verification remains. |

## 4.3 Members, requests, and roles

- **Done in source:** paginated/searchable member list, role labels, canonical selected avatars, profile navigation, friend/presence context and permissions.
- **Done in source:** join-request queue with Approve/Decline and authoritative membership-count reconciliation.
- **Done in source:** member/admin/moderator role changes, remove and ban run through authenticated server routes with independent owner/admin/moderator checks and Ourlime confirmation sheets.
- **Remaining:** unban and delete-all-member-content need a dedicated native dashboard action if still reachable in the active web UI.

## 4.4 Owner/admin dashboard and settings

- **Done in source:** full-screen native Overview, Members, Requests, Activity and Reports workspaces; counts; search/status filters; request actions; roles; assign/dismiss/resolve/hide moderation; and bounded server actions. Dashboard/member/request resources start concurrently on open, Activity/Reports share their canonical payload, and each visible workspace has a force-refresh control.
- **Interaction repair:** dashboard data loaders are stable across parent renders; the X, Android back action, and workspace tabs dismiss/switch reliably. Opening Host Event or Create Poll from the slug action row now switches workspace and opens the correct creation UI.
- **Done in source:** edit name/slug/description/category/privacy/verification/posting policy/rules/banner and server-owned cascade deletion with explicit confirmation.
- **Remaining:** multi-select UI for bounded bulk report actions and deeper activity preview/navigation. Storage-object cleanup after replacing media or deleting a community remains release hardening.

## 4.5 Share, invite, report, and confirmation UX

- Native system share is a valid adaptation for general sharing.
- Still required: friend search/selection and authenticated invite message delivery, with private/verified access notice.
- Community, post, event, and poll reporting are server-backed with selectable category/reason/details; community-content reports feed the owner/moderator dashboard. Evidence attachments remain post-only.

- The shared community post composer is now fully semantic-theme-backed, including fixed Dark and live System-dark surfaces, input text/placeholders, selection chips, media controls, and readable enabled/disabled Post states.
- Feed and Profile reuse a single native `pageSheet` navigation menu matching the smooth Community filter transition; the obsolete secondary JavaScript entrance animation and gesture responder were removed.
- Leave, delete, ban, remove member, role changes, post deletion, and report resolution must use Ourlime `CustomModal`/bottom sheets with clear consequences, progress, failure, and retry states—never browser confirm, native `Alert`, toast-only destructive actions, or simulated success.

# 5. Data, Security, and Release Requirements

- `ProfileMediaService`, `CommunityService`, `RelationshipService`, `ModerationService`, feed/profile resource services, and secure web APIs own domain behavior; route/UI files must not gain direct Firebase mutations.
- Adjacent `firestore.rules` now includes owner access for `profileImages`/`profileImageSetAs` and community read/membership rules; adjacent `storage.rules` now permits owner-scoped `/profiles/{uid}` image uploads. These changes are **not deployed**.
- `/api/communities/membership` is a new authenticated server contract for join/request/leave. It is **not deployed**, and mobile API base URL reachability remains an external prerequisite.
- Community creation, membership, role, moderation, event, poll, report and delete mutations are server-owned. Preserve those authorization boundaries; do not reintroduce trusted client writes.
- No dummy data, fake success alerts, or silent empty-array failure fallbacks are permitted.

# 6. Manual Acceptance Checklist

- Update avatar and banner, relaunch, and confirm both persist and update Home composer/posts/comments, Discover, Chat summaries, community members, and public profile.
- Deny photo permission and interrupt upload; confirm a modern recoverable modal and no partial assignment.
- Open Friends, search, retry an API failure, and open another user profile.
- Verify private/blocked profiles never expose hidden fields/posts/friends/communities.
- Exercise all five community tabs, privacy/category/sort/search controls, then open card and sub-profile/community links.
- Join public, request private, leave, share, and report; confirm list/detail counts and state reconcile.
- Verify owner cannot leave their community and unauthorized users never see or execute owner/moderator actions.
- Verify long titles/descriptions, no image, broken image, empty lists, offline cache, and small-screen layout.
- No automated validation was run as part of this audit, per project policy.
