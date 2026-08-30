# Ourlime Mobile — Product and Engineering Context

Last audited and updated: 2026-08-29 (Web Commit `20bc694e` / Mobile Head)

- **Web Baseline**: `C:\Users\aaron\Github\Ourlime-Web` at latest `Main` commit (`20bc694e`)
- **Mobile Source**: `C:\Users\aaron\Github\Ourlime-Web\Ourlime-Mobile`

---

## 1. Scope Control & Engineering Discipline

Implementation strictly adheres to service-oriented Object-Oriented Programming (OOP), explicit type safety, zero-mock integrity, and strict separation of presentation and domain layers:
- **Zero-`any` & Zero-Lazy-Record**: Concrete typed models with zero loose `any` casts (`type` over `interface`).
- **Direct React Imports**: Explicit hook imports (`import { useState, useEffect, useCallback } from 'react'`).
- **Service Layer Boundary**: UI components strictly present views and bind gestures; domain logic, API queries, Firestore transactions, security checks, and SQLite caching live inside singleton service classes in `lib/services/`.
- **Safe Area & Modal Standards**: Safe area insets with explicit edges (`edges={['top', 'left', 'right']}`); Reanimated 3-driven slide-up surfaces with native haptic spring dismissal.

---

## 2. Web vs. Mobile Feature & Route Parity Matrix

