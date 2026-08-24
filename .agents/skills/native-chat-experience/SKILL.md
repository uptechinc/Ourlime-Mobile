---
name: native-chat-experience
description: Implement and review Ourlime Mobile chat screens with deterministic newest-message positioning, FlashList pagination, cached message hydration, realtime reconciliation, light/dark/system themes, keyboard handling, and safe areas. Use for chat scroll jumps, random entry position, message pagination, new-message behavior, composer overlap, media bubbles, or chat theme parity.
---

# Native Chat Experience

## Scope Control

Use this skill only for the user’s explicit chat request and its minimum dependencies. Report adjacent chat improvements rather than implementing them without authorization, and do not change unrelated screens or builds.

## Workflow

1. Read `references/chat-acceptance-matrix.md` before changing message rendering.
2. Keep messages chronological and use FlashList v2 `startRenderingFromBottom`.
3. Use `maintainVisibleContentPosition` when prepending older messages.
4. Load the cached latest 30 first, then reconcile network and realtime records.
5. Auto-follow only while the reader is near the latest message; otherwise show a jump-to-latest control.
6. Put the fixed header outside `KeyboardAvoidingView` and include the bottom safe-area inset in the composer.
7. Use `useAppTheme()` tokens for all text, bubbles, panels, menus, inputs, timestamps, and empty/error states.

## Prohibitions

- Do not position chats with `setTimeout`, `requestAnimationFrame`, repeated `scrollToEnd`, or content-size races.
- Do not recolor pixels inside sticker or image artwork.
- Do not download the entire message history.
- Do not replace cached messages with a full-page loading or error state during refresh.
- Do not put API, Firebase, normalization, or cache logic inside the screen.

Follow the repository OOP, zero-`any`, direct React import, typed props, and safe-area requirements.
