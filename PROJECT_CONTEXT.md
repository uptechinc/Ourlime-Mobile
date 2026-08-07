# Ourlime Mobile — Project Context & Web Parity Guide

## 🎯 Master Objective
**Faithfully replicate all features, design aesthetics, domain logic, and real-time functionality of `Ourlime-Web` into `Ourlime-Mobile`, crafted specifically with high-end native mobile UX (iOS & Android) using React Native, Expo Router, NativeWind, and TypeScript.**

---

## 🗺️ Web Route Directory (`Ourlime-Web/app`) to Mobile Screen Mapping

Below is the complete breakdown of every page/folder in `Ourlime-Web/app` and its corresponding target screen/module in `Ourlime-Mobile`:

| Web Route Folder (`Ourlime-Web/app/`) | Feature Description | Target Mobile Path (`Ourlime-Mobile/app/`) | Implementation Status |
| :--- | :--- | :--- | :--- |
| **`login/`**, **`register/`**, **`forgot-password/`**, **`reset-password/`**, **`verify/`**, **`verify-email/`** | Auth & multi-step onboarding | `app/(auth)/login.tsx`, `app/(auth)/register.tsx`, `mobile/Register/` | ✅ Complete |
| **`page.tsx`** | Main Home Feed, Post Creation, Likes, Comments, Reposts | `app/(tabs)/index.tsx` | ✅ Complete |
| **`notifications/`** | Notifications panel with filters, sorting, bulk actions, friend requests | `components/home/NotificationsModal.tsx` | ✅ Complete (Web Parity) |
| **`limes/`** | Short vertical video reels (Limes), audio track, likes, comments, sharing | `app/(tabs)/Limes.tsx`, `components/limes/` | ✅ Complete |
| **`chat/`** | Real-time direct messaging, stickers, voice notes, voice & video calling | `app/(tabs)/Chat.tsx`, `app/chat/[id].tsx`, `components/chat/` | ✅ Complete (WhatsApp Parity) |
| **`discover/`** | Global discovery feed, trending limes, suggested friends | `app/(tabs)/Discover.tsx` | ✅ Complete |
| **`search/`** | Global search across users, posts, limes, and communities | `app/(tabs)/Search.tsx` | ✅ Complete |
| **`profile/`** | User profile wall, friends list, photos, videos, edit profile, block user | `app/(tabs)/Profile.tsx`, `app/profile/[username].tsx` | ✅ Complete |
| **`communities/`** | Communities listing, group posts, member management | `app/communities/index.tsx`, `app/community-detail.tsx` | ✅ Complete |
| **`events/`** | Event creation, RSVP management, location picker | `app/events/index.tsx` | ✅ Complete |
| **`market/`** | Buy & sell marketplace, product listings, category filters | `app/market/index.tsx` | ✅ Complete |
| **`jobs/`** | Career job board, job search, application submit | `app/jobs/index.tsx` | ✅ Complete |
| **`eLearning/`** | Course catalog, video lessons, quiz module | `app/eLearning/index.tsx` | ✅ Complete |
| **`blogs/`** | Blog articles, reader view, comments | `app/blogs/index.tsx` | ✅ Complete |
| **`eWallet/`**, **`ehub/`**, **`ads/`** | Electronic wallet, advertising hub, promo dashboard | Specialized Hub Modals & Profile Settings | 🔄 Parity In Progress |
| **`games/`**, **`wordle-game/`**, **`triniGeoGuesser/`** | Mini-games (Wordle, Trini GeoGuesser) | Embedded Native Webview / Game Sheets | 🔄 Parity In Progress |
| **`terms-and-conditions/`**, **`privacy-policy/`** | Terms of service & privacy policies | Settings & Profile Info Sheets | ✅ Complete |

---

## 🏗️ Architecture & Core Discipline

### 1. Service-Oriented OOP Architecture
- **Service Classes (`lib/services/` & `lib/relationships/`):** All business logic, API calls, caching, validation, and data formatting live strictly inside plain TypeScript singleton service classes (e.g. `AuthService`, `MessagingService`, `NotificationService`, `FriendshipService`, `PushNotificationService`).
- **Zero-`any` Policy:** All parameters, returns, and state variables are strictly typed using `type MyType = { ... }`.
- **Safe Area & Layout Discipline:** Screens use `SafeAreaView` from `react-native-safe-area-context` with explicit `edges`. Headers stay outside `KeyboardAvoidingView`.

---

## 🚀 Accomplishments & Feature Implementation Map

