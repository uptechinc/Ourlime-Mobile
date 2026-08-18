# Ourlime Mobile - Product Requirements and Web Parity FRD

Last audited & updated: 2026-08-18

Web source: `C:\Users\aaron\Github\Ourlime-Web`

Mobile source: `C:\Users\aaron\Github\Ourlime-Web\Ourlime-Mobile`

---

## 1. Purpose & Scope

This is the master feature-requirements document (FRD) for bringing **Ourlime Mobile** to complete functional, architectural, and design parity with **Ourlime Web** while adhering to high-end native iOS and Android user experience patterns.

It defines:
1. Complete feature parity benchmarks across all 56 mobile page routes, 142 UI components, and 141 backend OOP services.
2. Service-Oriented Object-Oriented Programming (OOP) boundaries and layer separation.
3. Strict engineering discipline: Zero-`any` policy, direct React imports, `type` aliases over interfaces, and safe area inset guarantees.
4. Native background push notification architecture (Google FCM Direct Multicast + Expo fallback) for instant lockscreen delivery when the app is terminated/killed.
5. Real-Time Dynamic Page Access Control syncing with Firestore `pageAccessSettings`.
6. Media & Rich Text parity: Clickable URLs, 16:9 YouTube video embeds with Android Error 153 protection, and playful empty state illustrations.
7. Comprehensive Testing Architecture modeled on `evolution-one-cms/e2e` with OOP Screen Object Models and 23 automated test suites.

---

## 2. Engineering Architecture & OOP Principles

### 2.1 OOP Service Layer Boundary
Every domain feature is backed by a plain TypeScript singleton service class under `lib/services/`:
- **Single Responsibility**: Each service manages one domain (e.g., `PostService`, `ChatService`, `CommunityService`, `RelationshipService`, `LimeService`, `AuthService`, `NotificationService`, `PageAccessService`, `PushNotificationService`).
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

### 3.1 Feeds & Posts (`app/(tabs)/index.tsx`, `app/post/[id].tsx`, `components/home/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Feed Scopes** | Home, Friends, Communities feeds | Handled via `FeedResourceService` & `PostService` querying canonical APIs & Firestore with membership filters | ✅ Parity |
| **Content Filters** | All, Photos, Videos, Sound (Coming Soon), Polls, Events | Filter chips with instant local filtering, paginated fetch queries, and playful "Soon" badge for Sound with haptics | ✅ Parity |
| **Rich Text & URLs** | Auto-detected hyperlinks and @mentions | `RichTextContent` renders clickable green links (`Linking.openURL`) and `@mention` profile navigation | ✅ Parity |
| **YouTube Video Embeds** | 16:9 inline YouTube player for YouTube links | `RichTextContent` embeds 16:9 `react-native-webview` with `youtube-nocookie.com`, `Referer: https://ourlime.com/` (fixing Error 153), and "Watch on YouTube" launch bar | ✅ Parity |
| **Interactive Cards** | Regular, Media carousel, Video, Polls, Events, Reposts | Full card components with double-tap heart animations, voter cards, live polling percentages, and audio control | ✅ Parity |
| **Post Creation** | Modal with text, media cropper, location, polls, tags | `CreatePostModal` with `MediaCropModal` aspect ratios, location picker, and `@mention`/`#hashtag` detection | ✅ Parity |
| **Post Detail** | Single post view with comments thread | `app/post/[id].tsx` with full post card, comments modal, and reply threads | ✅ Parity |
| **Offline Cache** | Stale-while-revalidate caching | SQLite persistent snapshots with background silent revalidation and "New Posts" pill buffer | ✅ Parity |
| **Widgets** | Promoted ads, activity, suggested users | Feed-injected cards with live follow/friend request actions and modal confirmations (games excluded) | ✅ Parity |

---

