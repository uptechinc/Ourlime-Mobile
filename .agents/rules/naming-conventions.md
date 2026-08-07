# Naming Conventions

## 1. File & Directory Casing
- **Components**: `PascalCase.tsx` (e.g. `LoginScreen.tsx`, `AppHeader.tsx`).
- **Hooks**: `camelCase.ts` with `use` prefix (e.g. `useProfileStore.ts`, `useAuth.ts`).
- **Services**: `PascalCase.ts` with `Service` suffix (e.g. `ChatService.ts`, `RelationshipService.ts`).
- **Types**: `PascalCase.ts` or `camelCase.ts` inside `lib/types/` or `types/`.

## 2. Prop Types & Callbacks
- Prop types MUST match component name with `Props` suffix: `type [ComponentName]Props = { ... }`.
- Internal handlers: `handle[Action]` (e.g. `handleLogin`, `handleNextStep`).
- Prop callbacks: `on[Action]` (e.g. `onPress`, `onMenuPress`, `onBackPress`).

## 3. Constants & Variables
- Constants: `UPPER_SNAKE_CASE` (e.g. `TOTAL_STEPS`, `GREEN_THEME`).
- Variables & Functions: `camelCase` (e.g. `isSubmitting`, `validateEmail`).
