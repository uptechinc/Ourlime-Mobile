# Home Page Web-to-Mobile Parity Audit

Updated: 2026-08-06

Scope: the live rendered Home page rooted at `Ourlime-Web/app/page.tsx` compared with the live Expo Router Home screen rooted at `Ourlime-Mobile/app/(tabs)/index.tsx`. Dormant, commented, or unrendered legacy components are not counted as current web features.

## Status legend

- **DONE** - present in the app with equivalent behavior and live data.
- **ADAPTED** - present through a mobile-native placement or interaction.
- **PARTIAL** - some behavior exists, but important web behavior is missing.
- **TODO** - absent or still backed by placeholder behavior.
- **DESKTOP ONLY** - visual enhancement that should not be copied literally to native.

## Summary

The app's center feed is substantially implemented: canonical posts, filters, post creation, media, polls, events, reactions, comments, replies, sharing, moderation, pagination, refresh, and empty/error states are present. The largest remaining Home-page parity gaps are outside the feed cards:

1. Header search, notifications, and the full account menu.
2. Friends/community feed scopes, Sound and Events filters.
3. Games, weekly activity, promoted content, and suggested users.
4. Profile/mention/hashtag/location navigation from cards and comments.
5. Poll media rendering on the app after a poll image is uploaded.

## A. Global Home shell and header

| Web section or control | Web behavior | App counterpart | Status | Mobile UX decision / work required |
|---|---|---|---|---|
| Ourlime logo | Returns to Home | Logo in fixed native header | DONE | Keep static and compact. |
| Sticky desktop header | Logo, search, notifications, profile | Native safe-area header | ADAPTED | Correct native pattern. |
| User search field | Debounced live user search | Search bottom tab exists, but its results are placeholder data | TODO | Make Search tab query the same user endpoint. |
| Search result row | Avatar, name, username | No live result rows | TODO | Use `UserAvatar` and a native result list. |
| Search result profile navigation | Opens another user's profile | No other-user profile route | TODO | Add a native `profile/[username]` route. |
| Search Add Friend | Sends request and reflects Pending/Friends | Only available from post menus and likes modal | PARTIAL | Add to Search results. |
| Search Follow/Unfollow | Updates relationship state | Only available from post menus | PARTIAL | Add to Search results. |
| Search clear button | Clears query/results | Search tab has a clear button | DONE | Replace placeholder data without changing UX. |
| Notification bell and unread badge | Opens notifications and shows count | No Home notification entry | TODO | Add bell to header with badge. |
| Mark all notifications read | Bulk update | Missing | TODO | Put in native notification sheet/screen. |
| Notification sort | Unread first / newest first | Missing | TODO | Use compact sheet controls. |
| Notification type filter | Filters notification categories | Missing | TODO | Use horizontally scrollable chips. |
| Select all notifications | Starts bulk selection | Missing | TODO | Use long-press selection mode. |
| Bulk mark read/unread/delete | Acts on selected rows | Missing | TODO | Use contextual header actions. |
| Notification friend request Accept/Decline | Responds inline | Missing | TODO | Preserve inline buttons in notification row. |
| Show/hide read notifications | Toggles read history | Missing | TODO | Native footer action. |
| Notification pagination | Infinite/load-more | Missing | TODO | Use `FlatList.onEndReached`. |
| Profile avatar menu trigger | Opens account menu | Profile tab plus hamburger drawer | ADAPTED | The placement is correct, but content is incomplete. |
| Account identity summary | Name, username, friend/post counts | Profile screen and drawer avatar | PARTIAL | Add counts and correct `UserAvatar` resolution in drawer. |
| Verification state/action | Verify, pending, verified/student verified | Not accessible from Home | TODO | Add account status row in drawer/profile menu. |
| View Profile | Opens own profile | Bottom Profile tab and drawer item | DONE | Keep. |
| Settings | Opens profile settings | Missing from Home drawer | TODO | Add Settings drawer row and route. |
| Wallet | Opens wallet | Missing | TODO | Add drawer row when route is available. |
| Saved Items | Opens saved content | Missing | TODO | Add route and drawer row. |
| Create Ad | Opens ads flow | Missing | TODO | Add under a secondary Services section. |
| Manage Ads | Opens ads management | Missing | TODO | Add under Services, not primary navigation. |
| Help & Support | Opens help | Missing | TODO | Add drawer footer row. |
| Logout | Signs out | Not exposed from Home drawer | TODO | Add destructive footer action with confirmation. |
| Desktop nav: Home | Route navigation | Home bottom tab | ADAPTED | Keep bottom tab. |
| Desktop nav: Limes | Route navigation | Limes bottom tab | ADAPTED | Keep bottom tab. |
| Desktop nav: E-Learning | Route navigation | Drawer item | ADAPTED | Keep in drawer. |
| Desktop nav: Blogs | Route navigation | Drawer item | ADAPTED | Keep in drawer. |
| Desktop nav: Events | Route navigation | Drawer item | ADAPTED | Also expose from composer quick actions. |
| Desktop nav: Jobs | Route navigation | Drawer item | ADAPTED | Keep. |
| Desktop nav: Communities | Route navigation | Drawer item | ADAPTED | Keep. |
| Desktop nav: Market | Route navigation | Drawer item | ADAPTED | Keep. |
| Desktop nav: E-Projects | Route navigation | Missing | TODO | Add drawer item and route. |
| Page availability/developer badges | Shows disabled/preview route state | Route guard service exists, but Home navigation has no status badges | PARTIAL | Disable unavailable drawer rows and show a small status label. |
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
| Feed scope: Friends | Only friend posts | No equivalent | TODO | Add `For You / Friends` segmented control above media filters. |
| Feed scope: Communities | Community feed/coming-soon state | No equivalent | TODO | Add only when canonical community-feed query is ready. |
| Activity This Week | Likes received, comments, posts, friends | Missing | TODO | Add compact expandable insight card in drawer or Profile, not in scrolling feed by default. |
| Activity loading/empty states | Skeleton or engagement prompt | Missing | TODO | Implement with live endpoint and native skeleton. |

