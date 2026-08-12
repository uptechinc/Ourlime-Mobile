# Ourlime Web-to-Mobile Full Parity Re-audit

Date: 2026-08-12

Scope: source-level comparison of the current `Ourlime-Web` checkout with `Ourlime-Mobile`. This review covers the rendered route trees, navigation registries, Home/feed/post components, role gates, admin workspaces, page-availability policy, and every currently exposed mobile domain. It does not claim runtime, device, database-rule, or deployed-API verification.

No automated tests, type checks, lint commands, Expo launches, browser runs, or device builds were executed for this re-audit. Repository-owned automated test/spec files were removed at the user's request.

## Implementation update — 2026-08-12

This section supersedes stale findings later in this audit. It records source changes only; manual authenticated and device verification remains pending.

| Area | Current mobile source status | Remaining parity work |
| --- | --- | --- |
| Global routes, roles, and availability | One typed navigation registry, one `AuthorizationService`, global page-access resolution/overlay, developer preview badges, canonical route aliases, and explicit denial states are implemented. Duplicate Chat routes were removed. | Manually verify every role/status combination and notification/deep-link back stack. |
| Home/posts | Live scoped feed, errors/retry, create/upload/crop/polls/location, comments/replies, relationships/moderation, owner deletion/visibility, repost/remove-repost, live suggestions, shared card containers, link previews, and native directions are implemented. | Fullscreen media, inline YouTube playback, hashtag navigation, comment report/mention depth, and manual visual comparison remain. |
| Communities | Live list/create/filter/join/request, privacy and banned-state access, real community feed/create/comment/like flows, and permission-aware actions are implemented. | Members/dashboard, invites, polls, events, community moderation, and advanced owner/admin management remain. |
| Chat | Authenticated conversation API, real presence, friend compose picker, rich detail messages/attachments, and real audio URL opening are implemented. | Native voice recording/playback controls, business/discovery tabs, remaining system dialogs, and call/device QA remain. |
| Discover/Search | Live recommendations and community/event/job modules are used, with page-access-aware fetching and truthful error/retry states. | Global multi-entity search, recent history, deeper filtering, and bounded pagination remain. |
| Profiles/settings | Live profile/timeline/counts, canonical avatar resolution, privacy/block/relationship actions, and persisted settings are implemented. | Friends/Reposts/Customization tabs, full albums/gallery, share depth, and remaining settings subflows remain. |
| Admin | Authenticated metrics, user search/role/lifecycle actions, moderation reports, and page-access management are role-gated and implemented. | Analytics, testers, stickers, products, categories, communities, audit/activity, and moderator-specific workspace parity remain. |
| Future domains | Events, Jobs, Market, Blogs, E-Learning, Projects, Ads/Create/Manage, Saved, Wallet, Games/GeoGuesser/Wordle, E-Hub, and Help are protected by canonical Coming Soon routes/statuses. | Their legacy prototype code must be replaced with service-backed product flows before the page status is enabled. |

## Executive finding

The mobile app is not at 100% web parity. The exposed core social path now has strong service-backed coverage; deeper feature work listed above remains.

- Web has 104 `page.tsx` routes. Mobile now has 54 TSX route/layout files, including canonical Coming Soon and admin child-route handoffs, while still covering only a subset of complete product workflows.
- Duplicate Expo Router `page.tsx` aliases were removed; each implemented screen now has one canonical route implementation.
- Prototype-heavy future domains are guarded by Coming Soon policy and are not represented as complete.
- Mobile now has a global page-access provider/overlay, registry merge, developer preview badges, route-prefix policy, and shared authorization service.
- The mobile Admin product now covers metrics, users, moderation reports, and page access, but not every web admin workspace.

## Status legend

| Status | Meaning |
| --- | --- |
| Done | The exposed mobile behavior is service-backed and materially matches the web contract. |
| Adapted | Same product capability with an intentional native layout or interaction. |
| Partial | A meaningful implementation exists, but controls, states, data, design, or subroutes are missing. |
| Prototype | Static, local-only, mocked, simulated-success, or TODO behavior is exposed. |
| Missing | No mobile route or usable equivalent exists. |
| Hidden | Deliberately not exposed until implemented. |

## 1. Global shell, routes, roles, and availability

