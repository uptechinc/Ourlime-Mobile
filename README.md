# Ourlime Communities Network — Mobile (`Ourlime-Mobile`)

<div align="center">
  <h2>📱 React Native & Expo Router Mobile App</h2>
  <p><b>Expo SDK 57 · React Native 0.86 · React 19 · TypeScript · NativeWind (Tailwind CSS) · Zustand · SQLite · Firebase</b></p>
</div>

---

## 📌 Application Overview & OOP Architecture

`Ourlime-Mobile` is the high-performance native mobile companion to the Ourlime web platform, built for iOS and Android with strict design, functional, and real-time parity with `Ourlime-Web`.

### 🏗️ Engineering Philosophy & Layer Discipline

The application follows a **Service-Oriented Object-Oriented Programming (OOP)** architecture:

- **Presentation Layer (`app/`, `components/`, `mobile/`)**: Pure presentation views. React components own zero raw API calls, zero direct Firestore queries, and zero business validation rules.
- **Custom React Hooks (`lib/hooks/`)**: Handle React lifecycle, store subscriptions, and forward calls to domain service singletons.
- **Service Layer (`lib/services/`, `lib/messaging/`, `lib/sticker/`)**: Domain rules, API calls, SQLite caching, Firestore real-time subscriptions, and data mapping live strictly inside plain TypeScript singleton classes (`public static getInstance()`).
- **Resource State Store (`lib/store/useResourceStore.ts`)**: Centralized presentation caching and instant-loading state via Zustand and SQLite stale-while-revalidate caches.

---

## 🚀 Complete Feature Matrix

### 1. 📰 Feeds (`app/(tabs)/index.tsx`, `components/home/`)
- **Feed Scopes**: Seamless switching between **Home**, **Friends**, and **Communities** feeds.
- **Content Filter Chips**: Instant filter switching across **All**, **Photos**, **Videos**, **Sound**, **Polls**, and **Events**.
- **Interactive Post Cards**:
  - Regular text & rich media posts with multi-image/video carousels.
  - Interactive Polls with live voting, percentages, voter cards, and custom durations.
  - Events cards with date/time, RSVP buttons, and location maps.
  - Video cards with isolated audio management and viewability-based auto-play/pause.
  - Reposted content with reposter attribution badges, original creator info, and remove-repost support.
  - Like/heart reactions with animated heart bursts, like lists, comments count, and share sheet integration.
- **Create Post Workflow (`CreatePostModal/`)**:
  - Rich text composer with `@mentions` autocomplete and `#hashtag` detection.
  - Media picker with multi-upload, progress bars, and `MediaCropModal` aspect ratio presets (1:1, 4:5, 16:9).
  - Location tagging with map search and coordinates.
  - Poll creator with custom duration (hours/days) and dynamic options.
- **Feed Performance & Offline Persistence**:
  - Instant loading via SQLite local snapshots (`LocalCacheService`).
  - Stale-while-revalidate background synchronization without jumping feed scrolls.
  - Floating **"New Posts"** buffer pill for unobtrusive top updates.
- **Feed Widgets**: Injected Promoted Ads carousel, Weekly Activity summary, Suggested Users with live friend request toggles, and Games widget.

---

### 2. 💬 Real-Time Chat & Communications (`app/chat/`, `components/chat/`)
- **Conversation Discovery & Thread List**:
  - Direct 1-on-1 chats with real-time Firestore synchronization.
  - Instant search, active/idle presence badges, unread message badges, and delivery status indicators (sent, delivered, read).
  - Swipe/long-press actions: **Mute conversation**, **Archive conversation**, **Pin conversation**, and **Delete chat**.
- **Rich Message Experience**:
  - Text messaging with inline links, `@mentions`, and `#hashtags`.
  - Rich media attachments (images, full-screen video player, document downloads).
  - High-fidelity **Voice Notes** with recording timer, audio waveforms, playback progress, and speed toggles (1x, 1.5x, 2x).
  - **Sticker Picker (`components/sticker/StickerPicker.tsx`)**: Categorized sticker packs, recent stickers, search, and favorites.
  - **Emoji Reactions**: Long-press emoji reaction picker with live animated badges and multi-user reaction summaries.
  - **Quoted Replies & Message Forwarding**: Visual reply context banner, quoted message rendering, and forward-to-friend modal.
  - **Message Actions**: Copy text, reply, forward, delete for me, delete for everyone (within time window), and report message.