## C. Right Home rail

| Web section or control | Web behavior | App counterpart | Status | Mobile UX decision / work required |
|---|---|---|---|---|
| Promoted carousel | Live promoted jobs/communities | No Home promotion module | TODO | Add a clearly labeled Sponsored horizontal card after several feed posts. |
| Previous promotion | Carousel pagination | Missing | TODO | Native swipe replaces arrow; keep page dots. |
| Next promotion | Carousel pagination | Missing | TODO | Native swipe replaces arrow; keep page dots. |
| Promotion page dots | Shows page position | Missing | TODO | Add to native carousel. |
| Promotion card | Image, category, title, description, metric | Missing | TODO | Use canonical promotions API. |
| Promotion Apply / Join | Routes to job/community | Missing | TODO | Whole card and CTA should navigate. |
| Suggested Users | Live relationship suggestions | Not shown on Home; partial actions exist in likes modal | PARTIAL | Add a horizontal `People you may know` module or put it in Search/Discover with a Home preview. |
| Add Friend suggestion | Sends request | Available in likes/post options | PARTIAL | Add to suggestion cards. |
| Cancel Friend Request | Cancels pending request | Missing from app suggestion flows | TODO | Pending button should support cancel. |
| Suggested user reason | Explains recommendation | Missing | TODO | Show concise reason under username. |

## D. Feed filters and feed states

