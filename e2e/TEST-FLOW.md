# Native Mobile E2E User Journey Maps — Ourlime Mobile

Visual Mermaid diagrams representing the exact physical user actions performed by Maestro on your connected mobile device.

---

## 1. Native Authentication & Form Validation (`01-auth-login.yaml`)

```mermaid
graph TD
    Launch["Maestro Launches com.ourlime.app"] --> Screen["Assert 'Welcome Back' Visible"]
    Screen --> Invalid["Type invalid credentials & tap Log In"]
    Invalid --> Error["Assert Error Alert Banner Appears"]
    Error --> Erase["Erase inputs & enter valid credentials"]
    Erase --> Submit["Tap Log In Button"]
    Submit --> Home["Assert 'Home Feed' Renders on Screen"]
```

---

## 2. Feed Scrolling, Filters & YouTube Player (`03-feeds` & `04-feeds`)

```mermaid
graph TD
    Home["Home Feed Active"] --> FilterSound["Tap 'Sound' Filter Chip"]
    FilterSound --> CheckSoon["Assert 'Soon' Badge & Warning Vibration"]
    CheckSoon --> FilterPhoto["Tap 'Photos' & Scroll"]
    FilterPhoto --> CreatePost["Tap 'Create a Post'"]
    CreatePost --> Input["Enter Text with YouTube Link"]
    Input --> Publish["Tap 'Post'"]
    Publish --> Embed["Assert 16:9 WebView Player & Clickable Link"]
```

---

## 3. Limes Vertical Snap Reels & Reposting (`05-limes-reels.yaml`)

```mermaid
graph TD
    Limes["Tap Limes Tab in Bottom Bar"] --> Swipe["Swipe Up (50%, 80% to 50%, 20%)"]
    Swipe --> DoubleTap["Double Tap Center to Send Heart Burst"]
    DoubleTap --> Comments["Tap Comment Icon -> Assert Comments Sheet Opens"]
    Comments --> Repost["Tap Repost -> Assert Attribution Pill Added"]
```

---

## 4. Chat Messaging & Voice Notes (`06-chat-messaging.yaml`)

```mermaid
graph TD
    ChatTab["Tap Chat Tab in Bottom Bar"] --> SelectRoom["Select Conversation with Rishi"]
    SelectRoom --> Message["Type text in Composer & Tap Send"]
    Message --> Sticker["Open Sticker Picker & Send Reaction"]
    Sticker --> HeaderCall["Assert Agora Voice & Video Call Buttons in Header"]
```

---

## 5. Navigation Drawer & Games Exclusion (`12-navigation-drawer.yaml`)

```mermaid
graph TD
    Menu["Tap Header Hamburger Icon"] --> Drawer["Assert Drawer Opens with 10 Social Surfaces"]
    Drawer --> CheckSurfaces["Assert Communities, Events, Jobs, Market, Blogs, E-Learning"]
    CheckSurfaces --> AssertNoGames["Assert 'Games' & 'Wordle' are NOT in Drawer"]
    AssertNoGames --> OpenSettings["Tap Settings & Inspect Appearance Theme Switcher"]
```