- **Calling Engine (`lib/contexts/CallContext.tsx`, `components/calls/`)**:
  - Voice and Video calling powered by root-level call coordinator, Agora RTC SDK, and Firebase signaling.
  - In-call controls: Mute microphone, toggle camera, switch front/back camera, toggle speakerphone, and end call.
  - Incoming call modal with ringtone feedback, caller profile image, and answer/decline actions.

---

### 3. 🤝 Communities (`app/communities/`, `components/communities/`, `mobile/CommunityDetail/`)
- **Community Directory**: Search, category filters, and sorting (popular, newest, active) across public and private communities.
- **Creation & Management**:
  - Wizard for community creation with banner/avatar uploads, unique slug validation, description, category, and privacy levels (Public / Private).
  - Community Edit Modal and Admin settings for name, cover, guidelines, and member permissions.
- **Community Details & Tabs**:
  - **Posts Feed Tab**: Community-exclusive posts, discussions, polls, and media threads.
  - **About Tab**: Rules, guidelines, creation date, category, and owner/moderator info.
  - **Members Tab**: Searchable member directory, role badges (Owner, Admin, Moderator, Member), and Member Action Sheet (Promote to Moderator/Admin, Demote, Remove, Ban).
  - **Events Tab**: Community-hosted events, RSVP tracking, and direct event creation.
  - **Polls Tab**: Community polls workspace with vote tracking and analytics.
- **Moderation & Reports**:
  - Community Join Requests management for private communities.
  - Community Report modal with reason categorizations and audit logs.
  - Community Dashboard sheet for owners and moderators with member/growth analytics.

---

### 4. 🍋 Limes — Short-Form Video Feed (`app/(tabs)/Limes.tsx`, `components/limes/`)
- **Vertical TikTok-Style Snap Pager**:
  - Full-screen vertical scrolling (`FlatList` with `pagingEnabled` and deceleration).
  - Deterministic auto-play for active video, auto-pause on scroll, and mute/unmute audio control.
  - Double-tap to like with full-screen popping heart animation.
- **Category Discovery & Navigation**:
  - Header discovery tabs: **For You**, **Following**, and Compass category dropdown (**Comedy**, **Educational**, **DIY**, **Music**, **Explore**).
  - Deep-link support for opening specific Limes (`?limeId=...`).
  - Creator profile navigation on avatar/handle tap.
- **Limes Interactions**:
  - Like toggle with optimistic count sync.
  - **Repost / Attribution Banner**: Repost lime to friends with attribution pill (`"X reposted"`) visible to non-reposters.
  - Native Share with dynamic deep-link generation and share count incrementing.
  - Live **Comments Bottom Sheet (`CommentModal.tsx`)**: Threaded replies, emoji quick bar, author verification, and mention dispatches.
  - **Report Modal (`ReportLimeModal.tsx`)**: Report lime or creator with reason chips.
- **Create Lime (`CreateLimeModal.tsx`)**: Video picker (up to 60s), aspect ratio fit, category selection, privacy settings, caption with `@mentions`, and upload progress bar.

---

### 5. 👤 Profile & Relationship Graph (`app/profile/`, `components/profile/`)
- **Own Profile (`app/(tabs)/Profile.tsx`, `app/profile/index.tsx`)**:
  - Profile header with editable Avatar, Cover Banner, Bio, Location, Work/Education, Social Links, and verification badges.
  - Live stats: Friends count, Posts count, Limes count, and Following count.
  - Profile tabs: **Timeline**, **About**, **Friends**, **Reposts**, and **Gallery** (Photos/Videos/Albums).
  - Edit Profile modal with image cropping and live availability checks.
- **Other User Profile (`app/profile/viewOtherProfile/[id].tsx`)**:
  - Live relationship actions: **Add Friend**, **Pending (Cancel Request)**, **Confirm/Decline Request**, **Unfriend**, **Follow/Unfollow**, **Direct Message**, **Block/Unblock**, and **Report User**.
  - Privacy-aware timelines and mutual friends visibility.
- **Settings & Account Management (`app/profile/settings/`)**:
  - Account settings, notifications preferences, theme switcher (Light/Dark/System), blocked users management, security, and privacy controls.