| Web section or control | App counterpart | Status | Work required |
|---|---|---|---|
| All filter | All | DONE | Canonical server filter. |
| Photos filter | Photos | DONE | Canonical server filter. |
| Videos filter | Videos | DONE | Canonical server filter. |
| Sound filter | Missing | TODO | Add only after audio posts have an intentional card/player and composer input. |
| Polls filter | Polls | DONE | Canonical server filter. |
| Events filter | Missing | TODO | Add Events chip using server `event` filter. |
| Horizontal filter overflow | Horizontal native chips | DONE | Correct mobile pattern. |
| Initial loading skeletons | App uses a spinner | PARTIAL | Replace with two native post skeleton cards to reduce layout shift. |
| Load-more indicator | Native spinner | DONE | Cursor pagination is implemented. |
| End-of-feed state | Native `That's a wrap` text | DONE | Keep compact. |
| Empty Home feed | Native empty state | DONE | Correct copy and no mock fallback. |
| Empty filtered feed | Native filter-specific state | DONE | Keep. |
| Friends empty state | Missing with scope | TODO | Add with Friends feed scope. |
| Community coming-soon state | Missing with scope | TODO | Tie to page availability, not hard-coded copy. |
| Pull to refresh | Native `RefreshControl` | DONE | Mobile-only improvement. |
| Automatic load more | Near-bottom scroll detection | DONE | Prefer `FlatList` during performance pass. |
| Request cancellation/dedupe/cache | Implemented | DONE | Keep service-owned query behavior. |
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
| Tap avatar/name to profile | Not interactive | TODO | Add other-user profile route and wrap avatar/name. |
| Name and username | Rendered | DONE | Keep. |
| Relative timestamp | Rendered | DONE | Keep. |
| Visibility icon | Rendered | DONE | Keep. |
| Verified badge | Rendered | DONE | Keep. |
| Student badge | Rendered | DONE | Keep. |
| Admin badge | Rendered | DONE | Keep. |
| Repost attribution | Rendered | DONE | Make attribution/avatar tappable. |
| Caption and details | Rendered | DONE | Keep native typography. |
| Mention links | Styled but not tappable in comments; post text is plain | PARTIAL | Parse mentions into tappable profile links. |
| Friend-reference links | Not interactive | TODO | Treat as profile mentions. |
| Hashtag links | Styled but not tappable | PARTIAL | Tap should open Search filtered by hashtag. |
| Structured location label | Rendered | DONE | Keep concise card label. |
| Location map/address detail | No post map/detail action | TODO | Tap location to open a compact map sheet or native maps app. |
| Image gallery | Horizontal paging/count | DONE | Keep. |
| Video player controls | Native controls | DONE | Only active gallery video auto-plays. |
| Full-screen media view | Missing | TODO | Add tap-to-view gallery with pinch zoom and video fullscreen. |
| More options button | Native bottom sheet | DONE | Correct mobile pattern. |
| Add Friend | Bottom-sheet action | DONE | Pending/accepted states handled. |
| Follow/Unfollow | Bottom-sheet action | DONE | Keep. |
| Report Post | Full-screen report flow | DONE | Categories/reasons/details/evidence. |
| Block User | Confirm and remove author from feed | DONE | Keep. |
| Delete own post | Confirm and cascade delete | DONE | Server cascade hardened. |
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
| Repost | One-time action with state | DONE | Keep. |

## G. Poll cards

| Web poll feature/control | App counterpart | Status | Work required |
|---|---|---|---|
| Author identity/badges | Rendered | DONE | Make author tappable with profile route. |
| Poll question/details | Rendered | DONE | Keep. |
| Poll image | Uploaded by composer but not rendered in app card | TODO | Render shared media gallery above timer/options. |
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
| Comment author avatar/name | Rendered | DONE | Make author tappable. |
| Comment mentions | Styled | PARTIAL | Make tappable. |
| Friend mention suggestions | Web friend textarea | Missing | TODO | Add suggestions to comment, reply, and edit composers. |
| Like comment | Optimistic/rollback | DONE | Keep. |
| Reply to comment | Implemented | DONE | Keep. |
| Reply to reply | Parent reply target | DONE | Keep. |
| Edit own comment/reply | Implemented | DONE | Keep. |
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
2. Drawer routes for Communities, Events, Jobs, Market, Blogs, E-Learning, Chat, and Profile.
3. Bottom tabs for Home, Search, Limes, Discover, and Profile.
4. Current-user avatar and create-post prompt card.
5. Gallery and Feeling quick actions; both currently open the same composer.
6. All, Photos, Videos, and Polls server-backed filter chips.
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
- [x] Add promoted content module with native swipe pagination.
- [x] Add suggested-users module with Add/Cancel Friend Request.
- [x] Complete drawer account actions: settings, saved items, profile, logout.

### P2 - polish and lower-priority parity

- [ ] Add weekly activity in an expandable drawer/profile card.
- [ ] Replace feed spinner with post skeleton cards.
- [ ] Move feed rendering from `ScrollView` to `FlatList` for virtualization.
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