### 1. 💬 Messaging, Calling & Media (WhatsApp Parity)
- **WhatsApp-Style Emoji & Sticker Keyboard (`components/chat/StickerSheet.tsx`):** Replaced horizontal scroll emoji lists with a full-screen grid keyboard featuring tabbed sticker packs and emoji selection.
- **Delete for Everyone (`lib/messaging/MessagingService.ts`):** Deleting a message updates the document text to `'This message was deleted'` (italicized grey text) and strips media/attachments.
- **Calling vs. Ringing Distinction (`components/chat/VideoCallModal.tsx`):**
  - **`Calling...`**: Displayed while dialing out before receiver acknowledges connection.
  - **`Ringing...`**: Displayed once receiver device acknowledges incoming call.
  - **Call Timer (`00:01`)**: Hidden during calling/ringing states; starts counting strictly when answered (`connected`).
- **Instant Camera Preview:** `<CameraView>` viewfinder mounts with dynamic permission keys for immediate front camera preview stream on permission grant.

---

### 2. 🔔 Real-Time Notification System (Web Parity)
- **Universal Notification Provider (`lib/contexts/NotificationContext.tsx`):** Real-time `onSnapshot` listener on `userNotifications/{userId}` syncing unread count across the entire app without polling.
- **Header Unread Badge (`components/ui/AppHeader.tsx`):** Vibrant green circular badge (`#10b981`, bold white count text, elevation shadow) on the bell icon.
- **Notification Controls & Filter Pills (`components/home/NotificationsModal.tsx`):**
  - **Filter Categories:** `All`, `Unread`, `Friends`, `Likes`, `Comments`, `Mentions`, and `Communities`.
  - **Sort Modes:** `Unread first` vs. `Newest first`.
  - **Grouped Headers:** `UNREAD · X` section header for unread items.
  - **Collapsible Read Section:** Read notifications are hidden by default; expandable via `<Icon name="bell" /> Show read notifications (X)` / `Hide read notifications (X)`.
- **Dual-State Selection & Checkboxes:** Long-press or top `Select all` reveals checkboxes. Bulk action bar renders **Mark Read (X)** (green `#10b981`), **Mark Unread (Y)** (blue `#3b82f6`), and **Delete (Z)** (red `#ef4444`) side-by-side.
- **Interactive Friend Request Cards:** Render **Accept** (`#10b981`) and **Decline** (`#f1f5f9`) buttons. Resolution immediately updates friendship status in Firestore, sends a `friend_accepted` notification, and transitions the card to `✓ Request handled`.
- **Firestore Query Index Fix (`lib/services/NotificationService.ts`):** Delegates queries directly to `getUserNotifications(userId)`, reading `userNotifications/{userId}`'s `notificationsMap` in memory and bypassing composite index requirements.
- **Pure JavaScript Time Ago (`lib/helpers/notificationHelpers.ts`):** Lightweight relative timestamp calculation handling Firestore `Timestamp` objects (`toMillis`, `toDate`, `seconds`), `Date` objects, strings, and numbers without external `date-fns` bundler dependencies.

---

### 3. 📱 Push Notifications (`lib/services/PushNotificationService.ts`)
- Pure TypeScript push notification service dispatching high-priority Expo push payloads (`priority: 'high'`, `sound: 'default'`, `channelId: 'calls' / 'default'`).
- Respects chat mute status (`isChatMuted`) to suppress alerts for muted chats while delivering lockscreen notifications when app is closed or phone is locked.

---

### 4. ✨ Modern Custom Glassmorphism Dialog Modals (`components/ui/CustomModal.tsx`)
- Replaced plain native system `Alert.alert` popups with a modern glassmorphism dialog card component.
- Dark overlay backdrop (`rgba(15, 23, 42, 0.65)`), rounded card (`borderRadius: 24`, elevation 10), vibrant icon header badges (`success` green, `danger` red, `warning` amber, `info` blue), and styled pill action buttons.

---

## 🛠️ Key Files & References

| Component / Service | File Path | Description |
| :--- | :--- | :--- |
| **Notification Context** | [`lib/contexts/NotificationContext.tsx`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/lib/contexts/NotificationContext.tsx) | Universal real-time `onSnapshot` notification provider |
| **Notification Helpers** | [`lib/helpers/notificationHelpers.ts`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/lib/helpers/notificationHelpers.ts) | Pure JS notification map operations & relative time formatting |
| **Notifications Modal** | [`components/home/NotificationsModal.tsx`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/components/home/NotificationsModal.tsx) | Full web parity notification panel with sort/filter/bulk/resolved states |
| **Push Notification Service** | [`lib/services/PushNotificationService.ts`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/lib/services/PushNotificationService.ts) | High-priority Expo push API dispatch & token registration |
| **Friendship Service** | [`lib/relationships/friendshipService.ts`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/lib/relationships/friendshipService.ts) | OOP Service for friend requests & status updates |
| **Custom Dialog Modal** | [`components/ui/CustomModal.tsx`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/components/ui/CustomModal.tsx) | Glassmorphism dialog component replacing native `Alert.alert` |
| **App Header** | [`components/ui/AppHeader.tsx`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/components/ui/AppHeader.tsx) | Header with live green notification count badge |
