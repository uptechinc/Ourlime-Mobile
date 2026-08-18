# Native Mobile E2E Testing Guide — Ourlime Mobile

Maestro-based native End-to-End (E2E) testing suite for Ourlime Mobile on physical Android devices and emulators.

---

## 🚀 Quick Start

### 1. Install Maestro CLI (One-time Setup)

On Windows (PowerShell):
```powershell
irm https://get.maestro.mobile.dev | iex
```

Or via Homebrew on macOS / Linux:
```bash
brew install mobile-dev-inc/tap/maestro
```

---

### 2. Connect Your Device & Run Tests

Ensure your phone is connected with USB Debugging enabled, or an Android emulator is running:

```bash
adb devices
```

Then run the full E2E test suite:

```bash
maestro test e2e/flows/
```

Or run an interactive Maestro Studio session with live element inspector:

```bash
maestro studio
```

---

## 💡 Available Test Flows & When to Use Them

| Command | Target Flow | Features Tested |
|---|---|---|
| `maestro test e2e/flows/01-auth-login.yaml` | Authentication & Login | Form validation, password masking, error alert banners, valid login redirect |
| `maestro test e2e/flows/03-feeds-scroll-filter.yaml` | Feeds & Filters | Feed scroll, All/Photos/Videos filters, Sound Soon badge & warning haptics |
| `maestro test e2e/flows/04-feeds-post-youtube.yaml` | Post Creation & YouTube | Post composer, YouTube URL detection, 16:9 embedded WebView player |
| `maestro test e2e/flows/05-limes-reels.yaml` | Limes Video Feed | Vertical snap pager, double-tap heart animations, repost attribution banner |
| `maestro test e2e/flows/06-chat-messaging.yaml` | Chat & Voice Notes | 1-on-1 messaging, sticker picker, voice note playback, calling action buttons |
| `maestro test e2e/flows/11-admin-page-access.yaml` | Admin Page Access | Real-time page access matrix, status toggles, blocking overlay verification |
| `maestro test e2e/flows/12-navigation-drawer.yaml` | Navigation & Drawer | Drawer explore links, standalone games exclusion, theme preferences |

---

## 📁 E2E Architecture

```text
e2e/
├── README.md                      # This guide & cheat sheet
├── TEST-FLOW.md                   # Visual Mermaid user journey diagrams
├── config/
│   └── env.yaml                   # Global test credentials & package ID (com.ourlime.app)
├── subflows/                      # Reusable modular subflows
│   ├── login.yaml                 # Automated login sequence
│   └── open-drawer.yaml           # Automated drawer navigation opener
└── flows/                         # 13 Dedicated Native E2E Test Flows
    ├── 01-auth-login.yaml
    ├── 02-auth-register.yaml
    ├── 03-feeds-scroll-filter.yaml
    ├── 04-feeds-post-youtube.yaml
    ├── 05-limes-reels.yaml
    ├── 06-chat-messaging.yaml
    ├── 07-communities.yaml
    ├── 08-events-rsvp.yaml
    ├── 09-market-jobs.yaml
    ├── 10-blogs-elearning.yaml
    ├── 11-admin-page-access.yaml
    ├── 12-navigation-drawer.yaml
    └── 13-notifications.yaml
```
