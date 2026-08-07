# Web-to-Mobile Post Parity Implementation Plan

## Objective

Bring the Expo/React Native home feed to behavioral and data-contract parity with the Next.js post system while preserving the existing native Ourlime design. Parity includes regular posts, polls, event-backed posts, reposts, media galleries/video, post menus, likes, comments, nested replies, mentions, sharing, reporting, blocking, deletion, pagination, moderation state, location tagging, emoji input, and image cropping.

The mobile UI remains presentation-only. Network calls, Firestore/Storage operations, validation, normalization, optimistic-operation rules, and cleanup belong in singleton OOP service classes. Hooks coordinate React state and call those services.

## Web Sources Reviewed

### Feed and post rendering

- `../components/home/MiddleSection/index.tsx`
- `../components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostCardSection.tsx`
- `../components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PollCardSection.tsx`
- `../components/home/MiddleSection/MiddleSectionComponent/PostCardSection/ImageAndVideoPostSection/ImageAndVideoPostSection.tsx`
- `../components/home/MiddleSection/MiddleSectionComponent/PostCardSection/LikesModal/LikesModal.tsx`
- `../components/home/MiddleSection/MiddleSectionComponent/PostCardSection/PostLocationMap.tsx`
- `../lib/posts/feedServer.ts`
- `../app/api/home/MiddleSection/Post/route.ts`

### Post creation and media preparation

- `../components/home/feed/CreatePost.tsx`
- `../components/home/feed/LocationPickerModal.tsx`
- `../components/home/feed/LocationPickerMapInner.tsx`
- `../components/home/MiddleSection/MiddleSectionComponent/CreatePostModal/index.tsx`
- `../components/polls/CreatePollModal.tsx`
- `../components/events/createEventModal/CreateEventModal.tsx`
- `../lib/constants/postMedia.ts`
- `../lib/helpers/mediaValidation.ts`
- `../lib/posts/createPostPayload.ts`
- `../app/api/home/MiddleSection/Post/createPost/route.ts`
- `../lib/home/MiddleSection/MakePostService.ts`

### Comments and replies

- `../components/home/MiddleSection/MiddleSectionComponent/CommentsModal/CommentsModal.tsx`
- `../app/api/posts/[id]/comments/route.ts`
- `../app/api/posts/comments/[commentId]/replies/route.ts`
- `../app/api/posts/comments/[commentId]/like/route.ts`
- `../lib/posts/commentServer.ts`
- `../lib/posts/mentionServer.ts`

### Post operations and moderation

- `../app/api/posts/[id]/route.ts`
- `../app/api/posts/[id]/vote/route.ts`
- `../app/api/posts/[id]/share/route.ts`
- `../app/api/posts/[id]/repost/route.ts`
- `../app/api/home/MiddleSection/Post/Likes/route.ts`
- `../components/moderation/ReportModal.tsx`
- `../app/api/moderation/reports/route.ts`
- `../lib/moderation/reportService.ts`
- `../lib/moderation/enforcementServer.ts`

## Current Mobile Gap Audit