| Web behavior | Current mobile behavior | Status | Verified gap |
| --- | --- | --- | --- |
| Header navigation checks live page settings and disables restricted links | Typed registry resolves visibility/status and badges | Done in source | Manual role/status QA remains. |
| Global route overlay for coming soon, maintenance, beta, developer, admin, disabled, and system override | Global context, resolver, and overlay are implemented | Done in source | Scheduled/deployed setting behavior requires manual QA. |
| Any coming-soon parent protects slug/deep children | Prefix policy resolves parent and child settings | Done in source | Manual deep-link QA remains. |
| Admin links shown to authoritative admins | Shared authorization result drives both drawers and the route | Done in source | Server authorization remains mandatory for every mutation. |
| Limes is an enabled social destination | Bottom tab follows canonical page access | Done in source | Limes functionality is outside this implementation pass. |
| Canonical route per screen | Duplicate `/page` aliases removed | Done in source | New route additions must retain one canonical implementation. |
| Protected auth routes | Root hook performs an auth redirect | Partial | Route strings from `useSegments()` are joined without the leading slash expected by the public-route registry; role and account-status checks are not part of the route guard. |
| Unimplemented future domains unavailable | Canonical Coming Soon destinations and overlays protect unfinished domains | Done in source | Legacy prototypes must be replaced before their status is enabled. |

### Unified role policy

`AuthorizationService` now normalizes the canonical role/account flags once for tabs, drawers, profiles, route guards, and page-access evaluation. Admin UI visibility remains a convenience boundary; implemented privileged APIs also enforce authenticated server-side role checks.

## 2. Home shell and feed controls

| Section/control | Web | Mobile | Status |
| --- | --- | --- | --- |
| Responsive app header | Logo, search, account, notifications, availability-aware navigation | Native logo/header, drawer, notification modal | Adapted |
| Global user search | Live user search and profile navigation | Search and Discover use `SearchService` | Done |
| Notification center | Filters, sort, bulk selection/actions, request actions, read state | Modal supports these core controls | Partial: no dedicated `/notifications` route or bounded pagination equivalent |
| Feed scopes | Home, Friends, Communities | Typed source chips and scoped service request | Done in source; deployed contract not verified here |
| Content filters | All, Photos, Videos, Sound, Polls, Events | Same chip set | Done in source |
| Composer launcher | Avatar, prompt, quick actions | Native card with Gallery/Feeling | Partial: Feeling still opens the generic composer |
| Weekly activity | Left-rail activity | Interleaved `ActivityCard` | Adapted |
| Suggested people | Relationship recommendations and actions | Canonical suggestions plus real friend-request action/reason state | Done in source |
| Games/promotions | Side rails | Hidden | Hidden by P0 decision |
| Feed states | Loading, empty, error, retry, pagination | Native skeleton, empty/error/retry, refresh, cursor load | Done |

## 3. Post-container design comparison

The native card is recognizably aligned, but it is not an exact design match.

| Design/detail | Web card | Mobile card | Finding |
| --- | --- | --- | --- |
| Outer container | `rounded-xl`, white, `p-4`/`p-6`, medium shadow, 16px bottom gap | 20px radius, 18px padding, stronger elevation, 16px outer margin/gap | Partial: same visual family, different radius/elevation/density |
| Feed background | White center column on desktop; edge-to-edge white on narrow web | `#f8f9fa` with floating cards | Adapted, but visually less like narrow web |
| Avatar | 48px, subtle animated ring, image or initial | 48px `UserAvatar`, bundled/default resolution and emerald initial fallback | Adapted and more robust |
| Identity row | Name, username, timestamp, visibility, verified/student/admin badges | Same principal fields | Done |
| Repost attribution | Reposter avatar/name/count above original author | Compact `Reposted from @...` block only | Partial |
| Typography | Caption 20px bold; description 16px; 16px content gaps | Caption 17px; description 15px; tighter spacing | Partial |
| Content order | Caption, event media/details or description/YouTube/location/hashtags/media | Caption, description, hashtags, media, location/event details | Partial |
| YouTube links | Embedded preview | Service-backed thumbnail/title preview with native URL action | Adapted: inline playback remains |
| Mentions | Tappable profile links | Post `MentionText` is tappable | Done for regular posts; poll/comment text differs |
| Hashtags | Styled interactive intent | Styled text without Search navigation | Partial |
| Location | Label/address/map/link | Structured map preview and native directions action | Done in source |
| Media | Gallery/video plus selected-media comment entry | Gallery/video | Partial: no tap-to-fullscreen/zoom and comments do not preserve selected media index |
| Interaction bar | Like, comment, share, repost/unrepost, counts, likes summary | Like, comment, native share, repost/remove-repost | Done in source |
| Owner options | Visibility change, delete | Visibility and delete actions | Done for regular posts; community permissions remain distinct |
| Other-user options | Add friend, follow, report, block | Same core actions with project modal feedback/confirmation | Done in source |
| Event owner actions | Edit and cancel event | Host label and delete through generic options | Partial |

