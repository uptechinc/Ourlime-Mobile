---
name: naming-convention
description: Comprehensive naming conventions, OOP service architecture, folder structure, prop typing, handler prefixes, and code discipline ported from Evolution One CMS.
---

# Ourlime Naming Conventions & Code Discipline

Use this skill whenever **creating, modifying, or refactoring components, services, hooks, forms, modals, types, or utilities** across Ourlime Mobile and Web.

---

## 1. Component & File Naming Conventions

### 1.1 Filenames & Component Functions
- **Component Files**: Use `PascalCase` matching the primary exported component name (`AppHeader.tsx`, `FeedsFilterSection.tsx`, `CustomModal.tsx`).
- **Feature Components**: Prefix with Feature name: `[Feature][ComponentName].tsx` (e.g. `AuthLoginForm.tsx`, `CommunityDetailCard.tsx`).
- **Page Containers**: Use descriptive `PascalCase` or standard Expo Router / Next.js dynamic routing parameters (e.g. `[username].tsx`, `SearchScreen.tsx`, `DiscoverScreen.tsx`).
- **Reusable UI Primitives**: Store under `components/ui/` with clear descriptive names (e.g. `UserAvatar.tsx`, `CustomModal.tsx`, `SkeletonLoaders.tsx`).

### 1.2 Component Subfolder Organization
Group related subcomponents into semantic feature directories:
- `tabs/` — Tab-specific views
- `modals/` — Creation, confirmation, report, and edit modals
- `forms/` — Form fields, inputs, and form containers
- `cards/` — Metric cards, display cards, feed items
- `ui/` — Project-wide reusable UI components

---

## 2. Strict Prop & Type Discipline

### 2.1 Prop Type Naming Pattern
- Prop types **MUST** match the component name with a `Props` suffix:
  ```typescript
  type [ComponentName]Props = {
    // props
  };
  ```
- **ALWAYS** use `type`, never `interface`:
  ```typescript
  // ❌ WRONG
  interface CustomModalProps {
    visible: boolean;
  }

  // ✅ CORRECT
  type CustomModalProps = {
    visible: boolean;
  };
  ```

### 2.2 Direct React Imports
- **NEVER** import the `React` namespace (`import React from 'react'` or `import * as React from 'react'`).
- **NEVER** use `React.useState`, `React.FC`, `React.ReactNode`.
- **ALWAYS** import hooks, utilities, and types directly:
  ```typescript
  import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
  import type { ReactNode, ComponentProps } from 'react';
  ```

### 2.3 Zero-`any` & Concrete Types
- **NEVER** use `any` as a type for variables, parameters, or return types.
- Avoid generic `Record<string, unknown>` when a concrete type or `Partial<Pick<...>>` can be specified.
- Prefer string literal unions (`'active' | 'pending' | 'accepted'`) over numeric enums.

---

## 3. Function & Handler Naming Discipline

### 3.1 Event Handlers vs Prop Callbacks
- **Internal Handlers**: Prefix with `handle` (`handleRefresh`, `handleLogin`, `handleToggleFriend`, `handleConfirmCancel`).
- **Prop Callbacks**: Prefix with `on` (`onPress`, `onClose`, `onConfirm`, `onRefresh`, `onSelect`).

```typescript
// ✅ CORRECT
type ConfirmationModalProps = {
  visible: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmationModal({ visible, onConfirm, onClose }: ConfirmationModalProps) {
  const handleConfirmPress = () => {
    onConfirm();
  };

  return (
    <TouchableOpacity onPress={handleConfirmPress}>
      <Text>Confirm</Text>
    </TouchableOpacity>
  );
}
```

### 3.2 Method & Function Prefixes
- **Data Fetching / Loading**: Prefix with `fetch`, `get`, or `load` (`fetchSuggestions`, `getProfileDetails`).
- **Data Transforms / Math**: Prefix with `format`, `calculate`, or `map` (`formatTimestamp`, `calculateDistance`, `mapUserToDTO`).
- **State Predicates**: Prefix with `is`, `has`, `can`, or `should` (`isPending`, `hasMore`, `canViewPrivateContent`).
- **Global Constants**: Use `UPPER_SNAKE_CASE` (`DEFAULT_PAGE_SIZE`, `MAX_RESULTS`).

---

## 4. Descriptive Callback & Loop Variables

**Never use single-letter parameter names in callbacks, iterators, or reducers:**

```typescript
// ❌ WRONG
users.map(u => u.id);
items.reduce((s, i) => s + i.price, 0);

// ✅ CORRECT
users.map(user => user.id);
items.reduce((sum, item) => sum + item.price, 0);
```

---

## 5. Object-Oriented Service Architecture (OOP)

All business logic, API requests, caching, and data operations must be encapsulated in TypeScript service classes with static `getInstance()` singletons:

```typescript
export class ExampleDomainService {
  private static instance: ExampleDomainService;
  private readonly apiService = ApiService.getInstance();
  private readonly cacheService = LocalCacheService.getInstance();

  private constructor() {}

  public static getInstance(): ExampleDomainService {
    if (!ExampleDomainService.instance) {
      ExampleDomainService.instance = new ExampleDomainService();
    }
    return ExampleDomainService.instance;
  }

  public async fetchDomainData(id: string): Promise<DomainData> {
    // API logic, error handling, transformations
  }
}

export const exampleDomainService = ExampleDomainService.getInstance();
```

---

## 6. Automated Discipline Verification

Run the automated verification script:

```bash
cmd /c "node_modules\.bin\tsc --noEmit && node scripts/check-discipline.cjs"
```
