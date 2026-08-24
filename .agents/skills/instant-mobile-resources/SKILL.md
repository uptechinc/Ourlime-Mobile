---
name: instant-mobile-resources
description: Implement and review instant-loading Ourlime Mobile pages using OOP resource services, Zustand presentation state, SQLite stale-while-revalidate caching, permission-aware background preloading, bounded pagination, and mutation reconciliation. Use for page loading, persistent skeletons, repeated navigation fetches, feed scope/filter caches, background synchronization, offline snapshots, or app startup performance.
---

# Instant Mobile Resources

## Scope Control

Use this skill only for the user’s explicit resource-loading request and its minimum dependencies. Report adjacent caching or preload improvements instead of implementing them without authorization, and do not run unrelated builds or change other platforms.

## Workflow

1. Read `references/page-preload-matrix.md` before changing page loading or preload behavior.
2. Identify the canonical domain service. Extend it rather than querying Firebase or APIs from a screen.
3. Store normalized snapshots through `LocalCacheService`, keyed by authenticated user plus resource identity.
4. Expose data through a concrete Zustand resource slice and a typed lifecycle hook.
5. Render cached data during revalidation. Show a full skeleton only when memory and disk both have no snapshot.
6. Register predictable page data with `AppPreloadService`; keep dynamic searches and unknown detail IDs interaction-driven.
7. Patch every relevant resource after mutations instead of clearing unrelated caches.
8. Keep requests bounded, cursor-paginated, deduplicated, and cancellable on background/logout.

## Required behavior

- Start Home independently before background work.
- Limit background network concurrency to two.
- Preload metadata, avatars, and thumbnails; defer video and original media.
- Distinguish stale time from offline retention time.
- Preserve cached data on network failure and surface a compact stale notice.
- Respect `PageAccessService` and role authorization before protected work.
- Log cache hits, durations, counts, queue state, and reconciliation without private content.
- Never fall back to mock data.
- Keep OOP, zero-`any`, direct React imports, typed props, and safe-area rules.

## Screen boundary

Screens may own ephemeral controls such as selected tabs, query text, and modal visibility. They must not own canonical domain arrays, Firestore queries, cache expiry, normalization, or mutation reconciliation.