Regular and poll cards now share a native feed-card container token based on the web card's radius, padding, border, and shadow. Header spacing, content order, typography, and action-bar hit-area alignment still require manual visual refinement.

## 4. Polls, comments, and composer

### Polls

- Poll media is now rendered; the older parity document saying otherwise is stale.
- Voting, selected option, percentages, counts, total votes, timer/end state, likes, comments, sharing, reporting, blocking, and owner deletion are present.
- Poll caption, description, hashtags, and location are plain text rather than using the same mention/hashtag/location behavior as regular posts.
- Polls do not expose repost/unrepost parity.

### Comments and replies

- Live pagination, reply pagination, likes, reply-to-reply, edit, edited timestamps, retry, and empty states are present.
- Web report actions for comments/replies are missing on mobile.
- Web friend mention suggestions and sticker-enabled comment composers are missing.
- Comment/reply author avatars and names do not navigate to profiles.
- Comment content is plain text, so mentions are not tappable.

### Composer

- Text, media picker, Firebase Storage upload, crop queue, emoji, polls, hashtags, visibility, mentions/references, location, validation, progress, and authoritative insertion are present.
- Native crop UI supplies preset crop/zoom controls; it is not equivalent to every web cropper interaction.
- Feeling has no distinct metadata flow.
- Event authoring exists in both Home and Events, but event edit/cancel parity is incomplete.

## 5. Page-by-page exposed mobile audit

| Mobile surface | Web baseline | Current source finding | Status |
| --- | --- | --- | --- |
| Login | Login, validation, recovery, verification/account-state handling | Service-backed and visually native | Partial: account-status/deep-link lifecycle needs manual verification |
| Register | Multi-step account creation and verification | Multi-step native flow | Partial |
| Password/legal | Forgot/reset/verify/Terms/Privacy | Routes exist | Partial: legal content is a remote WebView rather than packaged canonical content |
| Search | Multi-entity search/discovery | People-only typed results | Partial |
| Discover | Suggested users, communities, events, jobs | Live sections through services | Partial: action and pagination depth do not match every web surface |
| Limes | For You/Following reels, creation, reactions, comments, share | Strong service-backed vertical feed | Partial: incorrectly role-hidden; permalink route missing; several web controls still differ |
| Chat list | Conversation tabs/search/unread/presence | Authenticated list, real presence, and friend compose picker | Partial: business/discovery tabs remain |
| Chat detail | Messaging, attachments, reply/forward/delete, calls, media, stickers, voice | Broad implementation with real stored voice URL opening | Partial: native recording/playback controls and call-device QA remain |
| Own profile | Counts, timeline/reposts/customize/about/gallery, settings, admin workspace | Live counts/timeline plus cover/avatar/about/gallery/admin | Partial: Friends, Reposts, and Customization remain |
| Other profile | Privacy/block/relationship/report/message/friends/communities | Strong service-backed screen | Partial: needs design and privacy-state parity review against all web tabs |
| Settings | Account/profile/security/privacy/notifications/blocking/lifecycle | Basic preferences and blocked users | Partial: large web settings surface is missing |
| Communities list | Discovery, categories, membership, creation | Live list/search/filter/create/join/request | Partial: category depth and pagination remain |
| Community detail | Feed, polls, events, members, invite, moderation/dashboard | Privacy-aware live feed/create/comments/likes and permission states | Partial: polls, events, members, invite, moderation/dashboard remain |
| Events | Discovery/filter/create/detail/RSVP/social actions | Live event list/create/like/RSVP shell | Prototype: the exposed comment modal loads hard-coded event/comments and posts replies locally |
| Jobs | Search/categories/types/detail/save/share/apply/create/manage | Live list/create shell | Prototype: application upload is unwired and submit logs a fake success payload; some visible buttons have no handler |
| Market | Browse/filter/detail/favorite/seller/product workflows | Live browse through `MarketService` | Partial: generated dummy fixture code remains dormant; product detail route and ownership actions are incomplete |
| Blogs | Browse/detail/create/social/ownership | Live list/detail reads | Prototype/Partial: active Create Blog waits two seconds and reports simulated success without persistence |
| E-Learning | Full course/student/instructor/CXC route family | One hub with static modules | Prototype: active schedules use mock data and local-only create/edit/delete; should be hidden under P0 boundary |
| Post detail | Permalink post and comments | Minimal post card route | Partial |
| Not found | Branded recovery | Basic route | Partial |