---

### 6. 🔐 Auth, Beta Access & Registration (`app/(auth)/`, `mobile/Register/`)
- **Multi-Step Registration Wizard (`mobile/Register/index.tsx`)**:
  - Step 0: Welcome & Beta Access verification.
  - Step 1: Account Type selection (Student vs Regular).
  - Step 2: Basic Info (Name, Username, Email, Password, Terms/Privacy checkboxes) with 500ms debounced live availability checks.
  - Step 3: Demographics & Education level.
  - Step 4: Location & Contact details.
  - Step 5: Avatar Selection (Cartoon vs Realistic SVG presets or custom photo upload).
  - Step 6: Interests Selection (Interactive 17-category grid, minimum 3 tags).
  - Step 7: Identity Verification & Email Verification dispatch.
- **Auth Recovery**: Clean Forgot Password and Reset Password flows with deep-link support.

---

### 7. 🛡️ Admin Workspaces (`app/admin/`, `components/admin/`)
- **Complete Suite of 12 Canonical Management Workspaces**:
  1. **User Management**: Search, filter by role/status, verify email, change account lifecycle status (Active/Suspended/Banned), and reset account.
  2. **Beta Testers Management**: Manage tester invitations, grant early access, and revoke tokens.
  3. **Product Moderation**: Marketplace product approval, category assignments, and listing removals.
  4. **Community Moderation**: Community directory management, guideline audits, and suspension.
  5. **Reports & Moderation**: Centralized report resolution for posts, limes, messages, communities, and users.
  6. **Admin Audit Logs**: Real-time log of administrative actions with timestamp, admin ID, and target.
  7. **Community Categories**: Dynamic category creation, icon assignment, and sorting.
  8. **User Lifecycle**: Account state machines and compliance tracking.
  9. **Sticker Management**: Sticker pack creation, asset upload, and categorization.
  10. **Page Access & Feature Flags**: Role-based access control, feature toggles, and beta gating.
  11. **Ads & Campaigns**: Promoted feed post approvals and impressions analytics.
  12. **System Analytics**: Aggregate metrics on users, engagement, and platform health.

---

## 🛠️ Development & Tooling

```bash
# Install dependencies
bun install

# Start Metro Bundler
npx expo start

# Type verification
cmd /c "node_modules\.bin\tsc --noEmit"

# Strict Code Discipline & OOP Validation Scan
node scripts/check-discipline.cjs
```

---

## 📁 Repository Structure

```
Ourlime-Mobile/
├── app/                        # Expo Router file-based routing
│   ├── (auth)/                 # Auth routes: login, register, forgot-password
│   ├── (tabs)/                 # Main bottom tabs: Feeds, Discover, Limes, Chat, Profile
│   ├── admin/                  # Admin workspaces
│   ├── chat/                   # Direct messaging detail screens
│   ├── communities/            # Community directory & details
│   ├── profile/                # Own & other user profiles, settings
│   └── _layout.tsx             # Root Stack navigator, Theme, Drawer & Call coordinators
├── components/                 # Presentation UI components by domain
│   ├── admin/                  # Admin management components
│   ├── auth/                   # Registration & Auth cards
│   ├── calls/                  # In-call overlay & video surfaces
│   ├── chat/                   # Messaging cards, voice notes, attachments
│   ├── communities/            # Community details, tabs, member sheets
│   ├── home/                   # Feeds, Post cards, composers, widgets
│   ├── limes/                  # Limes video players, comments, modals
│   ├── profile/                # Profile tabs, headers, edit modals
│   ├── sticker/                # Sticker picker & favorites
│   └── ui/                     # Reusable design system (Headers, Modals, Avatars, Skeletons)
├── lib/                        # Domain Logic, Services & State
│   ├── contexts/               # Theme, AppDrawer, CallContext, NotificationContext
│   ├── hooks/                  # Custom React lifecycle hooks
│   ├── navigation/             # AppNavigation registry & notification routes
│   ├── services/               # OOP Domain Service Singletons
│   ├── store/                  # Zustand state stores (useResourceStore, useCallStore)
│   └── types/                  # Strict TypeScript type definitions
├── assets/                     # Icons, splash screens, SVG illustrations
└── .agents/                    # Repository guidelines, rules, and skills
```