| Capability | Web behavior | Current mobile | Required work |
|---|---|---|---|
| Feed queries | Authenticated server query; cursor pagination; filters; visibility, blocks, hidden/restricted moderation; relationship and repost state | Direct Firestore query for the first 20 records | Move canonical reads to the web API and add typed cursor pagination/cache |
| Feed refresh | Focus/visibility refresh, moderation listeners, infinite loading | Pull-to-refresh only | Add load-more and refresh/reconciliation policies; remove unavailable content |
| Regular post creation | Authenticated API, maximum 5 media, typed validation, upload progress, partial failure handling, cleanup | Direct Firestore write, maximum 6, limited validation | Use the canonical API and exact limits; add rollback and progress |
| Image cropper | Queued cropper with Fit, 4:5, 1:1, 1.91:1 and zoom 1-3 | Missing | Native crop queue and crop service using Expo image manipulation |
| Video validation | MP4/MOV/WebM, maximum 250 MB and 120 seconds | Missing | Validate MIME, size, and duration before upload |
| Emoji input | Emoji picker inserts into composer | Missing | Add a native emoji sheet and cursor-aware insertion |
| Mentions | Friend lookup, suggestions, `@username`, notification creation | Regex extraction only | Friend-backed suggestions, selected mention IDs, API notification parity |
| Hashtags | Chips, dedupe, hashtag counter updates | Space-delimited text | Add chips, normalization, limits, and server-side counters |
| Location | Search, GPS, draggable pin, reverse geocoding, full coordinates/address | Free-text name only | Native location picker with GPS, search/reverse-geocode API, and coordinate validation |
| Polls | 2-4 options, preset/custom duration, server deadline enforcement, optional image in legacy modal | 2-4 options and four fixed durations; direct non-transactional vote | Add custom duration, optional image decision, canonical transactional vote and countdown |
| Post card | Identity badges, visibility, timestamp, rich text, location/map, event details, media, repost attribution | Basic card | Add missing metadata, rich text, event/repost displays and states |
| Post menu | Own post: delete. Other user: add friend, follow/unfollow, report, block | Missing | Native action sheet with state-dependent actions and confirmations |
| Likes | Optimistic toggle with rollback; count; paginated users modal with follow/friend actions | Toggle/count only | Add authoritative response, rollback, likes modal and relationship actions |
| Sharing | Increment once per mounted card, copy/native share, permalink | Native share without database increment or canonical URL | Record share through API and share the canonical `/post/{id}` URL |
| Reposts | Authenticated, one per user/original, copied media, attribution, share count | Missing | Add repost service/action and render `repostedFrom` |
| Comments | Real API, 20-item cursor pages, create/edit, 2000-char validation, mentions, moderation restrictions | Timed dummy comments and TODO writes | Replace completely with typed CommentService and hook |
| Replies | Lazy 20-item pages, replies-to-replies represented with parent reference, create/edit, mentions | Dummy reply only | Implement lazy threads, nested reply target, edit and pagination |
| Comment/reply likes | Transactional toggle with optimistic rollback | Missing | Add service method and local rollback |
| Reporting | Categories/reasons, details, optional evidence, authenticated report record | Missing | Native two-step report modal and ModerationService |
| Delete own post | Authenticated owner check and feed removal | Missing | Add confirmation, server deletion, local/cache removal, and full cascade hardening |
| Diagnostics | Server route errors plus UI messages | Feed/create logs only | Add operation IDs and start/success/failure logs for every service action |

## Canonical Architecture

### API boundary

Mobile should call the same authenticated Next.js endpoints used by the web UI. This is necessary for true query parity because the server applies moderation restrictions, ownership checks, block-list filtering, relationship visibility, mention notifications, poll deadline transactions, and report validation.

Add `EXPO_PUBLIC_OURLIME_API_BASE_URL` and an `ApiService` that:

- Builds absolute URLs for native clients.
- Attaches the current Firebase ID token when authentication is required.
- Uses typed request/response generics without `any`.
- Parses server errors into a typed `ServiceError` with status and code.
- Adds a per-operation request ID to diagnostic logs.
- Supports abort signals for feed and search requests.
- Never logs tokens, evidence URLs, or full private payloads.

Direct Firebase Storage uploads remain in mobile because the storage rules enforce owner paths. Firestore writes that have authorization or cross-document invariants go through the server API.

### Services

1. `ApiService`
   - Authenticated JSON transport, error mapping, timeouts, cancellation, base URL.
2. `PostService`
   - `fetchFeedPage`, `fetchPost`, `createPost`, `deletePost`, `toggleLike`, `recordShare`, `repost`, `voteOnPoll`.
   - Maps API records to strict mobile domain types.
3. `PostMediaService`
   - File validation, image dimensions, video duration, crop transforms, uploads, progress callbacks, cancellation, abandoned-upload cleanup.
4. `CommentService`
   - Comment/reply pagination, create, edit, like/unlike, mapping, mention payloads.
5. `LocationService`
   - Permission handling, current coordinates, debounced place search, reverse geocoding, location normalization.
6. `ModerationService`
   - Report categories, evidence validation/upload, submit report, content-specific payloads.
7. `RelationshipService`
   - Relationship status, follow/unfollow, friend request, block user. Post components consume this service rather than performing calls.

Each service is a singleton class with a private constructor and `getInstance()`. Components do not import Firebase query primitives.

### Hooks

