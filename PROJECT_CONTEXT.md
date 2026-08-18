# Ourlime Mobile - Product Requirements and Web Parity FRD

Last audited & updated: 2026-08-18

Web source: `C:\Users\aaron\Github\Ourlime-Web`

Mobile source: `C:\Users\aaron\Github\Ourlime-Web\Ourlime-Mobile`

---

## 1. Purpose & Scope

This is the master feature-requirements document (FRD) for bringing **Ourlime Mobile** to complete functional, architectural, and design parity with **Ourlime Web** while adhering to high-end native iOS and Android user experience patterns.

It defines:
1. Complete feature parity benchmarks across all core product areas (Feeds, Real-Time Chat, Communities, Limes, Profiles, Auth, and Admin).
2. Service-Oriented Object-Oriented Programming (OOP) boundaries and layer separation.
3. Strict engineering discipline: Zero-`any` policy, direct React imports, `type` aliases over interfaces, and safe area inset guarantees.
4. Push notification & VoIP call architecture requirements for native background/lockscreen capabilities.

---

## 2. Engineering Architecture & OOP Principles

### 2.1 OOP Service Layer Boundary
Every domain feature is backed by a plain TypeScript singleton service class under `lib/services/`:
- **Single Responsibility**: Each service manages one domain (e.g., `PostService`, `ChatService`, `CommunityService`, `RelationshipService`, `LimeService`, `AuthService`, `NotificationService`).
- **Encapsulation**: Firebase Firestore queries, Storage uploads, REST API requests, and data normalization live strictly inside services.
- **Layer Independence**:
  - UI Components (`components/`, `mobile/`) render purely based on props.
  - Custom Hooks (`lib/hooks/`) bridge component lifecycle with service operations.
  - Centralized Store (`lib/store/useResourceStore.ts`) caches data in memory and SQLite disk via `LocalCacheService`.

```text
React Screen / Component (Presentation)
       │
       ▼
Custom React Hook (Lifecycle & Zustand Subscription)
       │
       ▼
Domain Service Singleton (OOP Business Logic & Caching)
       │
       ▼
Backend API (Next.js) / Firebase Firestore & Storage / SQLite Cache
```

### 2.2 Strict Code Discipline
- **Zero `any` Policy**: Every variable, function parameter, and return value must be strictly typed.
- **Type Aliases Only**: Use `type [Name]Props = { ... }`. Interfaces are prohibited.
- **Direct React Imports**: Import hooks directly (`import { useState, useEffect, useCallback } from 'react'`). Never use `import React from 'react'`.
- **Safe Area Insets**: Fixed top headers must use `SafeAreaView` from `react-native-safe-area-context` with explicit `edges={['top', 'left', 'right']}` outside keyboard-avoiding views.

---

## 3. Core Social Surface Parity Matrices

### 3.1 Feeds (`app/(tabs)/index.tsx`, `components/home/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Feed Scopes** | Home, Friends, Communities feeds | Handled via `FeedResourceService` & `PostService` querying canonical APIs & Firestore with membership filters | ✅ Parity |
| **Content Filters** | All, Photos, Videos, Sound, Polls, Events | Filter chips with instant local filtering and paginated fetch queries | ✅ Parity |
| **Interactive Cards** | Regular, Media carousel, Video, Polls, Events, Reposts | Full card components with double-tap heart animations, voter cards, live polling percentages, and audio control | ✅ Parity |
| **Post Creation** | Modal with text, media cropper, location, polls, tags | `CreatePostModal` with `MediaCropModal` aspect ratios, location picker, and `@mention`/`#hashtag` detection | ✅ Parity |
| **Offline Cache** | Stale-while-revalidate caching | SQLite persistent snapshots with background silent revalidation and "New Posts" pill buffer | ✅ Parity |
| **Widgets** | Promoted ads, activity, suggested users, games | Feed-injected cards with live follow/friend request actions and modal confirmations | ✅ Parity |

---

### 3.2 Real-Time Chat & Communications (`app/chat/`, `components/chat/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **1-on-1 Direct Chat** | Real-time message stream with Firestore | `useChatMessages` hook + `ConversationResourceService` with instant local optimistic UI | ✅ Parity |
| **Voice Notes** | Record and audio playback with waveforms | High-performance recording timer, dynamic waveforms, playback progress, and 1x/1.5x/2x speed | ✅ Parity |
| **Sticker Packs** | Categorized sticker picker with search | `StickerPicker` modal with tabs, animated stickers, recent history, and favorites | ✅ Parity |
| **Message Reactions** | Long-press emoji reaction bar | Floating reaction picker with animated bursts and reaction summary sheets | ✅ Parity |
| **Quoted Replies & Forwards**| Visual quoted bubble & forward modal | Quoted message banner, scroll-to-reference, and forward-to-friend flow | ✅ Parity |
| **Thread Management** | Mute, archive, pin, delete, clear | Swipe / long-press action sheets with AsyncStorage & Firestore sync | ✅ Parity |
| **Calling** | Voice & Video calls via Agora RTC | Root `CallContext` coordinator, Agora RTC SDK integration, in-call camera/mic controls | ✅ Parity |

---

