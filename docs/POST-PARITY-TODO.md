# Post Parity Implementation TODO

Updated: 2026-08-06

This checklist is updated after each implementation and verification milestone. The detailed design is in `docs/POST-PARITY-IMPLEMENTATION-PLAN.md`.

The complete Home shell, sidebar, header, feed-control, composer, post, poll, comments, and mobile UX comparison is tracked in `docs/HOME-PAGE-WEB-MOBILE-PARITY-AUDIT.md`.

## Phase 1 — Shared transport and domain foundation

- [x] Add authenticated, typed `ApiService` with native base URL support.
- [x] Add strict post, comment, media, location, report, and pagination types.
- [x] Move feed reads to the canonical web API.
- [x] Move post like, vote, share, repost, and delete operations to the canonical web API.
- [x] Preserve Firebase Storage uploads in an OOP media service.
- [x] Add request-scoped diagnostics without logging tokens or private content.
- [x] Verify Phase 1 TypeScript scope and formatting.

## Phase 2 — Feed and post-card parity

- [x] Resolve custom, bundled-default, SVG, raster, and initial avatars through canonical server joins and the shared mobile avatar component.
- [x] Add cursor pagination, load-more, filter caching, dedupe, and refresh reconciliation.
- [x] Add viewer like/repost/relationship state to post mapping.
- [x] Add repost attribution and event metadata rendering.
- [x] Add verified, student, and admin identity badges.
- [x] Upgrade media gallery paging and active-video behavior.
- [x] Add structured location presentation.
- [x] Add likes modal with paginated users and relationship actions.
- [ ] Verify feed order and visibility parity against the web API.

## Phase 3 — Post actions and moderation

- [x] Add shared post options sheet.
- [x] Add owner-only Delete Post confirmation and cache removal.
- [x] Add Follow/Unfollow and Add Friend states.
- [x] Add Block User and remove the author from cached feeds.
- [x] Add post reporting categories, reasons, details, and evidence uploads.
- [x] Add authoritative share counting and canonical native sharing.
- [x] Add one-time repost action and reposted state.
- [x] Harden the web server deletion cascade before enabling production deletion.
- [x] Verify optimistic rollback and failure states in post, poll, comment, and reply actions.

## Phase 4 — Comments and replies

- [x] Remove all mock comments, replies, timers, and TODO submission code.
- [x] Add typed `CommentService`.
- [x] Add cursor-paginated comments and lazy reply threads.
- [x] Add create and edit comment actions.
- [x] Add reply-to-comment and reply-to-reply actions.
- [x] Add comment/reply likes with optimistic rollback.
- [ ] Add friend mention suggestions and tappable mentions.
- [x] Add edited timestamps, loading, empty, authentication, and error states.
- [x] Use `UserAvatar` for every post/comment/reply author.
- [ ] Verify comment counts and cross-client thread parity.

## Phase 5 — Composer, cropper, emoji, and location

- [x] Enforce maximum 5 media items.
- [x] Enforce web MIME, image size, video size, and video duration limits.
- [x] Add resumable upload progress, partial-failure handling, cancellation, and cleanup.
- [x] Add native image crop queue.
- [x] Add Fit, 4:5, 1:1, and 1.91:1 crop presets with zoom.
- [x] Add media preview removal and reordering.
- [x] Add emoji picker and cursor-aware insertion.
- [x] Add friend-backed mention suggestions to the post composer.
- [x] Add hashtag chips, normalization, and removal.
- [x] Add GPS, place search, reverse geocoding, pin selection, and structured location.
- [x] Add full poll duration choices and custom units.
- [x] Add optional poll image retained by the canonical web post model.
- [x] Submit through the authenticated create API and fetch the authoritative created post.
- [ ] Verify every post created on mobile renders on both mobile and web.

## Phase 6 — Adjacent post types

- [x] Render event-backed posts with date, location, recurrence, category, attendee count, and RSVP state.
- [x] Keep event creation in the dedicated Events flow; the home composer consumes and renders event-backed posts but does not duplicate event creation.
- [ ] Route reel creation through the Limes/Reels service while sharing media validation.
- [x] Render regular, poll, and event `feedPosts.type` values intentionally, with an explicit regular fallback for legacy values.

## Phase 7 — Final reliability and verification

- [x] Add stale-request cancellation, network failure/retry states, and duplicate-submit guards.
- [ ] Verify Android back, keyboard, permissions, and modal behavior.
- [ ] Verify iOS safe areas, keyboard, permissions, and modal behavior.
- [x] Run `cmd /c "node_modules\.bin\tsc --noEmit"` (implemented post scope is clean; the inherited repository baseline still reports 107 unrelated errors).
- [x] Run targeted TypeScript checks for every touched post file and web server parity file.
- [x] Run `git diff --check`.
- [x] Record unrelated repository TypeScript errors separately below.
- [x] Confirm zero active mock post/comment data in the implemented feed and comment path.
- [x] Confirm zero `any`, new `interface`, or React namespace imports in touched code.

### Existing repository TypeScript baseline

The required full command currently reports 107 errors outside the implemented post-parity scope. They are concentrated in legacy duplicated web helpers under `helpers/`, `types/helpers/`, old home post imports that target `@/app/types/global`, messaging/market/profile services, `IconSymbol`, and `PostsCarousel`. None of the implemented mobile post files or the touched canonical web post server files report a TypeScript error.
