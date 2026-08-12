# Home Page Web-to-Mobile Parity Audit

Updated: 2026-08-12

Scope: the live rendered Home page rooted at `Ourlime-Web/app/page.tsx` compared with the live Expo Router Home screen rooted at `Ourlime-Mobile/app/(tabs)/index.tsx`. Dormant, commented, or unrendered legacy components are not counted as current web features.

Corrective note: this document was source-reconciled after the full parity re-audit in `docs/WEB-MOBILE-FULL-PARITY-REAUDIT.md`. No automated or runtime validation was run.

## Status legend

- **DONE** - present in the app with equivalent behavior and live data.
- **ADAPTED** - present through a mobile-native placement or interaction.
- **PARTIAL** - some behavior exists, but important web behavior is missing.
- **PROTOTYPE** - visible behavior is hard-coded, local-only, simulated, or not connected to its intended mutation.
- **TODO** - absent or still backed by placeholder behavior.
- **DESKTOP ONLY** - visual enhancement that should not be copied literally to native.

## Summary

The app's center feed is substantially implemented, but it is not 100% design or functional parity. Page availability, unified role rendering, suggested-user friend requests, owner visibility, remove-repost, shared regular/poll card containers, link previews, and native location directions are now implemented. The largest remaining Home gaps are selected-media/fullscreen behavior, hashtag navigation, inline YouTube playback, comment report/mention depth, and finer typography/content-order matching.

## A. Global Home shell and header

| Web section or control | Web behavior | App counterpart | Status | Mobile UX decision / work required |
|---|---|---|---|---|
| Ourlime logo | Returns to Home | Logo in fixed native header | DONE | Keep static and compact. |
| Sticky desktop header | Logo, search, notifications, profile | Native safe-area header | ADAPTED | Correct native pattern. |
| User search field | Debounced live user search | `SearchService`-backed Search/Discover | DONE | Search is a hidden typed route rather than a visible bottom tab. |
| Search result row | Avatar, name, username | Live `UserAvatar` rows | DONE | Keep native list treatment. |
| Search result profile navigation | Opens another user's profile | Typed `/profile/[username]` route | DONE | Keep. |
| Search Add Friend | Sends request and reflects Pending/Friends | Only available from post menus and likes modal | PARTIAL | Add to Search results. |
| Search Follow/Unfollow | Updates relationship state | Only available from post menus | PARTIAL | Add to Search results. |
| Search clear button | Clears query/results | Search tab has a clear button | DONE | Replace placeholder data without changing UX. |
| Notification bell and unread badge | Opens notifications and shows count | Home header opens live modal with unread state | DONE | Keep. |
| Mark all notifications read | Bulk update | Implemented | DONE | Keep. |
| Notification sort | Unread first / newest first | Implemented | DONE | Keep. |
| Notification type filter | Filters notification categories | Implemented chips | DONE | Keep. |
| Select all notifications | Starts bulk selection | Implemented | DONE | Keep. |
| Bulk mark read/unread/delete | Acts on selected rows | Implemented | DONE | Keep. |
| Notification friend request Accept/Decline | Responds inline | Implemented | DONE | Keep. |
| Show/hide read notifications | Toggles read history | Implemented | DONE | Keep. |
| Notification pagination | Infinite/load-more | Missing | TODO | Use `FlatList.onEndReached`. |
| Profile avatar menu trigger | Opens account menu | Profile tab plus hamburger drawer | ADAPTED | The placement is correct, but content is incomplete. |
| Account identity summary | Name, username, friend/post counts | Profile screen and drawer avatar | PARTIAL | Add counts and correct `UserAvatar` resolution in drawer. |
| Verification state/action | Verify, pending, verified/student verified | Not accessible from Home | TODO | Add account status row in drawer/profile menu. |
| View Profile | Opens own profile | Bottom Profile tab and drawer item | DONE | Keep. |
| Settings | Opens profile settings | Home drawer item and route | DONE | Keep. |
| Wallet | Opens wallet | Coming Soon route/drawer row | DONE | Keep status badge until implemented. |
| Saved Items | Opens saved content | Coming Soon route/drawer row | DONE | Keep status badge until implemented. |
| Create Ad | Opens ads flow | Valid Coming Soon child route | DONE | Keep protected until implemented. |
| Manage Ads | Opens ads management | Valid Coming Soon child route | DONE | Keep protected until implemented. |
| Help & Support | Opens help | Coming Soon route/drawer row | DONE | Keep status badge until implemented. |
| Logout | Signs out | Home drawer footer action | DONE | Add project modal confirmation rather than immediate logout. |
| Desktop nav: Home | Route navigation | Home bottom tab | ADAPTED | Keep bottom tab. |
| Desktop nav: Limes | Route navigation | Bottom tab follows canonical role/page access | DONE | Runtime role/status QA remains manual. |
| Desktop nav: E-Learning | Route navigation | Drawer item despite web `coming_soon` default and P0 exclusion | TODO | Hide until implemented or expose only through canonical page-status policy. |
| Desktop nav: Blogs | Route navigation | Drawer item | ADAPTED | Keep in drawer. |
| Desktop nav: Events | Route navigation | Drawer item | ADAPTED | Also expose from composer quick actions. |
| Desktop nav: Jobs | Route navigation | Drawer item | ADAPTED | Keep. |
| Desktop nav: Communities | Route navigation | Drawer item | ADAPTED | Keep. |
| Desktop nav: Market | Route navigation | Drawer item | ADAPTED | Keep. |
| Desktop nav: E-Projects | Route navigation | Coming Soon route/drawer row | DONE | Keep protected until implemented. |
| Page availability/developer badges | Shows disabled/preview route state | Registry subscription, prefix policy, overlays, and badges | DONE | Runtime role/status QA remains manual. |
| Signed-out Log in / Sign up | Header actions | App routes users through auth screens | ADAPTED | Home is authenticated; no duplicate buttons needed. |

