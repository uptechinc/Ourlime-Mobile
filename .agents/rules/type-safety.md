# Strict TypeScript & Type-Safety Rules

## 1. Zero-`any` Policy
- Never use `any` for variables, function parameters, or component props.
- Define explicit types in `types/` or `lib/types/`.

## 2. Prefer `type` Over `interface`
- Always use `type MyType = { ... }`.
- Do not use `interface`.

## 3. Direct React Hook Imports
- Never use `import React from 'react'`.
- Import React hooks directly: `import { useState, useEffect, useCallback } from 'react'`.
