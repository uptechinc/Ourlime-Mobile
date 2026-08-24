---
name: type-safety
description: Comprehensive TypeScript type-safety rules, React direct imports, zero-any policy, and code discipline guidelines ported from Evolution One CMS.
---

# React & TypeScript Type-Safety Discipline

## Scope Control

Enforce type safety within the requested change. Do not use type cleanup as permission for unrelated refactors; report broader cleanup separately.

Use when **writing React components, hooks, service classes, and data structures** across the application.

## 1. Direct React Imports (CRITICAL)

**NEVER import the `React` namespace:**

```typescript
// ❌ WRONG
import React from 'react';
import * as React from 'react';
React.useState();
React.FC;
<React.Fragment>;

// ✅ CORRECT - Direct imports
import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react';
import type { ReactNode, ComponentProps } from 'react';
```

**Common direct imports:**
- Hooks: `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`, `useContext`, `useReducer`
- Types: `ReactNode`, `ReactElement`, `PropsWithChildren`, `ComponentProps`
- Utilities: `forwardRef`, `memo`, `createContext`, `Fragment`

---

## 2. Strict Zero-`any` & Zero-Lazy-Record Policy

### No `any` Keyword
```typescript
// ❌ WRONG
const data: any = await fetchData();

// ✅ CORRECT - Explicit types
import type { UserProfile } from '@/lib/services/AuthService';
const data: UserProfile = await fetchData();
```

### Avoid `Record<string, unknown>` when a Concrete Type or Pick/Partial Exists
Prefer specific types over generic `Record` types. Generic `Record` obscures type clarity.

```typescript
// ❌ WRONG — lazy Record type
const updateFields: Record<string, unknown> = {};

// ✅ CORRECT — specific type or Partial/Pick
type ProfileUpdateFields = Partial<
  Pick<UserProfile, 'firstName' | 'lastName' | 'bio'>
> & {
  updatedAt: number;
};
const updateFields: ProfileUpdateFields = { updatedAt: Date.now() };
```

---

## 3. Prefer `type` Over `interface`

- **ALWAYS** use `type MyType = { ... }` across the codebase.
- **NEVER** use `interface MyInterface { ... }`.

```typescript
// ❌ WRONG
interface UserCardProps {
  userId: string;
  name: string;
}

// ✅ CORRECT
type UserCardProps = {
  userId: string;
  name: string;
};
```

---

## 4. Function Overloads & Discriminated Return Types

When a service method or hook returns different resource types based on an input discriminator (e.g. `{ kind: 'own' }` vs `{ kind: 'public' }`), write explicit function overloads:

```typescript
// ✅ CORRECT - Overloads narrow return type based on kind
export function useProfileResource(identifier: { kind: 'own'; userId: string }): {
  resource: ResourceState<OwnProfileResource>;
  refresh: (force?: boolean) => Promise<void>;
};
export function useProfileResource(identifier: { kind: 'public'; viewerId: string; username: string }): {
  resource: ResourceState<PublicProfileResult>;
  refresh: (force?: boolean) => Promise<void>;
};
export function useProfileResource(identifier: ProfileResourceIdentifier) { ... }
```

---

## 5. Explicit String Literal Unions Over Numeric Enums

Prefer string literal unions over numeric enums for better readability, serializability, and mobile state logging.

```typescript
// ✅ CORRECT
type FriendshipStatus = 'none' | 'pending' | 'accepted' | 'blocked';
type AccountRole = 'regular' | 'creator' | 'admin';

// ❌ WRONG — numeric enum
enum FriendshipStatus {
  None = 0,
  Pending = 1,
  Accepted = 2,
  Blocked = 3,
}
```

---

## 6. Descriptive Variable Names (No Single-Letter Loop Variables)

**Never use single-letter parameter names in callbacks, reducers, or map functions:**

```typescript
// ❌ WRONG
const total = items.reduce((s, c) => s + c.amount, 0);
friends.map((f) => <FriendCard key={f.id} friend={f} />);

// ✅ CORRECT
const total = items.reduce((sum, item) => sum + item.amount, 0);
friends.map((friend) => <FriendCard key={friend.id} friend={friend} />);
```

---

## 7. Component Section Ordering

Components must follow a consistent section layout:

```typescript
export default function MyScreen(props: MyScreenProps) {
  // ============================================================================
  // 1. Hooks & State
  // ============================================================================
  const [items, setItems] = useState<Item[]>([]);

  // ============================================================================
  // 2. Computed Values
  // ============================================================================
  const total = useMemo(() => items.reduce((sum, item) => sum + item.price, 0), [items]);

  // ============================================================================
  // 3. Event Handlers
  // ============================================================================
  const handleSubmit = useCallback(() => { ... }, [items]);

  // ============================================================================
  // 4. Side Effects
  // ============================================================================
  useEffect(() => { ... }, []);

  // ============================================================================
  // 5. JSX Render
  // ============================================================================
  return (
    // JSX
  );
}
```

---

## 8. Command Line Type Checking

Verify full TypeScript compilation and discipline rules:

```bash
cmd /c "node_modules\.bin\tsc --noEmit && npx expo lint && node scripts/check-discipline.cjs"
```
