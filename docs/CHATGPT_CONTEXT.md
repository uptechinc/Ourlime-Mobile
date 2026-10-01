# Ourlime Mobile — Project Context & Session Continuation Handoff

> **Target Audience:** ChatGPT / OpenAI Agents & Developers  
> **Repository:** `Ourlime-Mobile` (React Native with Expo Router, TypeScript, NativeWind, Reanimated, Zustand, Firebase)  
> **Last Updated:** September 2026

---

## 1. Project Overview & Core Architectural Directives

Ourlime Mobile is the native mobile companion to `Ourlime-Web`. It replicates the full feature set of Ourlime with high-end native iOS and Android user experiences.

### Critical Engineering Rules (Must Follow)
1. **Direct Firebase SDK First (Zero Local Next.js Server Dependency)**:
   - All mobile operations (chat, posts, blogs, media uploads, relationships, profile updates, e-learning, market) MUST talk directly to Firebase (Cloud Firestore, Firebase Storage, and Firebase Auth) using the React Native / Modular Firebase SDK.
   - **Never** depend on or require a running local Next.js server (`localhost:3000` or `192.168.x.x:3000`). If an API call to a web endpoint is attempted, it MUST have a reliable, direct Firestore fallback.
2. **Object-Oriented Service Architecture (OOP)**:
   - Business logic, caching, and data fetching belong in singleton service classes in `lib/services/` (e.g., `AuthService.getInstance()`, `NativeBlogService`, `MessagingService`).
   - UI components must remain pure presentation views. Custom hooks handle React lifecycle and delegate to services.
3. **Strict TypeScript Discipline**:
   - **Zero `any`**: Never use `any` or loose `Record<string, unknown>`. Use concrete types.
   - **`type` over `interface`**: Always use `type [Name] = { ... }`.
   - **Direct React imports**: `import { useState, useEffect } from 'react'` (do not do `import React from 'react'`).
   - **Descriptive callback arguments**: `items.map(item => ...)` instead of `items.map(i => ...)`.
4. **Safe Area & UI Rules**:
   - Use `SafeAreaView` from `react-native-safe-area-context` with `edges={['top', 'left', 'right']}`.
   - Keep fixed headers outside of `KeyboardAvoidingView`.

---

## 2. Recent Problems Solved & Changes Made

### A. Blog Author & Commenter Profile Pictures Fix
- **The Problem:** Profile pictures were not showing on blog cards, blog detail header, author card, or comments.
- **Root Cause:** In the Ourlime database schema, profile images are NOT stored directly on the `users/{uid}` document. Instead:
  1. Profile images are documents in the `profileImages` collection.
  2. The active image is linked in the `profileImageSetAs` collection (where `userId == uid`), with priority given to `setAs == 'postProfile'` over `setAs == 'profile'`.
  3. The blog service was attempting to read flat image fields directly off `users/{uid}`, which were empty strings.
- **Solution & Files Modified:**
  - `lib/services/NativeBlogService.ts`:
    - Updated `detail()` method to resolve the author's avatar using `AuthService.getInstance().getUserProfileIfAvailable(data.userId)`.
  - `lib/services/NativeEngagementService.ts`:
    - Updated `DiscussionComment` type to include `authorAvatar: string` and `isVerified?: boolean`.
    - In `page()` method, resolved comment author avatars in parallel using `AuthService.getInstance().getUserProfileIfAvailable(userId)`.
  - `lib/blogs&articles/BlogsAndArticlesService.ts`:
    - Updated `getCommentPage()` to pass through `comment.authorAvatar` and `comment.isVerified` instead of hardcoding an empty string.
  - **Verification Target Data:**
    - Blog ID: `SHvPts9j0utRcvFFQGZT` ("Best pool player")
    - Author: Kyle N (`BNoBT0tf6uQZ62nXhwJ7nFYXOCy1`)
    - Commenters: Aaron Hazzard (`5w95Iy6msWfb4b5aFaQcxtRgmrb2`) & Chris Walker (`sFnmq92URfU9zc9e2N9teYly5Ci1`)

---

### B. Direct Firestore Fallback for Chat / Sharing (`MessagingService`)
- **The Problem:** When using `ShareContentSheet` to share posts/content into chats, the app failed because `ApiService` attempted to call `POST /api/messaging` on the local Next.js server (`http://192.168.0.39:3000`).
- **Solution & Files Modified:**
  - `lib/messaging/MessagingService.ts`:
    - Wrapped the HTTP API request in a `try/catch`.
    - On failure or unreachable server, it falls back directly to Firestore: writes the message to `chats/{chatRoomId}` using `setDoc` / `updateDoc` with `arrayUnion`.
    - This satisfies the Zero Local Server Dependency rule.

---

### C. Modular Firebase Functions Import Fix
- **The Problem:** Metro bundler threw `SyntaxError: Unexpected keyword 'import'` in `CourseService.ts` and `NativeEngagementService.ts`.
- **Root Cause:** Incompatible mixing of legacy `@react-native-firebase/functions` dynamic imports with modular Firebase.
- **Solution & Files Modified:**
  - `lib/services/CourseService.ts` & `lib/services/NativeEngagementService.ts`:
    - Standardized to modular Firebase imports: `import { getFunctions, httpsCallable } from 'firebase/functions'` with `app` imported from `@/lib/firebaseConfig`.

---

