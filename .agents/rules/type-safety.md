# Strict TypeScript & Type-Safety Rules (Evolution One CMS Standard)

## Scope Control

Enforce type safety within the requested change. Do not use type cleanup as permission for unrelated refactors; report broader cleanup separately.

## 1. Zero-`any` & Zero-Lazy-Record Policy
- **Never** use `any` for variables, function parameters, or component props.
- **Never** use `Record<string, unknown>` when a concrete type or `Partial<Pick<...>>` can be specified.
- Define explicit types in `lib/types/`, `types/`, or domain service modules.

## 2. Prefer `type` Over `interface`
- **Always** use `type MyType = { ... }`.
- **Do not** use `interface`.

## 3. Direct React Imports
- **Never** import the `React` namespace (`import React from 'react'`).
- Import React hooks and types directly: `import { useState, useEffect, useCallback, useMemo } from 'react'` and `import type { ReactNode } from 'react'`.

## 4. Discriminated Union Overloads
- When hooks or service methods accept union discriminators (e.g., `{ kind: 'own' }` vs `{ kind: 'public' }`), define explicit function overloads to return precisely typed resources without manual casting.

## 5. String Literal Unions Over Numeric Enums
- Prefer string literal unions (`'active' | 'inactive'`) over numeric enums.

## 6. Self-Descriptive Variable Names
- Do not use single-letter parameter names in array map, reduce, or filter callbacks (e.g., `friends.map(friend => ...)` instead of `f => ...`).

## 7. Verification Standard
- Every type change must be verified via: `cmd /c "node_modules\.bin\tsc --noEmit && npx expo lint && node scripts/check-discipline.cjs"`.
