# Ourlime Mobile - Product Requirements and Web Parity FRD

Last audited & updated: 2026-08-18

Web source: `C:\Users\aaron\Github\Ourlime-Web`

Mobile source: `C:\Users\aaron\Github\Ourlime-Web\Ourlime-Mobile`

---

## 1. Purpose & Scope

This is the master feature-requirements document (FRD) for bringing **Ourlime Mobile** to complete functional, architectural, and design parity with **Ourlime Web** while adhering to high-end native iOS and Android user experience patterns.

It defines:
1. Complete feature parity benchmarks across all core product areas (Feeds, Real-Time Chat, Communities, Limes, Profiles, Auth, Admin, and Push Notifications).
2. Service-Oriented Object-Oriented Programming (OOP) boundaries and layer separation.
3. Strict engineering discipline: Zero-`any` policy, direct React imports, `type` aliases over interfaces, and safe area inset guarantees.
4. Native background push notification architecture (Google FCM Direct Multicast + Expo fallback) for instant lockscreen delivery when the app is terminated/killed.
5. Real-Time Dynamic Page Access Control syncing with Firestore `pageAccessSettings`.
6. Media & Rich Text parity: Clickable URLs, 16:9 YouTube video embeds with Android Error 153 protection, and playful empty state illustrations.

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

### 3.1 Feeds (`app/(tabs)/index.tsx`, `components/home/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Feed Scopes** | Home, Friends, Communities feeds | Handled via `FeedResourceService` & `PostService` querying canonical APIs & Firestore with membership filters | ✅ Parity |
| **Content Filters** | All, Photos, Videos, Sound (Coming Soon), Polls, Events | Filter chips with instant local filtering, paginated fetch queries, and playful "Soon" badge for Sound | ✅ Parity |
| **Rich Text & URLs** | Auto-detected hyperlinks and @mentions | `RichTextContent` renders clickable green links (`Linking.openURL`) and `@mention` profile navigation | ✅ Parity |
| **YouTube Video Embeds** | 16:9 inline YouTube player for YouTube links | `RichTextContent` embeds 16:9 `react-native-webview` with `youtube-nocookie.com`, `Referer: https://ourlime.com/` (fixing Error 153), and "Watch on YouTube" launch bar | ✅ Parity |
| **Interactive Cards** | Regular, Media carousel, Video, Polls, Events, Reposts | Full card components with double-tap heart animations, voter cards, live polling percentages, and audio control | ✅ Parity |
| **Post Creation** | Modal with text, media cropper, location, polls, tags | `CreatePostModal` with `MediaCropModal` aspect ratios, location picker, and `@mention`/`#hashtag` detection | ✅ Parity |
| **Offline Cache** | Stale-while-revalidate caching | SQLite persistent snapshots with background silent revalidation and "New Posts" pill buffer | ✅ Parity |
| **Widgets** | Promoted ads, activity, suggested users | Feed-injected cards with live follow/friend request actions and modal confirmations (games excluded) | ✅ Parity |

---

### 3.2 Real-Time Chat & Communications (`app/chat/`, `components/chat/`) — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **1-on-1 Direct Chat** | Real-time message stream with Firestore | `useChatMessages` hook + `ConversationResourceService` with instant local optimistic UI | ✅ Parity |
| **Archive / Unarchive**| Chat settings dropdown archive option | `MessagingService.setArchiveStatus` + `ChatSettingsMenu` with instant unread/archive filtering | ✅ Parity |
| **Voice Notes** | Record and audio playback with waveforms | High-performance recording timer, dynamic waveforms, playback progress, and 1x/1.5x/2x speed | ✅ Parity |
| **Sticker Packs** | Categorized sticker picker with search | `StickerPicker` modal with tabs, animated stickers, recent history, and favorites | ✅ Parity |
| **Message Reactions** | Long-press emoji reaction bar | Floating reaction picker with animated bursts and reaction summary sheets | ✅ Parity |
| **Quoted Replies & Forwards**| Visual quoted bubble & forward modal | Quoted message banner, scroll-to-reference, and forward-to-friend flow | ✅ Parity |
| **Thread Management** | Mute, archive, pin, delete, clear | Swipe / long-press action sheets with AsyncStorage & Firestore sync | ✅ Parity |
| **Calling** | Voice & Video calls via Agora RTC | Root `CallContext` coordinator, Agora RTC SDK integration, in-call camera/mic controls | ✅ Parity |

---

### 3.3 Dynamic Page Access Control & Admin Toggles — **100% Implemented**
| Feature | Web Baseline | Mobile Implementation | Status |
|---|---|---|---|
| **Real-Time Admin Sync** | Reads Firestore collection `pageAccessSettings` | `PageAccessService.subscribeToSettings` live `onSnapshot` listener updates routes instantly | ✅ Parity |
| **Status Options** | `enabled`, `coming_soon`, `maintenance`, `beta_only`, `developer_only`, `admin_only`, `disabled` | Full support for all 7 statuses across all registered app routes | ✅ Parity |
| **Role-Aware Access** | Admins & Developers bypass coming soon / maintenance | `AuthorizationService.canAccessStatus` grants access to Admins/Devs while blocking unauthorized users | ✅ Parity |
| **Presentation Overlay**| Themed full-screen blocking overlay | `PageAccessOverlay` with playful Ourlime stickers (`Worried.png`, `Sleepy.png`, `Thinking.png`), status badges, and back navigation | ✅ Parity |
| **Navigation Filtering** | Dynamic hiding of disabled pages | `SlideOutMenu` and `AppNavigation` filter items where `isVisibleInNavigation === false` | ✅ Parity |

---

### 3.4 Push Notifications & Terminated App Delivery — **100% Implemented**
| Feature | Architecture | Mobile & Backend Implementation | Status |
|---|---|---|---|
| **Direct Google FCM** | Android Native Token Dispatch | `PushNotificationService` registers genuine FCM token (`fnwjget...`) to Firestore with `transport: 'fcm'` | ✅ Parity |
| **Server Routing** | Web backend `pushServer.ts` dual dispatch | Dispatches direct FCM tokens to `admin.messaging().sendEachForMulticast()` and Expo tokens to Expo gateway | ✅ Parity |
| **App Killed Delivery** | High-priority data & notification payload | Lock screen and heads-up banner notifications trigger on Android device with app completely killed | ✅ Parity |

---

### 3.5 404 Not Found Screen (`app/+not-found.tsx`) — **100% Implemented**
| Feature | Mobile Implementation | Status |
|---|---|---|
| **Expo Router 404** | Root `+not-found.tsx` with centered sad Worried sticker (`assets/images/stickers/reactions/Worried.png`) | ✅ Parity |
| **Theming & Actions** | Bold green 404 title, friendly missing page copy, and a `Go Home` button navigating to `/(tabs)` | ✅ Parity |