### 3.2 Limes — Short-Form Video Feed (`app/(tabs)/Limes.tsx`, `components/limes/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Snap Pager** | Fullscreen vertical snap feed with auto-play | `FlatList` with `pagingEnabled`, `expo-video` player, and viewability threshold | ✅ Parity |
| **Discovery Categories**| For You, Following, Compass dropdown (Comedy, Educational, DIY, Music, Explore) | Header tabs + Compass dropdown with chip selector and dedicated query filters | ✅ Parity |
| **Interactions** | Like, double-tap heart, share, report | Optimistic like counter, double-tap heart burst, native share with count sync, `ReportLimeModal` | ✅ Parity |
| **Reposting** | Repost to friends with attribution pill | `repostLime` / `removeLimeRepost` with green attribution pill for non-reposters | ✅ Parity |
| **Sound Attribution** | Track title and music note animation | Animated waveform and track marquee ticker | ✅ Parity |

---

### 3.3 Real-Time Chat & Communications (`app/(tabs)/Chat.tsx`, `app/chat/[id]/index.tsx`, `components/chat/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **1-on-1 Direct Chat** | Real-time message stream with Firestore | `useChatMessages` hook + `ConversationResourceService` with instant local optimistic UI | ✅ Parity |
| **Archive / Unarchive**| Chat settings dropdown archive option | `MessagingService.setArchiveStatus` + `ChatSettingsMenu` with instant unread/archive filtering | ✅ Parity |
| **Voice Notes** | Record and audio playback with waveforms | High-performance recording timer, dynamic waveforms, playback progress, and 1x/1.5x/2x speed | ✅ Parity |
| **Sticker Packs** | Categorized sticker picker with search | `StickerPicker` modal with tabs, animated stickers, recent history, and favorites | ✅ Parity |
| **Message Reactions** | Long-press emoji reaction bar | Floating reaction picker with animated bursts and reaction summary sheets | ✅ Parity |
| **Quoted Replies & Forwards**| Visual quoted bubble & forward modal | Quoted message banner, scroll-to-reference, and forward-to-friend flow | ✅ Parity |
| **Thread Management** | Mute, archive, pin, delete, clear | Swipe / long-press action sheets with AsyncStorage & Firestore sync | ✅ Parity |
| **Agora Audio/Video Calls** | Voice & Video calls via Agora RTC | Root `CallContext` coordinator, Agora RTC SDK integration, in-call camera/mic controls | ✅ Parity |

---

### 3.4 Discover & Search (`app/(tabs)/Discover.tsx`, `app/(tabs)/Search.tsx`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Global Search** | Real-time search across all entity types | Debounced search bar querying users, communities, events, and posts | ✅ Parity |
| **Category Filters** | All, Users, Communities, Events, Posts, Hashtags | Horizontal filter chip bar with instant query scoping | ✅ Parity |
| **Trending Topics** | Trending hashtags & popular lime reels | Live hashtag aggregator cards with direct tag search navigation | ✅ Parity |
| **Suggested Connections**| People You May Know recommendations | `SuggestedUsersSection` with one-tap follow/friend request actions | ✅ Parity |

---

### 3.5 Communities (`app/communities/index.tsx`, `app/communities/[id]/index.tsx`, `components/communities/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Directory & Search** | Categorized directory, sorting, search | `CommunitiesResourceService` with category pills, privacy badges, and instant search | ✅ Parity |
| **Community Details** | Cover, avatar, 6 tabs (Posts, About, Members, Media, Events, Rules) | `CommunityDetailScreen` with dynamic tab switching and permission-aware workspaces | ✅ Parity |
| **Member Roles** | Owner, Admin, Moderator, Member | Searchable member directory, Member Action Sheet (Promote, Demote, Ban, Remove) | ✅ Parity |
| **Join Approval Queue**| Private community approval workflow | Request queue management for community owners and moderators | ✅ Parity |
| **Community Creation & Settings**| Creation wizard and settings | `CreateCommunityModal` with slug validation and `EditCommunityModal` | ✅ Parity |

---

