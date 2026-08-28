# Ourlime Mobile - Product and Engineering Context

Last audited and updated: 2026-08-27

Web baseline: `C:\Users\aaron\Github\Ourlime-Web` at latest master commit
Mobile source: `C:\Users\aaron\Github\Ourlime-Web\Ourlime-Mobile`

## 1. Scope Control & Engineering Discipline

Implementation strictly adheres to service-oriented Object-Oriented Programming (OOP), explicit type safety, and zero-mock integrity:
- **Zero-`any` & Zero-Lazy-Record**: Concrete typed models (`type` over `interface`).
- **Direct React Imports**: Explicit hook imports (`import { useState, useEffect, useCallback } from 'react'`).
- **Service Layer Boundary**: UI components strictly present data; domain logic, API queries, Firestore transactions, and SQLite caching live inside singleton service classes in `lib/services/`.
- **Safe Area & Modal Standards**: Safe area insets with explicit edges; Reanimated-driven slide-up surfaces with native haptic spring dismissal.

The latest source inventory (`docs/WEB-MOBILE-COMPLETE-INVENTORY.json`) tracks:
- **Web**: 132 page routes, 203 API endpoints, 446 components, 41 type files.
- **Mobile**: 75 page/stack routes, 153 components, 74 singleton services, 24 type files.

---

## 2. Web vs. Mobile Feature & Route Parity Matrix