## B. Left Home rail

| Web section or control | Web behavior | App counterpart | Status | Mobile UX decision / work required |
|---|---|---|---|---|
| Welcome/profile card | Avatar, welcome name, prompt | Composer avatar plus Profile tab | PARTIAL | Do not add a large permanent card; add a compact drawer account header. |
| View Profile button | Opens own profile | Profile tab/drawer | DONE | Relocated appropriately. |
| Games heading | Shows Home game previews | No Home games module | TODO | Add a horizontal `Play on Ourlime` carousel below composer or in Discover. |
| See All Games | Opens games page | Missing | TODO | Add carousel header action. |
| Individual game card | Thumbnail, type, plays, launch | Missing | TODO | Use live `/api/home/LeftSection/games`; no mock cards. |
| Feed scope: Home | All eligible feed posts | App All filter | DONE | Keep as default. |
| Feed scope: Friends | Only friend posts | Typed Friends source and server relationship filter | DONE | Deployed API QA remains. |
| Feed scope: Communities | Posts from joined communities | Typed Communities source and membership query | DONE | Deployed API QA remains. |
| Activity This Week | Likes received, comments, posts, friends | Interleaved `ActivityCard` | ADAPTED | Keep only if the interleaved placement performs well. |
| Activity loading/empty states | Skeleton or engagement prompt | Live service with loading/error/empty UI | DONE | Keep. |

## C. Right Home rail