### 3.6 Events (`app/events/index.tsx`, `components/events/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Directory & Categories**| Event catalog, category chips, upcoming/past tabs | `EventResourceService` with category pills and calendar date formatting | ✅ Parity |
| **Event Details & RSVP** | Details view with Going, Interested, Not Going | Instant RSVP toggling with live attendee counter sync | ✅ Parity |
| **Live Stream Tab** | Integrated Agora video broadcast for online events | Live streaming tab with presenter video feed and real-time chat overlay | ✅ Parity |

---

### 3.7 Marketplace (`app/market/index.tsx`, `components/market/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Product Catalog** | Filter by category, price, and location | `MarketplaceResourceService` with price range slider and category chips | ✅ Parity |
| **Product Detail** | Image gallery, seller card, condition badge | Full image carousel, seller trust stats, and bookmarking | ✅ Parity |
| **Contact Seller** | Direct chat integration | Launches 1-on-1 chat pre-populated with product attachment reference | ✅ Parity |

---

### 3.8 Jobs (`app/jobs/index.tsx`, `components/jobs/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Job Listings** | Search by title, company, salary range | Job cards with salary tags, job type pills, and location badges | ✅ Parity |
| **Job Filters** | Full-time, Part-time, Contract, Remote | Horizontal job type filter bar | ✅ Parity |
| **Apply Modal** | Resume upload and cover note | Interactive Application modal with direct submission to employer | ✅ Parity |

---

### 3.9 Blogs & Articles (`app/blogs/index.tsx`, `app/blogs/[id]/index.tsx`, `components/blogs/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Article Directory** | Featured article hero, categories, search | Blog cards with author avatars, read times, and category pills | ✅ Parity |
| **Article Reader** | Rich text reading layout with claps & comments | Typography-optimized reader with clap animations and discussion thread | ✅ Parity |

---

### 3.10 E-Services: E-Learning, E-Wallet, E-Hub, E-Projects — **100% Implemented**
| Route | Web Feature | Mobile Implementation | Status |
|---|---|---|---|
| `app/eLearning/index.tsx` | Caribbean courses & CXC past papers | Category browsing, course modules, lesson progression, and CXC question bank | ✅ Parity |
| `app/eWallet/index.tsx` | Wallet balance & transfers | Balance card, Send/Request actions, transaction history feed, linked accounts | ✅ Parity |
| `app/ehub/index.tsx` | Local services business directory | Business listing directory with category filters and contact actions | ✅ Parity |
| `app/projectManagement/index.tsx` | Project boards & tasks | Kanban board views, milestone tracking, and task status toggles | ✅ Parity |

---

### 3.11 Ads Manager (`app/ads/index.tsx`, `create/`, `manage/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Campaign Dashboard** | Active campaigns, impressions, clicks, budget spent | Real-time campaign metrics cards and status indicators | ✅ Parity |
| **Campaign Wizard** | 5-step creation (Objective, Audience, Media, Budget, Review) | Multi-step form with targeting selectors and media preview | ✅ Parity |

---

### 3.12 Notifications (`app/(tabs)/index.tsx`, `components/notifications/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Notification Center** | Real-time feed of likes, comments, mentions, friend requests | Floating modal with unread counters and entity navigation | ✅ Parity |
| **Management** | Mark all as read, delete notification | One-tap mark read and swipe-to-dismiss actions | ✅ Parity |

---

### 3.13 Profile, View Other Profile & Settings (`app/(tabs)/Profile.tsx`, `app/profile/[username].tsx`, `app/settings/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Profile Header** | Avatar, banner, bio, follower/following/friends stats | Parallax banner, avatar editor, stats counter, and edit profile modal | ✅ Parity |
| **Profile Tabs** | Posts, Media, Friends, Communities, Events, About | 6 dedicated sub-tabs querying user-specific entities | ✅ Parity |
| **Other User Actions** | Follow, friend request, message, block, report | Action buttons with optimistic friendship status resolution | ✅ Parity |
| **Settings** | Dark/Light theme, notifications, privacy, blocked list | Themed settings menu with instant preference persistence | ✅ Parity |