## 6. Admin parity and permission audit

### Web admin workspaces

The web exposes these distinct admin destinations:

1. Analytics dashboard and date/time filters.
2. Tester application/invitation management.
3. Page Access pages and audit log.
4. User management, verification, authentication, roles, status, archive/restore, ban/suspend, and permanent deletion.
5. Content moderation/report action workflow.
6. Sticker and sticker-pack management.
7. Product review and product categories.
8. Community moderation and community categories.
9. Redirect aliases for reports/dashboard/category destinations.

### Current mobile admin

- `/admin` provides authenticated aggregate metrics, users, moderation reports, and page-access workspaces.
- The Profile Admin tab routes to those real workspaces.
- Canonical admin child routes exist. Implemented children redirect to the corresponding native workspace; advanced web-only children show an explicit handoff instead of broken or simulated controls.
- The route renders an explicit access-denied state for non-admin users, and implemented queries/mutations use authenticated server endpoints.

Therefore Admin is Prototype, not Done or P0-complete.

## 7. Page Access settings: exact parity gap

The web Page Access workspace supports:

- live registry plus custom settings;
- system-wide override;
- prefix matching for nested/dynamic routes;
- statuses: enabled, coming soon, maintenance, beta only, developer only, admin only, and disabled;
- show-in-navigation and show-page-preview switches;
- custom overlay title/description/badge;
- primary and secondary action labels/routes;
- search and status filtering;
- row selection and bulk enable/disable/coming-soon/maintenance/developer-only actions;
- reset/initialize defaults;
- per-row edit and enable/disable actions;
- audit log;
- developer preview badges;
- a global overlay on restricted routes.

Mobile implements settings loading/editing, default registry merge, per-page status controls, badges, and global enforcement. Bulk controls, audit-log depth, and some web editor conveniences remain.

## 8. Web-only route families

The following remain absent or intentionally hidden on mobile:

- Ads marketplace and its booking/payment/proof/review/host/offer/admin route tree.
- Full E-Learning course, lesson, quiz, assignment, grade, discussion, instructor, and CXC route tree.
- Events detail and upcoming routes.
- Market product permalink.
- Lime permalink and compatibility redirect.
- Dedicated notifications route.
- Profile friends, business account, product management, and job management route trees.
- Project Management and project detail.
- Wallet, Games, GeoGuesser, Wordle, and E-Hub product implementations; valid Coming Soon routes now exist.
- Advanced web admin workflows; canonical native route handoffs now exist, while four core workspaces are implemented.

These are not P0 implementation failures when intentionally hidden. They are parity gaps and must not be described as implemented.

## 9. Correct next implementation order

1. Unify authorization and page-availability policy; protect `/admin`; remove the Limes role error; hide unavailable navigation consistently.
2. Remove or hide every active simulated-success/mock flow: Event comments, Job applications, Blog creation, and E-Learning schedules.
3. Complete fullscreen media, inline YouTube playback, hashtag navigation, and comment-report/mention behavior; manually refine shared feed-card typography and content order.
4. Correct own-profile counts, reposts, customization, truthful error states, and role rendering.
5. Build admin/page-access mobile workspaces only if native admin is a current product requirement; otherwise hide Admin entirely and keep administration web-only.
6. Complete Communities, Events, Jobs, Market, and Blogs actions/subroutes before calling those domains Done.

## 10. Manual validation boundary

No automated validation is part of this repository workflow. After implementation, the user will manually verify:

- each role and account state;
- page-setting changes and nested-route protection;
- admin endpoint/rules authorization;
- every visible button and destructive confirmation;
- Home card appearance on narrow and wide phones;
- keyboard, cropper, media, notifications, and deep links;
- genuine empty/error/offline results without dummy fallback.
