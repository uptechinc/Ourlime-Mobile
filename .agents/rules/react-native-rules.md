# React Native & Expo Rules

## 1. Safe Area & Layout Management
- **SafeAreaView**: Use `SafeAreaView` from `react-native-safe-area-context` for screens with headers. Specify explicit `edges` (e.g., `edges={['top', 'left', 'right']}`).
- **KeyboardAvoidingView**: Position top headers **outside** `KeyboardAvoidingView` so software keyboard expansion does not shift or hide fixed top navigation headers.
- **ScrollView Content**: Set `contentContainerStyle={{ flexGrow: 1 }}` and `keyboardShouldPersistTaps="handled"` on form scroll views.

## 2. Navigation & Screen Transitions
- **Expo Router**: Use `useRouter()` hook from `expo-router`.
- **Transitions**: Native slide transitions (`animation: 'slide_from_right'`, `gestureEnabled: true`).
- **Back Actions**: Use `router.back()` for dismiss/back buttons.

## 3. Styling & Color Tokens
- Use NativeWind Tailwind classes or structured `StyleSheet.create`.
- Enforce standard green theme colors:
  - Primary Green: `#01eb53`
  - Theme Dark Green: `#10b981`
  - Card Background: `#ffffff`
  - Page Background: `#f8fafc` / `#f2f2f7`