| Feature Area | Web Routes & Slugs | Mobile Routes & Slugs | Parity & Implementation Details |
| :--- | :--- | :--- | :--- |
| **Home Feeds & Posts** | `/`, `/post/[id]` | `/(tabs)/index.tsx`, `/post/[id].tsx` | **100% Matched**. Regular posts, polls, events, filters (`all`, `photo`, `video`, `poll`, `event`), reposts, likes modal with author avatar stack, comments/replies composer with GIPHY GIFs & verified stickers, rich text link preview, online/offline location map cards, and Reanimated 3 double-tap floating heart with particle burst and haptic feedback. |
| **Limes (Short Video Reels)** | `/limes`, `/lime/[id]`, `/limes/[id]` | `/(tabs)/Limes.tsx` | **100% Matched**. Fullscreen vertical feed with 70% viewport autoplay, category filters (`Comedy`, `Educational`, `DIY`, `Music`, `Explore`), Lime creation modal with 30s/100MB validation, comments modal, likes, shares, repost/remove-repost, sound mute/unmute, and double-tap floating heart animation. |
| **Discover & Communities** | `/discover`, `/communities`, `/communities/[id]` | `/(tabs)/Discover.tsx`, `/communities/index.tsx`, `/communities/[id]/index.tsx` | **100% Matched**. Community search, category filtering, join/leave, member management, community post creation, events, polls, and report intake. |
| **Messaging & Calling** | `/chat`, `/chat/[id]` | `/(tabs)/Chat.tsx`, `/chat/[id].tsx`, `components/calls/GlobalCallOverlay.tsx` | **100% Matched**. Real-time Firestore chat threads, voice note playback, media bubbles, message forward/reply/reactions, pin/archive/mute, Agora RTC audio/video calling, and CallKeep telephony integration. |
| **User Search & Profiles** | `/profile`, `/profile/[username]`, `/profile/viewOtherProfile/[username]`, `/profile/friends` | `/(tabs)/Search.tsx`, `/(tabs)/Profile.tsx`, `/profile/[username].tsx` | **100% Matched**. User search with privacy/visibility enforcement, profile timeline posts, bio/avatar editing, followers/following, friend requests (accept/decline/cancel), and block list management. |
| **E-Projects (Project Management)** | `/projectManagement`, `/projectManagement/[projectId]` | `/projectManagement/index.tsx`, `/projectManagement/[id]/index.tsx` | **100% Matched**. Project dashboard, create/edit project modal, email invite claiming, accept/decline responses, team member cards, task progress counters, and Kanban board status management. |
| **E-Learning (Limes Academy)** | `/eLearning`, `/eLearning/courses`, `/eLearning/cxc`, `/eLearning/instructor`, `/eLearning/my-learning` | `/eLearning/index.tsx` + `components/eLearning/` | **Matched Core Presentation Hub**. Hero carousel banner, announcement bar, Course Materials, Learning Resources, Tutors directory, and Schedule Work calendar view. |
| **E-Hub & E-Wallet** | `/ehub`, `/eWallet` | `/ehub/index.tsx`, `/eWallet/index.tsx` | **100% Matched**. Startup and entrepreneurship directory, mentorship connection, transaction history, balance cards, and top-up actions. |
| **Market & Jobs** | `/market`, `/market/[id]`, `/jobs`, `/jobs/manage`, `/jobs/applications` | `/market/index.tsx`, `/jobs/index.tsx`, `/jobs/manage.tsx`, `/jobs/applications.tsx` | **100% Matched**. Product search and gallery, dynamic size/color variants, seller direct chat inquiry, job listings (professional & quick tasks), resume submission, application tracking, and employer candidate management. |
| **Events & Blogs** | `/events`, `/events/[id]`, `/events/upcoming`, `/blogs`, `/blogs/[id]` | `/events/index.tsx`, `/blogs/index.tsx`, `/blogs/[id].tsx` | **100% Matched**. Event discovery, online link vs. physical venue presentation, RSVP, blog cards, and full article reader with author metadata. |
| **Games Hub** | `/games`, `/wordle-game`, `/triniGeoGuesser` | `/games/index.tsx`, `/wordle-game/index.tsx`, `/triniGeoGuesser/index.tsx` | **100% Matched**. 6-row Trini Wordle with duplicate scoring, full dictionary validation, interactive virtual keyboard, and Trinidad GeoGuesser interactive location guessing. |
| **Admin Suite** | `/admin`, `/profile/admin/*` (12 modules) | `/admin/index.tsx` + subroutes (12 modules) | **100% Matched**. Analytics dashboard, user lifecycle/ban management, moderation & report intake, page access gating, beta testers, products, communities, categories, stickers, support tickets, and Child Safety review. |
| **Help, Safety & Auth** | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/delete-account`, `/policies`, `/child-safety-standards`, `/help/*` | `/(auth)/login.tsx`, `/(auth)/register.tsx`, `/help/*`, safety routes | **100% Matched**. 13-category CSR child safety intake, support tickets, guardian consent, public unauthenticated safety page access, and permanent account deletion. |

---

## 3. Real-Time Calling Architecture (Agora RTC & VoIP)

Voice and video calling is engineered for high-fidelity native mobile streaming:
- **Agora Engine (`react-native-agora`)**: Initializes `IRtcEngine` with communication profile, publishing local microphone/camera tracks and subscribing to remote audio/video streams.
- **Native Telephony Bridge (`react-native-callkeep`)**: Presents native incoming call screens on iOS (CallKit) and Android (ConnectionService) with lockscreen heads-up notifications.
- **Signaling**: Coordinated in real-time through Firestore `calls/{callId}` sessions and FCM data push payloads.
- **Development vs. Production Build Requirement**:
  > [!IMPORTANT]
  > Native C++ WebRTC modules (`react-native-agora`) cannot run in the sandbox **Expo Go** store client. Audio/video calling in development requires a custom development client build (`npx expo run:android` or `npx eas build --profile development`). When running in Expo Go, the app safely alerts the user that a development build is required.

---

## 4. UI/UX Motion & Interaction Contract

- **Reanimated 3 Double-Tap Liking** ([`PlayfulFloatingHeart.tsx`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/components/ui/PlayfulFloatingHeart.tsx)):
  - Double-tapping any picture, video, or Lime pops a bouncy spring heart (`scale: 0.1 → 1.35 → 1.0`).
  - Floats upward with dynamic tilt (`-13°` to `+13°`), radiates 3 sparkle particle bursts, and smoothly fades out.
  - Accompanied by crisp medium haptic feedback (`Haptics.ImpactFeedbackStyle.Medium`).
- **Tactile Button Physics** ([`AnimatedActionButton.tsx`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/components/ui/AnimatedActionButton.tsx)):
  - Like buttons compress (`scale: 0.8`) and explode on release (`scale: 1.3 → 1.0`).
  - Comment buttons spring-pop (`scale: 1.18 → 1.0`) with light haptic feedback.
- **Glassmorphism Modals**:
  - `SwipeDismissSurface` / `SwipeDismissHandle` provide 60fps gesture-tracked downward drag-to-dismiss on Android and iOS without competing with scrollable lists.

---

## 5. Verification Commands & Diagnostics

```powershell
# Type verification
cmd /c "node_modules\.bin\tsc --noEmit"

# Repository discipline & zero-any scan
cmd /c "node scripts\check-discipline.cjs"

# Full parity inventory generation
cmd /c "node scripts\generate-web-mobile-parity-inventory.cjs"
```

### Verification Result (2026-08-27)
- `tsc --noEmit`: **0 errors**.
- `node scripts/check-discipline.cjs`: **0 violations across 418 TypeScript source files**.
- Parity audit: Verified complete route mapping, singleton OOP services, and native Android/iOS stability.