| Web section or control | Web behavior | App counterpart | Status | Mobile UX decision / work required |
|---|---|---|---|---|
| Promoted carousel | Live promoted jobs/communities | No Home promotion module | TODO | Add a clearly labeled Sponsored horizontal card after several feed posts. |
| Previous promotion | Carousel pagination | Missing | TODO | Native swipe replaces arrow; keep page dots. |
| Next promotion | Carousel pagination | Missing | TODO | Native swipe replaces arrow; keep page dots. |
| Promotion page dots | Shows page position | Missing | TODO | Add to native carousel. |
| Promotion card | Image, category, title, description, metric | Missing | TODO | Use canonical promotions API. |
| Promotion Apply / Join | Routes to job/community | Missing | TODO | Whole card and CTA should navigate. |
| Suggested Users | Live relationship suggestions | Canonical relationship suggestion API | DONE | Keep recommendation reason and relationship state server-owned. |
| Add Friend suggestion | Sends request | Real request mutation with loading/error state | DONE | Accepted state reconciles with refreshed suggestions. |
| Cancel Friend Request | Cancels pending request | Missing from app suggestion flows | TODO | Pending button should support cancel. |
| Suggested user reason | Explains recommendation | Canonical reason rendered | DONE | Keep concise in the native card. |

## D. Feed filters and feed states

| Web section or control | App counterpart | Status | Work required |
|---|---|---|---|
| All filter | All | DONE | Canonical server filter. |
| Photos filter | Photos | DONE | Canonical server filter. |
| Videos filter | Videos | DONE | Canonical server filter. |
| Sound filter | Sound chip and server filter | PARTIAL | Card/player and composer audio intent still need parity review. |
| Polls filter | Polls | DONE | Canonical server filter. |
| Events filter | Events chip and server filter | DONE | Keep. |
| Horizontal filter overflow | Horizontal native chips | DONE | Correct mobile pattern. |
| Initial loading skeletons | Two native post skeleton cards | DONE | Keep. |
| Load-more indicator | Native spinner | DONE | Cursor pagination is implemented. |
| End-of-feed state | Native `That's a wrap` text | DONE | Keep compact. |
| Empty Home feed | Native empty state | DONE | Correct copy and no mock fallback. |
| Empty filtered feed | Native filter-specific state | DONE | Keep. |
| Friends empty state | Missing with scope | TODO | Add with Friends feed scope. |
| Community coming-soon state | Missing with scope | TODO | Tie to page availability, not hard-coded copy. |
| Pull to refresh | Native `RefreshControl` | DONE | Forces authoritative reconciliation while retaining saved content on failure. |
| Automatic load more | Near-bottom scroll detection | DONE | Prefer `FlatList` during performance pass. |
| Request cancellation/dedupe/cache | SQLite plus shared SWR resources | DONE | User/scope/filter/author snapshots hydrate before network work; keyed requests deduplicate. |
| Background head reconciliation | Non-jumping New Posts pill | DONE | New head posts remain buffered until the reader explicitly reveals them. |
| Feed scroll restoration | Persisted per query | DONE | Revisiting a scope/filter restores its prior bounded page and offset. |
| Retry on feed failure | Native error card and Retry | DONE | Keep diagnostic hint development-only. |

## E. Home composer