### D. Skeleton Loader App-Wide Pass (Replaced Raw Spinners)
- **The Problem:** The user requested that page-level loading states must never be bare `ActivityIndicator` spinners. Every page should use an animated skeleton loader matching the page layout.
- **Investigation:**
  - `app/eLearning/index.tsx` already had `ELearningSkeleton`.
  - `app/projectManagement/index.tsx` already had `ProjectManagementSkeleton`.
  - `app/eLearning/my-learning.tsx` uses `CourseCatalogSkeleton`.
  - `app/eLearning/cxc.tsx` uses `CxcHubSkeleton`.
  - `app/jobs/index.tsx` and `app/jobs/[id].tsx` use job skeletons.
  - Several other pages were still using raw spinners on initial load.
- **New Skeletons Created in `components/ui/Skeleton.tsx`:**
  1. `SettingsSkeleton`: Animated profile card, tab chips, and input field placeholders.
  2. `TicketListSkeleton`: Ticket card placeholders with badges and metadata chips.
  3. `AdminOverviewSkeleton`: 4-item stat card grid + action rows.
  4. `ChildSafetyListSkeleton`: Report items with priority badges.
- **Files Updated to Use New Skeletons:**
  - `app/settings/index.tsx`: Replaced full-page `ActivityIndicator` with `<SettingsSkeleton />`.
  - `app/help/tickets/index.tsx`: Replaced hydration `ActivityIndicator` with `<TicketListSkeleton />`.
  - `app/admin/support/index.tsx`: Replaced queue loading `ActivityIndicator` with `<TicketListSkeleton />`.
  - `app/admin/index.tsx`: Replaced access-check and overview `ActivityIndicator` with `<AdminOverviewSkeleton />`.
  - `app/admin/child-safety/index.tsx`: Replaced initial load `ActivityIndicator` with `<ChildSafetyListSkeleton />`.
- **Note on Remaining `ActivityIndicator` Elements:** All remaining occurrences are button-level or inline indicators (e.g. Save button saving state, Send Invite button, modal submit buttons). These are intentional and conform to standard UX patterns.

---

### E. E-Hub Architecture & Routing Clarification
- **The Question:** "Why does e-hub send me to e-hub market? Is that how it works on the web?"
- **The Answer & Architecture:**
  - On web (`Ourlime-Web`), **E-Hub** functions as a promotional front door, deals showcase, and category portal.
  - All actual checkout flows, vendor orders, and messaging with sellers take place inside the central **Market** (`/market`).
  - In `app/ehub/index.tsx` (rendering `components/ehub/EHubScreen.tsx`), the screen features:
    - Flash deals carousel with countdown timer
    - Trust badges (100% Safe, Guaranteed, Top Rated)
    - 2-column product grid with local cart drawer
    - Top Freelancers list with skills and ratings
  - Buttons like "Lime Market", "Contact & Hire", and "Checkout on Lime Market" intentionally push to `/market` via `router.push('/market')` to maintain web parity and leverage the unified marketplace checkout pipeline.

---

## 3. Verification Status & Tools

- **TypeScript Verification**:
  ```bash
  cmd /c "node_modules\.bin\tsc --noEmit"
  ```
  Status: **Exit code 0 (0 errors)**.
- **Development Server**:
  ```bash
  npx expo start
  ```
- **Live Testing Note:**
  - When testing on a physical Android device or emulator, JS changes reload instantly via Metro Fast Refresh.
  - A full native build (`npx expo run:android`) is only needed when native dependencies (`android/` or `package.json` native libs) change.

---

## 4. Key File Reference Map

| Component / Layer | Path | Description |
|---|---|---|
| **Skeleton Library** | `components/ui/Skeleton.tsx` | All animated skeleton loaders (pulsing via Reanimated) |
| **Blog Services** | `lib/services/NativeBlogService.ts`<br>`lib/services/NativeEngagementService.ts`<br>`lib/blogs&articles/BlogsAndArticlesService.ts` | Blog detail, comments, and avatar resolution |
| **Auth & Profile Service** | `lib/services/AuthService.ts` | Canonical `getUserProfileIfAvailable(uid)` using `profileImageSetAs` → `profileImages` |
| **Messaging Service** | `lib/messaging/MessagingService.ts` | Messaging logic with direct Firestore fallback |
| **E-Learning Screens** | `app/eLearning/index.tsx`<br>`app/eLearning/my-learning.tsx`<br>`app/eLearning/cxc.tsx` | E-Learning catalog, enrollments, and CXC revision center |
| **E-Projects Screen** | `app/projectManagement/index.tsx`<br>`app/projectManagement/[id]/index.tsx` | Project lists, task boards, and member invites |
| **E-Hub Screen** | `app/ehub/index.tsx`<br>`components/ehub/EHubScreen.tsx` | E-Hub deals showcase, cart drawer, and freelancers |
| **Settings Screen** | `app/settings/index.tsx` | Account, privacy, notifications, and security settings |

---

## 5. Potential Next Steps for ChatGPT

1. **Blog Avatar Verification on Device**:
   - Navigate to `/blogs/SHvPts9j0utRcvFFQGZT` ("Best pool player") and confirm that Kyle N's avatar and Aaron Hazzard / Chris Walker's comment avatars load their remote images cleanly.
2. **E-Learning Data Populating / Seed Check**:
   - If courses or projects show empty states, ensure test data exists in Firestore for the active user (`courses` and `projects` collections).
3. **E-Hub to Market Cart Sync (Optional Parity Enhancement)**:
   - Items added to the EHub local cart can optionally be synced into the unified `CartSyncService` / `MarketplaceService` so checkout in `/market` carries over pre-selected items.
