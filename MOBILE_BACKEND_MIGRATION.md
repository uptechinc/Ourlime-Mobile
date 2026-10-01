# Mobile Backend Migration Tracker

**Goal (owner decision, 2026-09-28):** the Ourlime app never calls the website's API (`ourlime.com/api/...`).

- **Direct Firebase:** anything the app can do safely itself reads/writes Firestore and Storage from the app's own service classes (`lib/services/*`, `lib/blogs&articles/*`).
- **App server = Cloud Functions:** anything that needs a secret, Admin SDK powers, email, push sending, or is deliberately server-only goes into the app's own Cloud Functions (`../functions`, codebase `reliability`, `us-central1`, callables use `invoker: 'public'` and verify the caller with `actor()`).
- The website keeps its own `/api` routes. Both share the same Firestore data model, so each mobile port copies the matching website route's logic (validation, permissions, data shape).
- Security rules are intentionally **not** changed in this migration; see `../SECURITY_HANDOFF_PROMPT.md`.

Status: ✅ done in code, needs deploy. **Nothing in the app calls ourlime.com/api any more.**

## Done — direct Firebase

| Area | Website endpoints replaced | Mobile files |
|---|---|---|
| Blogs & articles | `/api/blogs&articles`, `/{id}`, `/{id}/interactions`, `/{id}/comments` | `lib/blogs&articles/BlogsAndArticlesService.ts` |
| Blog author follow | `/api/relationships/followers` | `lib/relationships/followService.ts` |
| Communities | `/api/communities` (+availability), `/fetch`, `/membership`, `/requests`, `/update-role`, `/remove-user`, `/ban-user`, `/edit`, `/delete`, `/community-like`, `/members`, `/reports`, `/dashboard`, `/polls`, `/events`, `/like`, `/posts`, `/api/admin/community-categories`, `DELETE /api/posts/{id}` (community) | `CommunityDataService` + `CommunityService`, `CommunityPollService`, `CommunityDashboardService`, `EventService`, `PostService` |
| Reports (non child-safety) | `POST /api/moderation/reports` | `ModerationService` |
| Relationships | `/api/relationships/friends`, `/status`, `/hub`, `/api/profile/blocklist` | `RelationshipDataService` + `RelationshipService`, `RelationshipResourceService`, `RelationshipRequestResourceService` |
| Presence | `/api/profile/presence` | `PresenceService` |
| User search | `/api/users/search` (indexed prefix queries + block/privacy filters) | `SearchService` |
| Other profiles | `/api/profile/viewOtherProfile` | `ProfileService` |
| Messaging | `/api/chat/friends`, `/api/messaging` (GET/POST/PATCH), `/api/messaging/actions` | `ChatDataService` + `MessagingService`, `MessageResourceService`, `SimpleChatMessageService` |
| Single post | `/api/posts/{id}` (was only a fallback) | `PostService` |
| Limes | `/api/limes/{id}` (DELETE, PATCH thumbnail), `/{id}/repost`, `/{id}/share` | `LimeService`, `LimeThumbnailService` |
| Events | `/api/events/fetch` | `EventService` |
| Jobs | `/api/jobs` (PATCH), `/api/jobs/delete`, `/api/jobs/myJobs/{applications,close,bulk,interviews,notes,audit}`, `/api/jobs/applications`, `/applications/my-applications` | `JobDataService` + `JobManagementService`, `JobApplicationService` |
| Page access (admin) | `/api/page-access` (was only a fallback) | `AdminPageAccessService` |
| Security settings (admin) | `/api/admin/security/access-controls`, `/api/security/check-access` (unused) | `AdminSecurityService` |
| Link previews | `/api/link-preview` for Ourlime links (external links were already fetched directly) | `LinkPreviewDataService` + `OpenGraphService` |
| Registration checks | `/api/beta/registration-mode`, `/api/beta/validate-token`, `/api/auth/registration-availability` | `RegistrationDataService` + `mobile/Register` |

## Done — app's own server (Cloud Functions, `../functions`, not deployed yet)

The app calls these through `AppServerService` (Firebase JS SDK callables, same sign-in as Firestore — no native-session bridge).