| Web control or feature | App counterpart | Status | Work required |
|---|---|---|---|
| Current-user avatar | Resolved `UserAvatar` | DONE | Includes web preset assets and initial fallback. |
| Text prompt/composer | Opens full-screen create modal | ADAPTED | Better mobile keyboard UX. |
| Photo quick action | Gallery action opens composer | DONE | Label should match web `Photo`, not `Gallery`, for consistency. |
| Emoji action | `Feeling` quick action only opens generic modal; emoji picker is inside modal | PARTIAL | Rename quick action to Emoji or implement a real feeling/activity selector. |
| Event quick action | Missing | TODO | Add Event button that opens the dedicated Events creation flow. |
| Poll quick action | Poll mode exists inside modal | PARTIAL | Add direct Poll quick action that opens modal already in Poll mode. |
| Location quick action | Location picker exists inside modal | PARTIAL | Add direct Location quick action or keep only inside modal and remove misleading parity expectation. |
| Caption | Caption input | DONE | Cursor-aware emoji insertion. |
| Description/details | Details input | DONE | Mobile exposes both caption and details. |
| Visibility | Public/Friends/Private chips | DONE | More capable than current inline web composer. |
| Hashtags | Normalized removable chips | DONE | Limit and validation implemented. |
| Friend mentions | Friend-backed suggestions | DONE | Comment composer still lacks them. |
| Up to five media items | Implemented | DONE | Exact web count. |
| MIME/size/video-duration limits | Implemented | DONE | Exact web constraints. |
| Image crop queue | Native crop modal | DONE | Fit, 4:5, 1:1, 1.91:1 and zoom. |
| Remove attachment | Preview X | DONE | Keep accessible labels. |
| Reorder attachments | Left/right controls | DONE | Long-press drag would be a future native polish. |
| Upload progress | Aggregate progress bar | DONE | Web uses per-item percentages; aggregate is acceptable on mobile. |
| Cancel upload | Cancel action | DONE | Cleanup implemented. |
| Media validation errors | Native alert | DONE | Consider inline error cards for multiple failures. |
| Emoji picker open/close | Curated native grid | DONE | Web has a full searchable library; app grid is smaller. |
| Location selected chip/remove | Structured location card/X | DONE | Keep. |
| GPS location | Crosshair button | DONE | Permission/error handling present. |
| Place search | Search results | DONE | Uses canonical geocode proxy. |
| Reverse geocode map pin | Tap/drag marker | DONE | Correct native map interaction. |
| Poll options add/remove | Two to four options | DONE | Keep. |
| Poll standard durations | 5m through 1w | DONE | Keep. |
| Poll custom duration | Seconds/minutes/hours/days | DONE | Keep. |
| Poll optional image | Creation/upload works | PARTIAL | The app poll card does not currently render this image. |
| Post submit | Authenticated create API | DONE | Authoritative created post is prepended. |
| Disabled/duplicate submit guard | Implemented | DONE | Keep. |
| Upload cleanup on failure | Implemented | DONE | Keep. |

## F. Regular, repost, and event cards

| Web card feature/control | App counterpart | Status | Work required |
|---|---|---|---|
| Author avatar | `UserAvatar` | DONE | Default/custom avatar parity fixed. |
| Tap avatar/name to profile | Typed `profile/[username]` navigation | DONE | Public profile enforces privacy/block state. |
| Name and username | Rendered | DONE | Keep. |
| Relative timestamp | Rendered | DONE | Keep. |
| Visibility icon | Rendered | DONE | Keep. |
| Verified badge | Rendered | DONE | Keep. |
| Student badge | Rendered | DONE | Keep. |
| Admin badge | Rendered | DONE | Keep. |
| Repost attribution | Compact original-author attribution | PARTIAL | Match web repeater identity/count semantics and keep it tappable. |
| Caption and details | Rendered | DONE | Keep native typography. |
| Mention links | Regular post `MentionText` navigates to profiles | DONE | Reuse it in polls and comments. |
| Friend-reference links | Not interactive | TODO | Treat as profile mentions. |
| Hashtag links | Styled but not tappable | PARTIAL | Tap should open Search filtered by hashtag. |
| Structured location label | Rendered | DONE | Keep concise card label. |
| Location map/address detail | Structured map/detail plus native directions | DONE | Missing coordinates show truthful place details without a fabricated map. |
| Image gallery | Horizontal paging/count | DONE | Keep. |
| Video player controls | Native controls | DONE | Only active gallery video auto-plays. |
| Full-screen media view | Missing | TODO | Add tap-to-view gallery with pinch zoom and video fullscreen. |
| More options button | Native bottom sheet | DONE | Correct mobile pattern. |
| Add Friend | Bottom-sheet action | DONE | Pending/accepted states handled. |
| Follow/Unfollow | Bottom-sheet action | DONE | Keep. |
| Report Post | Full-screen report flow | DONE | Categories/reasons/details/evidence. |
| Block User | Confirm and remove author from feed | DONE | Keep. |
| Delete own post | Confirm and cascade delete | DONE | Server cascade hardened. |
| Change own post visibility | Service-backed native options | DONE | Community visibility remains governed by community permissions. |
| Event schedule | Date/end date | DONE | Keep. |
| Event category/recurrence | Rendered chips | DONE | Keep. |
| Event attendee count | Rendered | DONE | Keep. |
| Attend/cancel RSVP | Native button | DONE | Keep. |
| Host state | `Organizing (Host)` | DONE | Delete remains in options. |
| Like/unlike | Optimistic plus authoritative response | DONE | Keep. |
| Like count opens users | Paginated likes modal | DONE | Keep. |
| Likes avatars summary | Count only on card; avatars inside modal | ADAPTED | Compact count is acceptable for narrow screens. |
| Comment | Opens full-screen comments | DONE | Correct mobile pattern. |
| Share | Native share sheet and canonical URL | DONE | Keep. |
| Repost | Repost/remove-repost toggle with state | DONE | Keep optimistic rollback on failure. |
| YouTube URL preview | Thumbnail/title card opens the native URL | ADAPTED | Inline playback remains a native follow-up. |

