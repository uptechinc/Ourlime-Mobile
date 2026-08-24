---
name: react-native-navigation-fix
description: Standard procedure for fixing React Native / Expo safe area header rendering, status bar clipping, keyboard overlap, and back button navigation slide transitions.
---

# React Native Safe Area Header & Navigation Fix Skill

## Scope Control

Use this skill only for the requested navigation or safe-area issue and its minimum dependencies. Do not change unrelated routes, UX, native code, or builds without explicit authorization.

This skill documents the exact solution implemented for header rendering, Android status bar padding, software keyboard handling, and stack navigation transitions in React Native / Expo Router.

## Problem Pattern
1. **Header Clipped by Android Status Bar**: Using default `SafeAreaView` from `react-native` or manual `StatusBar.currentHeight` arithmetic can cause status bar overlap or push headers off-screen on notched Android screens.
2. **Header Shifted by Software Keyboard**: Wrapping the entire screen (including top header) inside `KeyboardAvoidingView` causes the header to get pushed up and hidden when an input field is focused.
3. **Missing or Broken Back Button**: Header lacks a back gesture / button, or vector icon fonts fail to render.

## Standard Fix Procedure

### 1. Safe Area Header Container
Import `SafeAreaView` from `react-native-safe-area-context` and specify explicit top/horizontal safe edges:

```tsx
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MyScreen() {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Fixed Header sits inside safe top inset */}
      <View style={styles.header}>
        {/* Back Button */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#111827' }}>‹</Text>
        </TouchableOpacity>

        {/* Header Title / Logo */}
        <View style={styles.headerCenter}>
          <Image source={require('./logo.png')} style={styles.logo} />
          <Text style={styles.title}>Ourlime</Text>
        </View>
      </View>

      {/* KeyboardAvoidingView ONLY wraps the scrollable content below header */}
      <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            {/* Form & Page Content */}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
```

### 2. Stack Layout Navigation Configuration
Configure `app/_layout.tsx` to handle stack slide transitions cleanly:

```tsx
import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    >
      <Stack.Screen name="(auth)/login" options={{ animation: 'none' }} />
      <Stack.Screen name="(auth)/register" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
```

### Key Checklist
- [x] Header pinned OUTSIDE `KeyboardAvoidingView`.
- [x] Root view uses `SafeAreaView` from `react-native-safe-area-context` with `edges={['top', 'left', 'right']}`.
- [x] Back button uses `router.back()` to trigger native stack slide-back transition.
- [x] Chevron rendered reliably (text `‹` or clean SVG).