- `useHomeFeed`: filter cache, cursor, refresh, load-more, dedupe, prepend, update, delete, moderation reconciliation.
- `usePostActions`: like/share/repost/delete plus optimistic snapshots and rollback.
- `usePostComments`: comments, reply threads, cursors, editing, likes, pending state and rollback.
- `usePostComposer`: typed draft state, validation, upload/crop queue, submit/cancel cleanup.
- `useLocationPicker`: GPS/search/reverse-geocoding lifecycle.
- `usePostRelationships`: relationship state and menu operations.

## Domain Contracts

### Feed

`FeedPage` contains `posts`, `nextCursor`, and `hasMore`. Filters match the web values exactly: `all`, `photo`, `video`, `audio`, `poll`, and `event`. The current mobile labels may hide unsupported UI filters, but the service contract must retain all values.

`PostItem` must include:

- Core: ID, owner ID, type, caption, description, visibility, created/updated timestamps.
- User: first/last name, username, resolved profile image, email verification, admin/account type.
- Media: ID, type, URL, filename, display order, optional dimensions/duration.
- Engagement: like/comment/share counts and viewer-liked state.
- Mentions, friend references, hashtags.
- Poll options, votes or server-derived counts, duration, end time and viewer selection.
- Structured location: name, address, latitude and longitude.
- Repost attribution and `repostedByViewer`.
- Relationship status.
- Event ID, dates, recurrence and category for event-backed posts.

### Comments

Use separate `PostComment`, `PostReply`, `CommentThread`, and `CommentPage` types. Comments sort newest-first; replies sort oldest-first. Both use a cursor and page size of 20. Content is trimmed and limited to 2000 characters. A reply carries `parentReplyId` and `replyToUserName` so a reply-to-reply remains within the root thread.

### Media

- Maximum items: 5.
- Images: JPEG/JPG, PNG, WebP, HEIC/HEIF; maximum 10 MB.
- Videos: MP4, MOV/QuickTime, WebM; maximum 250 MB and 120 seconds.
- Storage: `posts/{uid}/regular/{uniqueName}`; poll images use `posts/{uid}/polls/{uniqueName}`.
- Crop presets: Fit, Portrait 4:5, Square 1:1, Landscape 1.91:1; zoom 1-3.
- Media order is stable and written as `displayOrder`.

## UI Component Plan

### Feed

- Keep `MiddleSection` as the native visual container.
- Replace its internal data lifecycle with `useHomeFeed`.
- Use a paginated `FlatList` instead of nesting all cards in a `ScrollView`; retain emerald pull-to-refresh.
- Render loading skeletons, error/retry, true empty feed, filter-empty state, loading-more, and end-of-feed separately.
- Preserve scroll position and per-filter cache.

### Post cards

- Create shared `PostHeader`, `PostBody`, `PostMediaGallery`, `PostActionBar`, `PostOptionsSheet`, `RepostAttribution`, and `PostLocationCard` components.
- Regular and poll cards share identity, menu, engagement and metadata components.
- Media gallery supports one-media sizing, multi-media paging indicators/thumbnails, video pause when off-screen, saved playback position, and full-screen viewing.
- Rich text recognizes mentions and HTTP links without injecting HTML.
- Show verified/student/admin badges and visibility icons.
- Poll UI shows option progress, selected option, total votes, exact countdown, active/ended status, and prevents interaction after the server deadline.

### Post options sheet

- Own post: Delete Post with destructive confirmation and pending state.
- Other user: Add Friend or relationship state, Follow/Unfollow, Report Post, Block User.
- Close after a successful action; keep open and show the server error on failure.
- Blocking removes all posts from that author from every cached feed.

### Comments modal

- Native bottom-sheet/full-screen modal with `SafeAreaView` from `react-native-safe-area-context` and explicit `edges={['top', 'left', 'right']}`.
- Pinned post summary, real comment list, loading skeletons and empty state.
- Lazy reply expansion and independent reply cursors.
- Comment/reply optimistic likes with rollback.
- Reply-to-comment and reply-to-reply targeting.
- Edit controls only for the author; show edited state.
- Friend mention suggestions and tappable mention text.
- Keyboard-safe composer, 2000-character enforcement, submit progress, offline/error recovery.
- Use shared `UserAvatar` for every author.