## G. Poll cards

| Web poll feature/control | App counterpart | Status | Work required |
|---|---|---|---|
| Author identity/badges | Rendered | DONE | Make author tappable with profile route. |
| Poll question/details | Rendered | DONE | Keep. |
| Poll image | Rendered through shared media gallery | DONE | Keep. |
| Poll timer | Remaining/ended | DONE | Keep. |
| Option count | Web shows count near timer | PARTIAL | App options are visible but lacks explicit option-count label. Low priority. |
| Vote option | Native progress row | DONE | Server-authoritative with rollback. |
| Selected option | Highlighted | DONE | Keep. |
| Vote counts | Count and percentage | DONE | Keep. |
| Total votes | Rendered | DONE | Keep. |
| Active/ended state | Remaining or ended | DONE | Add explicit active dot only if useful. |
| Like | Implemented | DONE | Keep. |
| Likes list | Paginated modal | DONE | Better than current web poll summary. |
| Comment | Implemented | DONE | Keep. |
| Share | Native share | DONE | Keep. |
| Owner delete | Bottom sheet | DONE | Keep. |
| Follow/friend/block/report | Bottom sheet | DONE | App report support exceeds current web poll menu. |

## H. Comments and replies

| Web comments feature/control | App counterpart | Status | Work required |
|---|---|---|---|
| Modal/sheet close | Full-screen native close | DONE | Android back is supported by modal callback. |
| Original post preview | Author and truncated content | DONE | Keep. |
| Paginated comments | Load 20 more | DONE | Keep. |
| Empty state | Start the conversation | DONE | Keep. |
| Retry state | Native Retry | DONE | Keep. |
| Comment author avatar/name | Rendered but not navigational | PARTIAL | Tap avatar/name to profile. |
| Comment mentions | Plain comment text | TODO | Reuse tappable `MentionText`. |
| Friend mention suggestions | Web friend textarea | Missing | TODO | Add suggestions to comment, reply, and edit composers. |
| Like comment | Optimistic/rollback | DONE | Keep. |
| Reply to comment | Implemented | DONE | Keep. |
| Reply to reply | Parent reply target | DONE | Keep. |
| Edit own comment/reply | Implemented | DONE | Keep. |
| Report comment/reply | Missing | TODO | Match the web moderation entry points. |
| Edited label/timestamp | Implemented | DONE | Keep. |
| View/hide replies | Implemented | DONE | Keep. |
| Paginated replies | Load 20 more | DONE | Keep. |
| Signed-out Sign In/Create Account | Not shown because app Home requires authentication | ADAPTED | No duplicate auth prompt required. |
| Keyboard-safe composer | `KeyboardAvoidingView` | DONE | Verify on both platforms. |

## I. Ambient and delight features

| Web feature | App status | Decision |
|---|---|---|
| Cursor trail | DESKTOP ONLY | Do not copy to touch devices. |
| Floating background particles | DESKTOP ONLY | Omit for battery/performance and cleaner native UI. |
| Hover/tilt effects | DESKTOP ONLY | Replace only where useful with press opacity, scale, and haptics. |
| Confetti component | TODO | Use sparingly for real achievements, not routine actions. |
| Achievement toast | TODO | Port only after achievements are server-backed; current web triggers are client-local. |
| Live presence count | TODO | Do not show until the count is live; web currently passes a fixed value. |
| Desktop decorative gradients/blurs | ADAPTED | Native app uses clean cards and emerald accents. |