| Feature Area | Web Routes & Slugs | Mobile Routes & Slugs | Parity & Implementation Details |
| :--- | :--- | :--- | :--- |
| **Home Feeds & Posts** | `/`, `/post/[id]` | `/(tabs)/index.tsx`, `/post/[id].tsx` | **100% Matched**. Regular posts, polls, events, filters (`all`, `photo`, `video`, `poll`, `event`), reposts, likes modal with author avatar stack, comments/replies composer with GIPHY GIFs (Caribbean, Memes, Anime categories) & verified stickers, rich text link preview with OpenGraph enhancements, online/offline location map cards, and Reanimated 3 double-tap floating heart with particle burst and haptic feedback. |
| **Limes (Short Video Reels)** | `/limes`, `/lime/[id]`, `/limes/[id]` | `/(tabs)/Limes.tsx` | **100% Matched**. Fullscreen vertical feed with 70% viewport autoplay, category filters (`Comedy`, `Educational`, `DIY`, `Music`, `Explore`), Lime creation modal with 30s/100MB validation, comments modal, likes, shares, repost/remove-repost, sound mute/unmute, OpenGraph metadata sharing, and double-tap floating heart animation. |
| **Discover & Communities** | `/discover`, `/communities`, `/communities/[id]` | `/(tabs)/Discover.tsx`, `/communities/index.tsx`, `/communities/[id]/index.tsx` | **100% Matched**. Community search, category filtering, join/leave, member management, community post creation, events, polls, share community modal, and report intake. |
| **Messaging & Calling** | `/chat`, `/chat/[id]` | `/(tabs)/Chat.tsx`, `/chat/[id].tsx`, `components/calls/GlobalCallOverlay.tsx` | **100% Matched**. Real-time Firestore chat threads, voice note playback, media bubbles, message forward/reply/reactions, pin/archive/mute, floating bubble for repost & share to chat, bounded chat menus, Agora RTC audio/video calling, and CallKeep telephony integration. |
| **User Search & Profiles** | `/profile`, `/profile/[username]`, `/profile/viewOtherProfile/[username]`, `/profile/friends` | `/(tabs)/Search.tsx`, `/(tabs)/Profile.tsx`, `/profile/[username].tsx` | **100% Matched**. User search with privacy/visibility enforcement, profile timeline posts, bio/avatar editing, followers/following, friend requests (accept/decline/cancel), block list management, sanitized fallback initials, and **"🛡️ Deleted (Admin)"** post recovery tab. |
| **E-Projects (Project Management)** | `/projectManagement`, `/projectManagement/[projectId]` | `/projectManagement/index.tsx`, `/projectManagement/[id]/index.tsx` | **100% Matched**. Project dashboard, create/edit project modal, email invite claiming, accept/decline responses, team member cards, task progress counters, and Kanban board status management. |
| **E-Learning (Limes Academy)** | `/eLearning`, `/eLearning/courses`, `/eLearning/cxc`, `/eLearning/instructor`, `/eLearning/my-learning` | `/eLearning/index.tsx` + `components/eLearning/` | **Matched Core Presentation Hub**. Hero carousel banner, announcement bar, Course Materials, Learning Resources, Tutors directory, and Schedule Work calendar view. |
| **E-Hub & E-Wallet** | `/ehub`, `/eWallet` | `/ehub/index.tsx`, `/eWallet/index.tsx` | **100% Matched**. Startup and entrepreneurship directory, mentorship connection, transaction history, balance cards, and top-up actions. |
| **Market & Jobs** | `/market`, `/market/[id]`, `/jobs`, `/jobs/manage`, `/jobs/applications` | `/market/index.tsx`, `/jobs/index.tsx`, `/jobs/manage.tsx`, `/jobs/applications.tsx` | **100% Matched**. Product search and gallery, dynamic size/color variants, seller direct chat inquiry, job listings (professional & quick tasks), resume submission, application tracking, and employer candidate management. |
| **Events & Blogs** | `/events`, `/events/[id]`, `/events/upcoming`, `/blogs`, `/blogs/[id]` | `/events/index.tsx`, `/blogs/index.tsx`, `/blogs/[id].tsx` | **100% Matched**. Event discovery, online link vs. physical venue presentation, RSVP, blog cards, full article reader with author metadata, and centralized `BlogAuthorizationService` checking verified creator credentials. |
| **Games Hub** | `/games`, `/wordle-game`, `/triniGeoGuesser` | `/games/index.tsx`, `/wordle-game/index.tsx`, `/triniGeoGuesser/index.tsx` | **100% Matched**. 6-row Trini Wordle with duplicate scoring, full dictionary validation, interactive virtual keyboard, and Trinidad GeoGuesser interactive location guessing. |
| **Admin Suite** | `/admin`, `/profile/admin/*` (13 modules) | `/admin/index.tsx` + subroutes (13 modules) | **100% Matched**. Analytics dashboard, user lifecycle/ban management, content deletion with mandatory reasoning, appeals management queue, access controls & region/IP whitelisting, rate limiting & anti-abuse engine, page access gating, beta testers, products, communities, categories, stickers, support tickets, and Child Safety review. |
| **Help, Safety & Auth** | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/delete-account`, `/policies`, `/child-safety-standards`, `/help/*` | `/(auth)/login.tsx`, `/(auth)/register.tsx`, `/help/*`, safety routes | **100% Matched**. 13-category CSR child safety intake, support tickets, guardian consent, public unauthenticated safety page access, and permanent account deletion. |

---

## 3. Admin Moderation & Security Architecture

### 3.1 Content Deletion & Appeals Lifecycle
- **Three-Dot Menu (`...`)**: Accessible on all user-generated content (posts, comments, products, blogs, projects, communities) opening `AdminDeletionModal`.
- **Mandatory Reason Requirement**: Admin must select a predefined category (*Inappropriate*, *Harassment*, *Spam*, *Misinformation*, *Copyright*, *Child Safety*, *Terms of Service*, or *Custom*) with required explanations for custom entries.
- **Transparent Notifications**: Author receives automated notification with exact reason and link to `ContentAppealModal`.
- **Appeals Queue**: Admin Portal includes an **Appeals** queue to review user justifications with 1-click **"Approve & Restore"** and **"Reject"** actions.
- **Profile Deletion Tab**: Admins can inspect and restore soft-deleted posts directly from any user profile under the **"🛡️ Deleted (Admin)"** tab.

### 3.2 Geographic Region & IP Access Controls
- **Region Enforcement Policy**:
  - `allow_all`: Global unhindered access.
  - `allow_selected_only`: Restricts access strictly to selected countries (e.g. Trinidad & Tobago `['TT']`).
  - `block_selected`: Restricts access from specified blocked countries.
- **IP Rules & Whitelisting**:
  - **IP Whitelist**: Always allows specified IPs/CIDR ranges even if located in a blocked country.
  - **IP Blocklist**: Always denies specified IPs/CIDR ranges even if located in an allowed country.
- **Account Whitelist Bypass**:
  - Whitelisted user accounts/emails (e.g. administrators, QA testers) bypass all regional and IP restrictions worldwide.
- **Services**:
  - Web: [`adminSecurityService.ts`](file:///c:/Users/aaron/Github/Ourlime-Web/lib/admin/adminSecurityService.ts) and `/api/admin/security/access-controls`.
  - Mobile: [`AdminSecurityService.ts`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/lib/services/AdminSecurityService.ts) and [`AdminSecurityWorkspace.tsx`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/components/admin/AdminSecurityWorkspace.tsx).

### 3.3 Security & Anti-Abuse Rate Limiting
- **Sliding Window Rate Limiter**:
  - Per-IP and per-user token buckets for Auth (15 req/min), Posts (30 req/min), Comments (45 req/min), and General API (120 req/min).
  - Enforces HTTP 429 Too Many Requests with calculated retry intervals.

---

## 4. Real-Time Calling Architecture (Agora RTC & VoIP)

Voice and video calling is engineered for high-fidelity native mobile streaming:
- **Agora Engine (`react-native-agora`)**: Initializes `IRtcEngine` with communication profile, publishing local microphone/camera tracks and subscribing to remote audio/video streams.
- **Native Telephony Bridge (`react-native-callkeep`)**: Presents native incoming call screens on iOS (CallKit) and Android (ConnectionService) with lockscreen heads-up notifications.
- **Signaling**: Coordinated in real-time through Firestore `calls/{callId}` sessions and FCM data push payloads.
- **Development vs. Production Build Requirement**:
  > [!IMPORTANT]
  > Native C++ WebRTC modules (`react-native-agora`) cannot run in the sandbox **Expo Go** store client. Audio/video calling in development requires a custom development client build (`npx expo run:android` or `npx eas build --profile development`). When running in Expo Go, the app safely alerts the user that a development build is required.

---

## 5. UI/UX Motion & Interaction Contract

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

## 6. Verification Commands & Diagnostics

```powershell
# Type verification
cmd /c "node_modules\.bin\tsc --noEmit"

# Repository discipline & zero-any scan
cmd /c "node scripts\check-discipline.cjs"

# Automated Moderation & Security E2E Test Suite
node scripts/test-moderation-and-security.cjs
```

### Verification Results
- `tsc --noEmit`: **0 errors**.
- `node scripts/check-discipline.cjs`: **0 violations across 425 TypeScript source files**.
- `node scripts/test-moderation-and-security.cjs`: **19 / 19 Tests Passed (100%)**.
- Testing documentation: [`TESTING_GUIDE.md`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/TESTING_GUIDE.md).