The current web contract does not expose deletion for comments or replies. Do not invent a client-only delete. If product requires it, add authenticated DELETE routes and server-side count cleanup first, then expose it on both web and mobile.

### Composer

- Preserve the current native full-screen modal and header design.
- Sections: identity/visibility, post type, caption/body, mentions, hashtags, media, poll fields, location, and submit status.
- Emoji button opens a native emoji sheet and inserts at the text cursor.
- Media picker starts a crop queue for images; videos bypass cropping after validation.
- Preview gallery supports remove/reorder, file index, upload progress and per-item errors.
- Polls require a question and 2-4 non-empty unique options. Durations include 5/15/30 minutes, 1/24/48/72/168 hours and custom seconds/minutes/hours/days.
- Location opens a native picker with place search, current location, movable pin, reverse-geocoded address and confirm/remove actions.
- Closing during upload asks for confirmation, cancels tasks and deletes uploaded-but-uncommitted objects.
- A successful post closes the modal and prepends the server-authoritative record to the All feed.

### Report modal

- Two-step flow: category, then reason.
- Match the seven web categories and their reason lists.
- Optional details; details required for the generic Other reason.
- Optional evidence images, maximum 10 MB each, preview/removal and upload progress.
- Submit authenticated payload with content type, target, reported user, preview route, media URL and parent IDs where applicable.

## Server/API Work Required

The checked-in Firestore rules do not grant mobile clients general access to the post collections, and direct client mutations cannot reproduce server moderation rules safely. The following web API contracts become the canonical shared backend:

- `GET /api/home/MiddleSection/Post`
- `GET|DELETE /api/posts/{id}`
- `POST /api/home/MiddleSection/Post/createPost`
- `GET|POST /api/home/MiddleSection/Post/Likes`
- `POST /api/posts/{id}/share`
- `POST /api/posts/{id}/repost`
- `POST /api/posts/{id}/vote`
- `GET|POST|PATCH /api/posts/{id}/comments`
- `GET|POST|PATCH /api/posts/comments/{commentId}/replies`
- `POST /api/posts/comments/{targetId}/like`
- `POST /api/moderation/reports`

Before mobile delete ships, harden the server deletion operation. The current web deletion removes the post, media-summary documents and hashtag counts, but can leave associated counts, likes, comments, replies, comment likes, repost markers and Storage files. Implement an owner-verified, bounded cascade that:

1. Loads the post and verifies the authenticated UID owns it.
2. Captures all referenced Storage object paths before deleting documents.
3. Deletes `feedsPostSummary`, `likesCount`, `feedsPostLikeCount`, `feedsPostComments`, related `feedsPostCommentsReplies`, related `feedsPostCommentLikes`, and appropriate `postReposts` records.
4. Deletes the main `feedPosts` document.
5. Decrements hashtag and user post counters without going below zero.
6. Deletes Storage objects after the database mutation, recording cleanup failures for retry.
7. Preserves moderation reports/audit records but marks their content unavailable.
8. Returns a typed deletion summary so both clients can reconcile safely.

Large cascades must use bounded batches rather than assuming fewer than 500 writes.

## Delivery Phases

### Phase 1: Shared transport and strict domain types

- Add API base URL configuration, `ApiService`, typed errors and auth headers.
- Split post, comment, media, location and report types into `lib/types`.
- Remove `any` and `interface` from touched mobile post files.
- Add operation-scoped diagnostics.

Acceptance: authenticated and anonymous feed requests reproduce the web response contract; no target TypeScript errors.

### Phase 2: Canonical feed and card parity

- Replace direct feed reads with cursor API requests.
- Add filters, load-more, dedupe, cache and refresh reconciliation.
- Expand post mapping and shared card components.
- Add media paging/video state, location, repost attribution, event metadata and identity badges.

Acceptance: the same account sees the same ordered visible posts, fields, counts, avatars and filters on web and mobile.

### Phase 3: Post actions

- Implement authoritative like with rollback, likes list, native share counting/permalink, repost, relationship actions, block, report and delete.
- Add action sheets and confirmation dialogs.
- Harden the server deletion cascade before exposing Delete.

Acceptance: every menu option is state-correct; failed operations roll back; deleted/blocked content disappears from all feed caches.

### Phase 4: Real comments and replies

