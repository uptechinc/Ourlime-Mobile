# Test Workflow Maps — Ourlime Mobile

Visual Mermaid user journey diagrams and test workflow maps for all mobile feature suites.

---

## 1. Authentication & Role Permissions Flow (`01-auth.test.ts`)

```mermaid
graph TD
    Start["User Opens App"] --> Auth{"Authenticated?"}
    Auth -- "No" --> Login["Render /(auth)/login"]
    Login --> Submit["Submit Credentials"]
    Submit --> Success{"Role?"}
    Success -- "Admin" --> AdminView["Grant Full Access + Admin Portal"]
    Success -- "Developer" --> DevView["Grant Preview Mode"]
    Success -- "Regular User" --> FeedView["Render /(tabs) Home Feed"]
```

---

## 2. Feeds, Filters & YouTube Embed Flow (`02-feeds.test.ts`)

```mermaid
graph TD
    Feeds["Home Feed Loaded"] --> FilterTap{"User Taps Filter"}
    FilterTap -- "Photos / Videos / Polls" --> ActiveFilter["Filter Posts & Query Page"]
    FilterTap -- "Sound" --> BlockSoon["Display 'Soon' Badge & Trigger Warning Haptics"]
    Feeds --> Post["Post with YouTube URL"]
    Post --> Extract["extractYouTubeVideoId()"]
    Extract --> Embed["Render 16:9 WebView with Referer: ourlime.com"]
    Extract --> Span["Preserve Clickable Link in Text Span"]
```

---

## 3. Real-Time Dynamic Page Access Flow (`10-page-access.test.ts`)

```mermaid
graph TD
    Navigate["User Navigates to Route"] --> Resolve["pageAccessService.getDecision()"]
    Resolve --> CheckStatus{"Status in Firestore?"}
    CheckStatus -- "enabled" --> Allow["Render Page Normally"]
    CheckStatus -- "coming_soon" --> RoleCheck1{"Is Admin / Dev?"}
    RoleCheck1 -- "Yes" --> Allow
    RoleCheck1 -- "No" --> OverlaySoon["Render Coming Soon Overlay with Thinking Sticker"]
    CheckStatus -- "admin_only" --> RoleCheck2{"Is Admin?"}
    RoleCheck2 -- "Yes" --> Allow
    RoleCheck2 -- "No" --> OverlayAdmin["Render Admin Required Overlay with Detective Sticker"]
    CheckStatus -- "disabled" --> HideNav["Hide from Drawer & Block Access"]
```

---

## 4. Push Notification Registration & Lockscreen Dispatch (`12-push-delivery.test.ts`)

```mermaid
graph TD
    Launch["App Launches on Android"] --> Token["getDevicePushTokenAsync() & getToken()"]
    Token --> Format{"Token Format?"}
    Format -- "fnwjget... (FCM)" --> RegFCM["POST /api/push-tokens (transport: 'fcm')"]
    Format -- "ExponentPushToken[...]" --> RegExpo["POST /api/push-tokens (transport: 'expo')"]
    RegFCM --> DB["Save Token to Firestore pushTokens Collection"]
    
    Send["Peer Sends Message via Web"] --> Backend["pushServer.ts Routes Token"]
    Backend --> RouteFCM["admin.messaging().sendEachForMulticast()"]
    RouteFCM --> Phone["Phone Receives High-Priority Heads-Up Banner While App is Killed"]
```
