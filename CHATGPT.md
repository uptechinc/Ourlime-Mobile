# Ourlime Mobile — ChatGPT Project Instructions & Agent Guidelines

React Native app built with **Expo Router**, **TypeScript**, **NativeWind (Tailwind CSS)**, **React Native Reanimated**, **SQLite (Local Caching)**, and **Zustand**.

---

## 1. Quick Reference & Core Directives

When writing code, debugging, or implementing features for Ourlime Mobile, you **MUST ALWAYS** follow these rules:

1. **Object-Oriented Service Architecture (OOP)**:
   - All API communication, caching, data transformation, and business logic live inside TypeScript service classes (e.g., `AuthService`, `ChatService`, `RelationshipService`, `ApiService`).
   - Use `private constructor()` and static `getInstance()` singletons.
   - UI components must remain pure presentation views. Custom React hooks handle React lifecycle and delegate to service singletons.

2. **Strict TypeScript & Type-Safety Rules**:
   - **Zero `any`**: Never use `any` or loose `Record<string, unknown>`. Use concrete types, `Pick`, or `Partial`.
   - **`type` over `interface`**: Always use `type [Name] = { ... }`. Never use `interface`.
   - **Direct React Imports**: Never import `React` namespace (`import React from 'react'`). Import directly (`import { useState, useEffect } from 'react'` and `import type { ReactNode } from 'react'`).
   - **No Single-Letter Callbacks**: Always use descriptive parameter names in array callbacks (`friends.map(friend => ...)` not `f => ...`).

3. **React Native & Safe Area Rules**:
   - **Safe Areas**: Always import `SafeAreaView` from `'react-native-safe-area-context'` with explicit `edges={['top', 'left', 'right']}`. Never import `SafeAreaView` from `'react-native'`.
   - **Header Positioning**: Top headers must sit **outside** `KeyboardAvoidingView` so focusing an input never pushes the header off-screen.
   - **Slide Transitions**: Root Stack in `app/_layout.tsx` is configured with `animation: 'slide_from_right'` and `gestureEnabled: true`.

4. **Standalone Native Build Stability**:
   - Guard native modules (e.g. `@react-native-firebase/messaging`, `react-native-callkeep`) with platform checks (`Platform.OS === 'ios'` or `platformEnvironmentService.hasNativeFirebaseMessaging()`) to avoid TurboModule reflection / missing binary crashes.

---

## 2. Skill Index (Located in `.agents/skills/`)

All skills in `.agents/skills/` are fully compatible with OpenAI and ChatGPT:

| Skill | Folder | Purpose |
|---|---|---|
| **instant-mobile-resources** | [`.agents/skills/instant-mobile-resources/`](.agents/skills/instant-mobile-resources/SKILL.md) | SQLite stale-while-revalidate caching, permission-aware background preloading, bounded pagination, and mutation reconciliation for instant page loads. |
| **native-chat-experience** | [`.agents/skills/native-chat-experience/`](.agents/skills/native-chat-experience/SKILL.md) | Deterministic newest-message positioning, FlashList pagination, cached message hydration, keyboard handling, and WhatsApp-style messaging. |
| **oop-service-architecture** | [`.agents/skills/oop-service-architecture/`](.agents/skills/oop-service-architecture/SKILL.md) | Object-Oriented service patterns, encapsulation, single responsibility, and singleton dependency composition. |
| **type-safety** | [`.agents/skills/type-safety/`](.agents/skills/type-safety/SKILL.md) | Strict TypeScript discipline, direct React imports, discriminated return overloads, string literal unions, and zero-any policy. |
| **naming-conventions** | [`.agents/skills/naming-conventions/`](.agents/skills/naming-conventions/SKILL.md) | File naming, `[ComponentName]Props` typing, `handle*` internal vs `on*` prop handler prefixes, and section ordering. |
| **react-native-navigation-fix** | [`.agents/skills/react-native-navigation-fix/`](.agents/skills/react-native-navigation-fix/SKILL.md) | Safe area header containers, Android status bar insets, software keyboard separation, and back button slide transitions. |
| **native-build-stability** | [`.agents/skills/native-build-stability/`](.agents/skills/native-build-stability/SKILL.md) | Standalone Android APK/iOS build stability, Google Services config integrity, TurboModule isolation, and logcat debugging. |

---

## 3. Project File Tree & Architecture

```
Ourlime-Mobile/
├── app/                        # Expo Router file-based routes
│   ├── (auth)/                 # Login & Registration flows
│   ├── (tabs)/                 # Tab Navigation (Home, Search, Limes, Discover, Profile)
│   ├── _layout.tsx             # Root Stack Navigator & Global ErrorBoundary
│   └── globals.css             # NativeWind Tailwind entry
├── components/                 # Presentation components
│   ├── ui/                     # AppHeader, CustomModal, SlideOutMenu, AppErrorBoundary
│   ├── home/                   # Feeds, Post Cards, Story Bar
│   ├── chat/                   # Message bubbles, Composer, Conversation list
│   ├── admin/                  # Admin workspaces and moderation
│   └── auth/                   # Authentication forms and cards
├── lib/                        # Business logic & domain layer
│   ├── services/               # OOP Service Classes (Auth, Chat, Relationship, Api, Notification, etc.)
│   ├── hooks/                  # Custom React hooks delegating to services
│   ├── types/                  # Concrete TypeScript type definitions
│   └── store/                  # Zustand presentation stores
├── .agents/                    # Repository rules, guidelines, and skills
│   ├── rules/                  # Project-wide engineering rules
│   └── skills/                 # Agent skills with OpenAI YAML metadata
└── scripts/                    # Discipline and build validation scripts
```

---

## 4. Verification Commands

```bash
cmd /c "node_modules\.bin\tsc --noEmit"   # TypeScript verification
node scripts/check-discipline.cjs        # Code discipline & naming verification
npx expo start                           # Start Metro bundler
```