| Website endpoint(s) replaced | Function(s) | Mobile file(s) |
|---|---|---|
| `/api/calls`, `/{id}`, `/{id}/rtc-token` | `createCall`, `getCall`, `updateCall`, `getCallCredentials` | `CallService`, `CallContext` |
| `/api/push-tokens` | `registerNativePush` (now also iOS VoIP) | `NativeCallService`, `PushNotificationService` |
| `/api/push-messages` (+ chat message push) | `sendMessagePush` | `PushNotificationService`, `ChatDataService` |
| `/api/gifs` | `searchGifs` | `GifService` |
| `/api/triniGeoGuesser/geocode` | none — OpenStreetMap called directly (no key) | `LocationService` |
| `/api/resend-verification`, `/api/notify-guardian`, `/api/notify-admin-id` | `resendVerificationEmail`, `notifyGuardian`, `notifyAdminIdSubmitted` | `AuthService` |
| job + community emails the web sends | `sendJobStatusEmail`, `sendJobWithdrawnEmail`, `sendCommunityMemberEmail` | `JobDataService`, `CommunityDataService` |
| `/api/auth/register/start` | `startRegistration` | `AuthService` |
| `/api/auth/qr/*`, `/api/auth/sessions*` | `initQrLogin`, `getQrLoginStatus`, `scanQrLogin`, `confirmQrLogin`, `rejectQrLogin`, `registerDeviceSession`, `listDeviceSessions`, `revokeDeviceSessions` | `QRLoginService` |
| `/api/profile/delete-account` | `deleteMyAccount` (needs a sign-in from the last 5 minutes) | `AccountLifecycleService` |
| `/api/support/*`, `/api/case-attachments/*`, `/api/admin/support/tickets` | `createSupportTicket` … `getCaseAttachmentPreview`, HTTP `uploadCaseAttachment` | `SupportTicketService` |
| `/api/child-safety/*`, `/api/admin/child-safety/*` | `submitChildSafetyReport` … `setChildSafetyReviewer`, `searchChildSafetyAccounts` | `ChildSafetyReportService` |
| `/api/admin/*`, `/api/moderation/reports*`, `/api/beta/admin/*`, `/api/beta/registration-mode` (PATCH), `/api/appeals`, `/api/activity-logs/{id}/restore` | `adminApi` gateway: runs the website's own route handlers (copied to `functions/src/web/`) for an allow-listed set of paths | `AdminApiService` + `Admin*Service` |

How the code is organised in `../functions/src`: one service class per domain (`CallSessionService`, `PushDeliveryService`, `MailService`, `EmailNotificationService`, `DeviceSessionService`, `RegistrationService`, `AccountDeletionService`, …). Support/child-safety business rules are copied from the website into `cases/`; admin routes and their modules are copied into `web/` with small shims (`web/next-server.ts`, `web/lib/firebaseAdmin.ts`, `web/lib/notifications/notificationServer.ts`). Keep those copies in step when the website's versions change.

### Bugs fixed while porting

App side (the app's versions behave correctly):
- Job applications from the app never sent the applicant disclaimer, so the web rejected them.
- Job edits from the app failed on the web (`basic_info.type` written as undefined).
- Job status emails never sent on the web (it looks for an email field applications don't have); the app's function looks up the applicant's real email.
- Username "already taken" check never worked (the web route only checks emails).
- Regular notifications (friend requests, likes…) were pushed as chat messages: wrong screen, and hidden by muting that person's chat.
- QR login returned the sign-in token to anyone who knew the session id; now only with the QR secret, and only once.
- "Sign out other devices" also signed out the phone itself; it now keeps the current device signed in.
- Guardian / ID-notice emails could be sent to any address; now only to the caller's own saved addresses.
- Signed-out users could not open support tickets (the web route requires sign-in and never uses its guest flow).
- Duplicate-email sign-up showed `auth/email-already-in-use`; now a readable message.
- `firebase` is now declared in `package.json` (it only arrived as a dependency of `@react-native-firebase/app`).

Website, fixed in the website code (takes effect when the website is redeployed):
- **Account deletion wiped every user's ID documents** (deleted the whole `authentication/` storage folder). Now only `authentication/{email}/`.
- Account deletion left follower rows (matched `followingId`; the field is `followeeId`).

Website, still open (app is unaffected):
- Job delete cleanup queries `applications` instead of `jobApplications`.
- `/api/jobs/myJobs/{close,bulk,notes,audit,interviews}` do not check who is calling.
- `/api/notify-guardian`, `/api/notify-admin-id` are open email relays; `/api/resend-verification` accepts any user id.
- `/api/auth/qr/status` returns the sign-in token without the QR secret.

## Before this goes live

1. **Settings:** done. `functions/.env` (git-ignored) holds the Agora and email values copied from the website `.env`; Firebase loads it at deploy. Optional extras there: `GIPHY_API_KEY`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_AUTH_KEY`, `APNS_PRODUCTION`, `IOS_BUNDLE_IDENTIFIER`.
2. **IAM:** the functions' service account needs *Service Account Token Creator* (custom tokens for registration/QR, signed preview URLs for case attachments).
3. **Deploy** the `reliability` codebase (owner approval; show the diff first).
4. **Rebuild** the app (native call changes; `bun install` for the `firebase` dependency).

## Dead code to delete

- `lib/services/MarketService.ts` (nothing imports it) and then `lib/services/ApiService.ts` (only `MarketService` imports it).