## J. Current app Home inventory

The live app currently contains these Home-facing surfaces:

1. Safe-area Ourlime header with hamburger drawer.
2. Drawer routes for Communities, Events, Jobs, Market, Blogs, E-Learning, Chat, Profile, and Settings. Availability settings are not enforced, and Home never includes Admin because it omits the role input.
3. Bottom tabs for Feed, Discover, developer-only Limes, Chat, and Profile; the Limes role restriction is a parity defect. Search remains a typed non-tab route.
4. Current-user avatar and create-post prompt card.
5. Gallery and Feeling quick actions; both currently open the same composer.
6. All, Photos, Videos, Sound, Polls, and Events server-backed filter chips plus Home/Friends/Communities feed scopes.
7. Pull-to-refresh, cursor load-more, loading, retry, empty, filtered-empty, and end-of-feed states.
8. Regular, repost, poll, and event post rendering.
9. Native media gallery/video controls.
10. Likes, comments, native sharing, reposting, poll voting, and event RSVP.
11. Post options bottom sheet for relationship, moderation, blocking, and owner deletion.
12. Paginated likes modal with Follow and Add Friend actions.
13. Full comment/reply/edit/like/pagination workflow.
14. Full-screen post/poll composer with media validation, crop queue, emoji, mentions, hashtags, visibility, location, and upload progress/cancellation.
15. Full report workflow with evidence attachment.

## K. Prioritized Home parity work

### P0 - correctness and broken parity

- [x] Render optional poll media in `PollCardSection`.
- [x] Replace the app Search placeholder with canonical user search and relationship actions.
- [x] Add native other-user profile navigation; wire post authors, comment authors, repost attribution, and mentions.
- [x] Add a Notifications entry and functional notification screen/sheet.
- [x] Add Events feed filter and preserve server cursor/filter caching.
- [x] Align mobile bottom navigation tabs (Feed, Discover, Limes, Chat, Profile) to 100% match Ourlime-Web.
- [x] Implement Chat screen tab with conversation list and unread badges.

### P1 - major missing Home sections

- [x] Rebuild Discover screen to 100% match web Mobile.tsx (Search bar, Suggested Friends carousel, Featured Communities carousel, Featured Events list, Featured Jobs list).
- [x] Hide promoted/Ads content until the canonical mobile Ads contract is implemented; no simulated promoted cards are injected into Home.
- [x] Add suggested-users module with Add/Cancel Friend Request.
- [x] Complete working drawer account actions: settings, profile, and logout. Saved Items remains hidden until implemented.

### P2 - polish and lower-priority parity

- [x] Add service-backed weekly activity as an expandable native feed card.
- [x] Replace feed spinner with post skeleton cards.
- [x] Move feed rendering to `FlatList` for virtualization.
- [ ] Add page-availability status to drawer rows.
- [ ] Decide whether server-backed achievements belong on Home.
- [ ] Add native haptics for like, vote, repost, successful post, and RSVP.
- [ ] Verify all Home modals, keyboard behavior, permissions, and safe areas on Android and iOS.

## Design constraints for the app implementation

- Keep the feed as the dominant surface; do not reproduce three desktop columns inside one mobile screen.
- Relocate desktop sidebars into the drawer, Discover/Search tabs, or interleaved horizontal feed modules.
- Use full-screen native flows for complex creation/comments and bottom sheets for short action menus.
- Do not port cursor, hover, or fixed hard-coded presence effects.
- Use live canonical services only; no mock cards or dummy fallback arrays.
- Preserve safe areas, native back behavior, keyboard avoidance, minimum touch targets, accessible labels, loading/empty/error states, and optimistic rollback.
