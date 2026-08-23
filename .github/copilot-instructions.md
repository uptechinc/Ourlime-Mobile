# Copilot Instructions — Ourlime Mobile

- Architecture: Object-Oriented Services in `lib/services/` (`Singleton.getInstance()`). UI components are pure presentation; React hooks delegate to service instances.
- TypeScript: Zero `any`. Always `type` instead of `interface`. Direct React imports (`import { useState } from 'react'`). No single-letter callback variables.
- React Native: `SafeAreaView` from `'react-native-safe-area-context'` with `edges={['top', 'left', 'right']}`. Headers outside `KeyboardAvoidingView`.
- Skills: See `.agents/skills/`, `CHATGPT.md`, and `AGENTS.md`.
