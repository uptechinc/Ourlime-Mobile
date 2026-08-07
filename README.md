# Ourlime Communities Network — Mobile (`Ourlime-Mobile`)

<div align="center">
  <h2>📱 React Native & Expo Router Mobile App</h2>
  <p><b>Expo SDK 57 · React Native 0.86 · React 19 · TypeScript · NativeWind (Tailwind CSS) · Firebase</b></p>
</div>

---

## 📌 Application Intent & Architecture

`Ourlime-Mobile` is the native mobile companion to the Ourlime web platform, delivering the same social networking, community, marketplace, and real-time communication features as a high-end native iOS/Android experience (Expo Go + dev builds).

### Core Architecture

The app follows a **Service-Oriented Object-Oriented Programming (OOP)** architecture:

- **UI Components** (`components/`, `mobile/`) — Pure presentation views, no business logic
- **Custom Hooks** (`lib/hooks/`) — Manage React lifecycle, delegate to services
- **Service Classes** (`lib/services/`, `lib/messaging/`, `lib/sticker/`) — Own API calls, caching, validation, and data formatting
- **State Management** (`lib/store/`, `zustand`) — Centralized state via Zustand

### Navigation Structure (`app/_layout.tsx`, `app/(tabs)/`)

- **Auth Routes** (`app/(auth)/`) — Login, registration, email verification
- **Tab Navigation** (`app/(tabs)/`) — Home feed, Search, Limes, Discover, Profile
- **Stack Routes** (`app/chat/[id]/`, `app/profile/[username]`, etc.) — Deep-linked detail screens
- **Multi-step Flows** (`mobile/Register/`) — Wizard-style registration flow

---

## 🚀 Complete Feature Matrix

### 1. 📱 Social Feed (`app/(tabs)/index.tsx`, `components/home/`)
- Infinite-scrolling feed of posts with image/video/gallery support (`MiddleSectionComponent/PostCardSection/`)
- Post interactions: like/heart reactions, emoji reaction picker, comments, shares
- Reply-to-message threading with visual reply banners
- Post options sheet (delete, report, forward)
- **Create post modal** (`CreatePostModal/`) — Text, images, videos, events, polls, location tagging
- Media cropping (`MediaCropModal.tsx`) with aspect ratio presets
- Location picker integration
- Hashtag and mention detection

### 2. 💬 Real-Time Chat (`app/chat/[id]/page.tsx`, `components/chat/`)
- One-on-one direct messaging with real-time Firebase Firestore subscriptions
- Sticker packs with search and favorites (`components/sticker/StickerPicker.tsx`)
- Voice note recording and playback (`components/chat/VoiceNotePlayer.tsx`)
- Image/video/document attachments with previews
- Message reactions with emoji picker
- Reply references with quoted message context
- Long-press action menu (reply, forward, react, delete)
- **Video calling** via Agora RTC (`components/chat/VideoCallModal.tsx`)
- Message status indicators (sent, delivered, read)
- Delete for me / delete for everyone
- Message search and pagination

### 3. 👥 Friends & Social Graph (`lib/relationships/friendshipService.ts`)
- Friend requests with accept/decline
- Follow/unfollow with real-time relationship status
- Friendship management (block, report, remove)
- User profile pages with custom tabs

### 4. 🤝 Communities (`mobile/CommunityDetail/`, `components/communities/`)
- Community creation and discovery
- Community feeds with discussion threads
- Role-based membership (Owner, Admin, Moderator, Member)
- Polls, events, and file sharing within communities
- Sidebar navigation with community management tools

### 5. 🎓 E-Learning (`components/eLearning/`)
- Class schedules and course materials
- Study groups and discussion boards
- Tutor/student discovery

### 6. 🛒 Marketplace (`app/market/`, `components/market/`)
- Product listings with image carousels
- Category filters (Electronics, Vehicles, Real Estate, Fashion, Services)
- Product detail pages with seller info
- Direct chat inquiry to sellers

### 7. 📅 Events (`app/events/`, `components/events/`)
- Event creation with cover images and venue details
- RSVP tracking (Going, Interested, Not Going)
- Map view integration for venue directions

### 8. 📰 Blogs (`app/blogs/`, `components/blog/`)
- Article publishing with rich text and cover images
- Reader experience with author bios and related posts
- Social sharing and estimated reading time

### 9. 💼 Jobs (`app/jobs/`, `components/jobs/`)
- Job listings (full-time, part-time, remote, freelance)
- Application flow with resume attachment
- Employer dashboard

### 10. 💰 Wallets & Lime Points (`app/eLearning/`, `components/limes/`)
- Lime points economy for platform engagement
- eWallet dashboard for balance and transfers