### 3.3 Communities (`app/communities/`, `components/communities/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Directory & Search** | Categorized directory, sorting, search | `CommunitiesResourceService` with category pills, privacy badges, and instant search | ✅ Parity |
| **Community Details** | Cover, avatar, tabs (Posts, About, Members, Events, Polls) | `CommunityDetailScreen` with dynamic tab switching and permission-aware workspaces | ✅ Parity |
| **Member Management** | Role-based hierarchy (Owner, Admin, Moderator, Member) | Searchable member directory, Member Action Sheet (Promote, Demote, Ban, Remove) | ✅ Parity |
| **Join Requests** | Private community approval workflow | Request queue management for community owners and moderators | ✅ Parity |
| **Creation & Edit** | Community creation wizard & settings | `CreateCommunityModal` with slug validation and `EditCommunityModal` with cover update | ✅ Parity |
| **Community Feed** | Dedicated community posts & discussions | `CommunityFeedResourceService` with dedicated post composer and moderation options | ✅ Parity |

---

### 3.4 Limes — Short-Form Video Feed (`app/(tabs)/Limes.tsx`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Snap Pager** | Fullscreen vertical snap feed with auto-play | `FlatList` with `pagingEnabled`, `expo-video` player, and viewability threshold | ✅ Parity |
| **Discovery Categories**| For You, Following, Compass dropdown (Comedy, Educational, DIY, Music, Explore) | Header tabs + Compass dropdown with chip selector and dedicated query filters | ✅ Parity |
| **Interactions** | Like, double-tap heart, share, report | Optimistic like counter, double-tap heart burst, native share with count sync, `ReportLimeModal` | ✅ Parity |
| **Reposting** | Repost to friends with attribution pill | `repostLime` / `removeLimeRepost` with green attribution pill for non-reposters | ✅ Parity |
| **Comments** | Slide-up bottom sheet with replies | `CommentModal` with threaded replies, emoji pills, mention notifications, and pagination | ✅ Parity |
| **Lime Upload** | Video upload with caption & privacy | `CreateLimeModal` with 60s video picker, aspect ratio presets, and upload progress | ✅ Parity |

---

### 3.5 Profiles & Social Graph (`app/profile/`, `components/profile/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Own Profile** | Header, bio, live counters, tabs (Timeline, About, Friends, Reposts, Gallery) | `Profile.tsx` with live stats, avatar/banner editing, and tabbed content switchers | ✅ Parity |
| **Other User Profile** | Relationship buttons, mutual friends, posts | `viewOtherProfile/[id].tsx` with live Add Friend, Cancel Pending Request, Unfriend, Block, Report | ✅ Parity |
| **Settings & Security** | Account settings, theme switcher, blocks | `app/profile/settings/` with Dark/Light mode switcher and blocked users management | ✅ Parity |
| **Verification** | Student & National ID verification | Identity upload modals and status badges (Student Verified / Verified) | ✅ Parity |

---

### 3.6 Admin Workspaces (`app/admin/`, `components/admin/`) — **100% Implemented**
Suite of all 12 canonical management destinations:
1. `UserManagement` — Search, filter by role/status, verify email, suspend, ban, delete.
2. `TestersManagement` — Beta tester invitation management and token revocation.
3. `ProductModeration` — Marketplace listing reviews, approvals, and removals.
4. `CommunityModeration` — Community directory compliance, guidelines, and suspension.
5. `ReportsManagement` — Centralized queue for reported posts, limes, messages, communities, and users.
6. `AdminAuditLogs` — Immutable chronological trail of admin actions.
7. `CommunityCategories` — Category creation, icon mapping, and ordering.
8. `UserLifecycle` — State-machine management of account status.
9. `StickersManagement` — Sticker pack and asset management.
10. `PageAccess` — Role-based access control and feature gating.
11. `AdsManagement` — Promoted feed campaigns approval and analytics.
12. `SystemAnalytics` — Global KPIs, engagement, and platform health telemetry.

---

## 4. Push Notification & Lockscreen Calling Master Plan

### 4.1 Native Mobile Push & Incoming Call Realities
1. **Background & Killed State**:
   - When a React Native mobile app is killed or device is asleep/locked, JavaScript engines are stopped.
   - JS `onSnapshot` / Firestore listeners do not execute in closed app states.
2. **Push Notifications (Messages & Alerts)**:
   - Must be dispatched from server via **Firebase Cloud Messaging (FCM)** for Android and **Apple Push Notification service (APNs)** for iOS.
   - Payload must include high-priority data and notification blocks matching platform notification channels.
3. **WhatsApp-Style Incoming Lockscreen Calls**:
   - **Android**: High-priority FCM data message (`priority: 'high'`) wakes up background handler -> triggers **Full-Screen Intent** notification (`@notifee/react-native` or Android Telecom / CallKeep `ConnectionService`) with `category: AndroidCategory.CALL`, `importance: AndroidImportance.MAX`, and full-screen incoming call UI.
   - **iOS**: PushKit VoIP push token (`PKPushRegistry`) wakes up background handler -> immediately reports incoming call to **CallKit** (`reportNewIncomingCall`), displaying native iOS lock screen incoming call interface.

---

## 5. Verification Commands

```bash
# Verify TypeScript compile
cmd /c "node_modules\.bin\tsc --noEmit"

# Run automated architecture and discipline scan
node scripts/check-discipline.cjs
```
