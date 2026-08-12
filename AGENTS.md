# Ourlime Mobile — Project Rules & AI Agent Instructions

React Native app built with **Expo Router**, **TypeScript**, **NativeWind (Tailwind CSS)**, **React Native Reanimated**, and **Zustand**.

---

## 1. Core Engineering Philosophy & OOP Architecture

### 1.1 Object-Oriented Service Architecture (OOP)
Ourlime Mobile enforces a **Service-Oriented Object-Oriented Programming (OOP)** architecture for business logic, data formatting, relationship management, and API integration.

- **Encapsulation**: Domain rules and API handlers live strictly inside plain TypeScript service classes (e.g. `ChatService`, `AuthService`, `RelationshipService`).
- **Single Responsibility**: Service classes manage distinct domain logic. They expose a clean public API for UI components and custom hooks.
- **Layer Independence**:
  - UI Components serve purely as presentation views.
  - Custom React Hooks manage React lifecycle and delegate to service instances.
  - Service classes own API calls, caching, validation, and data formatting.

### 1.2 Folder & Layer Structure

```
Ourlime-Mobile/
├── app/                        # Expo Router file-based pages
│   ├── (auth)/                 # Authentication routes (login, register)
│   ├── (tabs)/                 # Main tab navigation (Home, Search, Limes, Discover, Profile)
│   ├── _layout.tsx             # Root Stack Navigator configuration
│   └── globals.css             # NativeWind tailwind entry
├── components/                 # React components grouped by feature area
│   ├── ui/                     # Project-wide reusable UI components (AppHeader, SlideOutMenu)
│   ├── home/                   # Home feed & MiddleSection components
│   └── auth/                   # Authentication forms and cards
├── mobile/                     # Specialized screen containers (e.g. Register multi-step flow)
├── lib/                        # Services, hooks, store, and helpers
│   ├── services/               # OOP Service Classes (Auth, Chat, Relationships, API)
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # Type definitions for components & domain objects
│   └── store/                  # Zustand state stores
├── assets/                     # Static images, icons, and SVG assets
└── .agents/                    # Repository rules, guidelines, and skills
```

---

## 2. Naming Conventions & Code Discipline

### 2.1 Component & Prop Naming
- **Components**: `PascalCase` for component filenames and functions (`LoginScreen.tsx`, `AppHeader.tsx`, `FeedsFilterSection.tsx`).
- **Prop Types**: Always use `type [ComponentName]Props = { ... }`. Do not use `interface`.
- **Event Handlers**:
  - Internal handlers: prefix with `handle` (`handleLogin`, `handleNextStep`).
  - Prop callbacks: prefix with `on` (`onPress`, `onMenuPress`, `onBackPress`).

### 2.2 Strict TypeScript & Type-Safety Rules
- **Zero-`any` & Zero-Lazy-Record Policy**: Never use `any` as a type. Avoid `Record<string, unknown>` when a concrete type or `Partial<Pick<...>>` can be specified.
- **`type` over `interface`**: Always use `type MyType = { ... }`. Never use `interface`.
- **Direct React Imports**: Do not import `React` namespace (`import React from 'react'`). Import hooks and types directly (`import { useState, useEffect, useCallback } from 'react'` and `import type { ReactNode } from 'react'`).
- **Discriminated Union Overloads**: Use function overloads for hook and service methods accepting kind discriminators to preserve narrowed return types.
- **String Literal Unions**: Prefer string literal unions (`'active' | 'inactive'`) over numeric enums.
- **Callback Parameter Naming**: Use descriptive names in array callbacks (`friends.map(friend => ...)` instead of `f => ...`).

---

## 3. React Native & Expo UI Discipline

### 3.1 Navigation & Safe Area Rules
- **Safe Area Insets**: Always use `SafeAreaView` from `react-native-safe-area-context` with explicit `edges` (e.g. `edges={['top', 'left', 'right']}`) for screens with top headers to prevent overlap with iOS/Android status bars.
- **Header Positioning**: Keep fixed headers **outside** `KeyboardAvoidingView` so opening the software keyboard does not push the header off-screen.
- **Back Navigation**: Use text or robust SVG chevrons (`‹`) with `router.back()` to trigger native stack slide-right transitions.
- **Stack Animations**: Configure root `Stack` in `app/_layout.tsx` with `animation: 'slide_from_right'` and `gestureEnabled: true`.

### 3.2 Color System & NativeWind
- Use tailwind tokens matching `Ourlime-Web`:
  - `greenTheme` (`#10b981`)
  - `greenBright` (`#01eb53`)
  - `redTheme` (`#c64d53`)
  - `themeStart` / `themeEnd` gradient stops

---

## 4. Commands & Checks

```bash
cmd /c "node_modules\.bin\tsc --noEmit" # TypeScript verification
npx expo start                          # Start Metro bundler
```

---

## 5. Web Parity Master Directive
- **Primary Goal:** Replicate all features, design aesthetics, domain logic, and real-time capabilities of `Ourlime-Web` into `Ourlime-Mobile`, tailored for high-end native mobile UX (iOS & Android).
- Refer to [`PROJECT_CONTEXT.md`](file:///c:/Users/aaron/Github/Ourlime-Web/Ourlime-Mobile/PROJECT_CONTEXT.md) for complete feature maps, OOP service architecture, real-time notification sync, lockscreen push dispatching, WhatsApp-style messaging parity, and modern glassmorphism dialog modal rules.