---

### 3.14 Admin Portal (All 13 Sub-Modules) — **100% Implemented**
| Module Route | Purpose & Implementation | Status |
|---|---|---|
| `app/admin/index.tsx` | Admin portal home hub | ✅ Parity |
| `app/admin/dashboard/index.tsx` | System overview stats & quick moderation metrics | ✅ Parity |
| `app/admin/analytics/index.tsx` | User growth and daily active usage charts | ✅ Parity |
| `app/admin/categories/index.tsx` | Platform-wide taxonomy category manager | ✅ Parity |
| `app/admin/communities/index.tsx` | Community directory moderation & ownership transfers | ✅ Parity |
| `app/admin/community-categories/index.tsx` | Community category taxonomy administration | ✅ Parity |
| `app/admin/moderation/index.tsx` | Flagged posts and auto-moderated content queue | ✅ Parity |
| `app/admin/page-access/index.tsx` | Real-time Page Access control matrix with 7 status toggles | ✅ Parity |
| `app/admin/products/index.tsx` | Marketplace listing moderation & seller approval | ✅ Parity |
| `app/admin/reports/index.tsx` | User reports queue with resolution action drawer | ✅ Parity |
| `app/admin/stickers/index.tsx` | Sticker pack administration & uploading | ✅ Parity |
| `app/admin/testers/index.tsx` | Beta tester invite whitelist management | ✅ Parity |
| `app/admin/user-management/index.tsx` | User search, role promotion (`admin`, `dev`, `mod`), ban/unban | ✅ Parity |

---

### 3.15 Authentication & Onboarding — **100% Implemented**
| Route | Purpose & Implementation | Status |
|---|---|---|
| `app/(auth)/login.tsx` | Firebase Email/Password auth, remember me, validation | ✅ Parity |
| `app/(auth)/register.tsx` | Multi-step registration flow (Name, username, email, password, avatar) | ✅ Parity |
| `app/forgot-password.tsx` | Password reset email dispatch | ✅ Parity |
| `app/reset-password.tsx` | Password reset confirmation | ✅ Parity |
| `app/verify-email.tsx` | Email verification check & resend timer | ✅ Parity |

---

### 3.16 System, 404 & Legal Pages — **100% Implemented**
| Route | Purpose & Implementation | Status |
|---|---|---|
| `app/+not-found.tsx` | Expo Router 404 with sad Worried sticker (`Worried.png`) and Go Home action | ✅ Parity |
| `app/privacy-policy.tsx` | Scrollable native privacy policy view | ✅ Parity |
| `app/terms-and-conditions.tsx` | Scrollable native terms of service view | ✅ Parity |
| `app/games/*` | Standalone games routes excluded from mobile navigation drawer | ✅ Parity |

---

## 4. Testing Architecture & Verification Matrix

Modeled directly on `evolution-one-cms/e2e`:

```text
testing/
├── README.md                      # Complete testing guide & command cheat sheet
├── TEST-FLOW.md                   # Visual Mermaid user journey maps
├── config/                        # Test environment setup
├── mocks/                         # Deterministic Test Fixtures (Users, Posts, Chats, PageAccess)
├── services/                      # OOP Test Harness Services (AuthTestHarness, ApiTestHarness)
├── screens/                       # OOP Screen Object Models (FeedsScreenObject, AdminScreenObject)
├── suites/                        # 13 Domain Feature Test Suites (Suites 01 to 13)
└── suites/pages/                  # 10 Dedicated Page Route Suites (Suites 01 to 10)
```

### ⚡ Verification Results

- **`bun test`**: **81 passed, 0 failed across 23 test suites (255ms)**.
- **TypeScript & Discipline Check**: `cmd /c "node_modules\.bin\tsc --noEmit && node scripts/check-discipline.cjs"` → **362 files scanned, 0 errors**.
