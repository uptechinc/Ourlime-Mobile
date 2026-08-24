# Notification routing contract

Last updated: 2026-08-23

Web persistence and push delivery, the web Notifications surfaces, mobile push presses, mobile Notifications, and in-app banners resolve through the canonical notification destination registry. Producers must send the flat, string-only `NativePushDataV1` payload with `schemaVersion: "1"`, `destinationKind`, `type`, `notificationId`, a safe path, and only relevant whitelisted IDs.

## Entity fields

Supported IDs are `senderId`, `sourceUserId`, `profileUserId`, `postId`, `rootCommentId`, `commentId`, `replyId`, `parentReplyId`, `limeId`, `reelId`, `communityId`, `requestId`, `projectId`, `taskId`, `reportId`, `eventId`, `marketplaceListingId`, `blogId`, `courseId`, `chatId`, `callId`, and `childSafetyReportId`. Concrete entity metadata takes precedence over a broad engagement type. Existing pushes with only a safe legacy `path` remain supported.

## Destination matrix

| Source | Destination |
|---|---|
| Friend request, accepted, declined, follow | Actor profile |
| Post like or repost | Referenced post |
| Post comment without an old comment ID | Referenced post with comments open |
| Post comment/reply with IDs | Referenced post, target root expanded, unrelated roots collapsed, target scrolled into view and highlighted |
| Lime engagement | Referenced Lime; comments open when relevant |
| Mention | Concrete post comment/reply, Lime, project task, marketplace listing, blog, course, or event |
| Message | Sender chat |
| Incoming live call | Global call overlay |
| Stale/incomplete call | Peer chat, then Notifications if the peer is unavailable |
| Community invite/status/role | Community details |
| Community join request/report | Matching dashboard workspace |
| Project invitation/task | E-Projects with entity parameters |
| Child Safety alert | Restricted case details |
| Removed community, cancelled event, beta member update | Notifications |
| Missing, malformed, deleted, external, or unauthorized target | Notifications with `notificationId` highlighted |

## Cold starts and deduplication

The mobile coordinator captures the response immediately, persists it for up to 24 hours when authentication or the Expo root navigator is not ready, and replays it after login. It marks the item read asynchronously. Expo response IDs and native call action pairs are deduplicated; a navigation failure replaces the current route with Notifications rather than the app root.

Answered calls navigate once to the peer chat after either side ends. Missed, declined, cancelled, failed, and unanswered calls do not force navigation.

## Android and iOS sounds

Android messages use `ourlime-messages-v3`; native calls use `ourlime-calls-v3` with ringtone audio usage, maximum Expo importance, vibration, call category, and full-screen intent where allowed. Channel properties are OS-owned and immutable after creation; users who muted a channel must restore it in Android settings.

Custom MP3s are per-device and active-app only. Background/terminated Android uses the system channel sound and iOS uses system notifications or CallKit. The app does not bypass silent mode, DND, permissions, or device volume.

## Validation

Run `bun test lib/navigation/NotificationDestinationRegistry.test.js` in mobile and `bun test lib/notifications/notificationPushDestination.test.js` in web, followed by both `bun check` commands. Device validation must cover foreground, background, terminated, signed-out, authenticating, muted chat, disabled channel, DND, active call, stale call, and answered-call end states.