### 11. 📢 Notifications (`components/home/NotificationsModal.tsx`)
- Real-time notification feed via Firestore onSnapshot
- Friend requests, likes, comments, mentions, community invites
- Bulk selection and actions (mark read, mark unread, delete)
- Filter by category (all, unread, friends, likes, comments, mentions, communities)
- Sort by unread-first or newest-first

### 12. 🛡️ Admin & Moderation (`components/admin/`, `components/moderation/`)
- Content moderation dashboard
- Reported post review
- User management

---

## 🛠️ Technology Stack

| Component | Technology | Description |
|---|---|---|
| **Core Framework** | Expo SDK 57 | Managed workflow with Expo Router |
| **UI Layer** | React Native 0.86 | Cross-platform native rendering |
| **Language** | TypeScript | Strict typing across codebase |
| **Styling** | NativeWind (Tailwind CSS) | Tailwind classes with `tailwind-rn` |
| **State** | Zustand | Centralized state management |
| **Navigation** | Expo Router + React Navigation | File-based routing with stack & tab navigators |
| **Backend** | Firebase Auth, Firestore, Storage | Real-time database, authentication, media storage |
| **Realtime** | Firebase Firestore `onSnapshot` | Real-time message/friendship/notification listeners |
| **Video Calls** | Agora RTC SDK | Voice & video calling |
| **Image Picker** | expo-image-picker | Photo/video selection from library |
| **File Picker** | expo-document-picker | Document attachment selection |
| **Maps** | react-native-maps | Map rendering |
| **Animations** | react-native-reanimated | Native animations & transitions |
| **Safe Areas** | react-native-safe-area-context | Status bar / notch safe spacing |
| **Package Manager** | npm | Standard package management |

---

## 💻 Installation & Running Locally

### Prerequisites
- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://docs.npmjs.com/cli/v10/configuring/configuring-npm) or [Expo Go](https://expo.dev/go) app on your device

### Commands

```bash
# 1. Clone the repository
git clone https://github.com/uptech2021/Ourlime
cd Ourlime-Mobile

# 2. Install dependencies
npm install

# 3. Start the development server
npm run start
# or
npx expo start

# 4. Run TypeScript type check
npx tsc --noEmit

# 5. Run linter
npm run lint
```

### Running on a Device

- **Expo Go (fastest):** Scan the QR code from `npx expo start` with the Expo Go app
- **Android emulator:** Run `npm run android` (requires Android Studio)
- **iOS simulator:** Run `npm run ios` (requires Xcode + CocoaPods)

### Environment Variables

Create a `.env` file in the root directory. Contact [Aaron](https://github.com/A-Hazzard) for the required Firebase configuration variables.

---

## 📱 Project Structure

```
Ourlime-Mobile/
├── app/                          # Expo Router file-based pages
│   ├── (auth)/                   # Authentication routes (login, register)
│   ├── (tabs)/                   # Main tab navigation
│   │   ├── index.tsx             # Home feed
│   │   ├── Chat.tsx              # Chats list
│   │   ├── Limes.tsx             # Limes/points
│   │   ├── Search.tsx            # Search
│   │   ├── Discover.tsx          # Discover
│   │   └── Profile.tsx           # Profile
│   ├── _layout.tsx               # Root layout with Stack config
│   └── globals.css               # NativeWind entry
├── components/                   # Reusable UI components
│   ├── chat/                     # Chat-specific components
│   ├── home/                     # Home/feed components
│   ├── ui/                       # Shared UI (AppHeader, SlideOutMenu, etc.)
│   ├── sticker/                  # Sticker picker
│   ├── communities/              # Community components
│   ├── market/                   # Marketplace components
│   └── eLearning/                # Education components
├── mobile/                       # Specialized screen containers
│   ├── Register/                 # Multi-step registration
│   └── CommunityDetail/          # Community detail screen
├── lib/                          # Services, hooks, store, types
│   ├── services/                 # OOP service classes
│   ├── hooks/                    # Custom React hooks
│   ├── store/                    # Zustand stores
│   ├── types/                    # TypeScript type definitions
│   ├── messaging/                # MessagingService singleton
│   └── sticker/                  # StickerService singleton
├── assets/                       # Static images, icons, SVGs
└── AGENTS.md                     # AI agent rules and conventions
```

---

## 📏 Coding Standards

- **Strict TypeScript** — No `any`, explicit `type` definitions only
- **OOP Services** — All business logic lives in service classes (encapsulated, SRP)
- **Direct React Imports** — `import { useState } from 'react'` (no `import React`)
- **Safe Areas** — `SafeAreaView` from `react-native-safe-area-context` with explicit `edges`
- **Navigation** — `slide_from_right` transitions with gesture enabled
- **No comments** in code unless explicitly requested