- Replace the mock mobile comments modal entirely.
- Add comment/reply pages, create/edit, nested targets, likes, mentions and count updates.
- Add authentication and moderation-restriction error states.

Acceptance: web-created threads appear on mobile and vice versa; pagination order, counts, edits, likes and author avatars match.

### Phase 5: Full composer parity

- Add exact media constants and validation.
- Implement crop queue, transformations, preview/order, progress, cancellation and cleanup.
- Add emoji sheet, friend mentions, hashtag chips, visibility states, poll durations/options and structured location picker.
- Submit through the authenticated create API and prepend its authoritative result.

Acceptance: text-only, photo, multi-photo, video, mixed-media, location and poll posts created on mobile render correctly on both clients.

### Phase 6: Events, repost wrappers and adjacent post types

- Render event-backed posts with dates, location, recurrence and RSVP state.
- Decide whether event creation belongs in this composer or the Events feature; if included, use the same event-plus-feed-post transaction as web.
- Keep reel creation routed to the Limes/Reels service, while retaining shared media validation and upload components.

Acceptance: every `feedPosts.type` returned by the server has an intentional native renderer and action policy.

### Phase 7: Reliability and parity verification

- Add retry/offline states, cancellation, stale-request suppression and duplicate-submit guards.
- Compare web/mobile fixtures for mapping and visibility.
- Verify moderation updates remove hidden/restricted content.
- Run strict TypeScript and targeted tests, then manually verify Android and iOS native interactions.

## Required Dependencies

Install Expo-compatible versions through `npx expo install` when implementation begins:

- `expo-image-manipulator` for crop output.
- `expo-location` for current-position permissions and GPS.
- `react-native-maps` if the confirmed native UX includes an interactive pin map.
- `expo-file-system` for reliable metadata/size handling where picker metadata is incomplete.
- `expo-video` or the already-installed video implementation for duration/playback, choosing one canonical player.
- `expo-clipboard` only if copy-link is offered in addition to React Native's native Share sheet.

Avoid a native module that requires leaving Expo managed workflow solely for cropping; the existing gesture-handler, Reanimated and image-manipulator stack can provide the crop surface.

## Verification Matrix

### Static

- `cmd /c "node_modules\.bin\tsc --noEmit"`
- Targeted lint/parse checks for every touched post file.
- `git diff --check`.
- Confirm zero `any`, zero new `interface`, zero React namespace imports in touched mobile code.
- Confirm every screen-level safe area uses explicit top/left/right edges.

### Data parity

- Compare first page IDs and order for anonymous, authenticated, friends-only, blocked-user and owner views.
- Compare all filters and cursor continuation without duplicates.
- Compare post, media, user, count, poll, location, repost and relationship fields.
- Confirm hidden, restricted, expired-hidden and deleted records follow web rules.

### Mutation parity

- Create every supported post type and verify both clients.
- Like/unlike, comment, reply-to-comment, reply-to-reply, edit comment/reply and like both comment types.
- Vote, change vote before deadline, reject after deadline.
- Share once per card session and repost only once per user/original.
- Follow/unfollow, friend request, report with/without evidence, block.
- Delete own post; reject deleting another user's post; verify full cascade and Storage cleanup.

### Native UX

- Android back button and iOS swipe/keyboard behavior.
- Notch/status-bar safe areas.
- Media permissions denied/limited/granted.
- Location permissions denied/granted and GPS timeout.
- Crop all presets, multiple queued images, cancel and retry.
- Upload interruption, partial failure, duplicate taps and app background/foreground.
- Long captions/comments, mention suggestions, emoji insertion, accessibility labels and screen-reader order.

## Definition of Done

- No mock post/comment/reply data remains in the active mobile flow.
- Mobile and web consume the same authoritative server contracts for protected post operations.
- Every visible action works against production-shaped Firebase data with ownership and moderation enforced server-side.
- All default and uploaded avatars render through `UserAvatar` everywhere in the post experience.
- Feed creation, reading, filtering, pagination, commenting, replying, liking, voting, sharing, reposting, reporting, blocking and owner deletion reconcile without requiring an app restart.
- Cropper, emoji, mention, location and upload states are complete and recoverable.
- The requested TypeScript command has no errors in the implemented post scope; unrelated repository errors are recorded separately and never hidden.
