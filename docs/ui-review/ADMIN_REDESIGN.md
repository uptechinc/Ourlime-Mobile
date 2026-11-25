# Admin redesign proposal (mobile), 2026-11-24

**Status:** proposal only. No code has changed.

**Scope:** every screen under `app/admin/*` and `components/admin/*`, plus the admin-only parts of `components/support/SupportTicketConversationScreen.tsx` and `components/profile/AdminTab.tsx`.

**Goal:** clean up, not rebrand. Ourlime green stays the accent, and dark mode stays fully supported. This mirrors the intent of web `.agents/rules/admin-ui-colors.md`: soft tint, a matching border and base-tone text, no saturated fills, and no raw hex. It follows `custom-modals.md`: no native `Alert.alert`, and destructive actions go through a three-stage confirm.

**Order of work:** implementation starts only **after the admin bug sweep (Agent B) has landed**, and builds on those fixes. Bugs this audit found are listed in [Appendix A](#appendix-a-bugs-seen-during-the-audit-hand-to-the-bug-sweep) so the sweep can confirm them. The redesign does not fix them on the side.

Paths are relative to `Ourlime-Mobile/`. Line numbers are from the 2026-11-24 audit and will shift once the bug sweep lands.

---

## 0. What the audit found (summary)

| Problem | Evidence |
|---|---|
| **Heavy type everywhere** | About 200 uses of `fontWeight` 800/900 across admin. Report detail has 26, User management 18×900 and User content 13×900. Activity logs uses only 500–700, so it looks like a different app. |
| **Radius drift** | 4–9 distinct radii per file: 4, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 999. |
| **Off-grid spacing** | Values 5, 7, 9, 11, 13, 15 and 17 are mixed with 8/12/16. Content padding is 15 on some screens and 16 on others; card gap is 9 on some and 10 on others. |
| **Raw hex** | Security about 44 values plus an `isDark` hex branch. Hub about 10 in use plus 24 dead fallbacks. Activity logs 11, User management 12, `AdminTab` about 10 (always dark), Moderation 7, the analytics hero (always dark), and the `AdminWorkspaceShell` gate and grid icon. |
| **Solid filled buttons and selected chips with white text** | Hub tab bar, Seller review (every control), the AdminDialog confirm, Security, Pending approvals ("Review all", `#047857`), Sticker seed, Child-safety detail (about 20 buttons), Support staff actions (6), and selected chips in about 12 files. |
| **Touch targets under 44pt** | Chips 25–34pt nearly everywhere. Back, close and trash icons are bare or `padding:4–7` (26–37pt). Report "View Profile" about 20pt. Date chips about 25pt. Page-access checkbox about 28pt. |
| **Chip-row overload** | Testers 10 chips. Page access 8 + 7 + 7. Activity logs 6 + 7. Products 3 stacked rows (about 14 controls; stickers make it 4 rows). Bulk delete 15. Report detail 22 action chips. Only Users, Moderation reports and the Child-safety queue use `FilterBar`/`FilterSheet`. |
| **Inconsistent headers** | `AdminWorkspaceShell` (13 screens), a custom hub header, embedded sections with no header, and 4 hand-built headers in support and child-safety. None has a refresh affordance; back sizes vary. |
| **Missing or broken states** | Embedded hub sections have no pull-to-refresh. Security goes blank on load error. Users has no inline error or filtered-empty state. Child-safety queue has no empty state. Child-safety detail skeleton spins forever on error. Seller review has no loading state, and its empty copy is wrong. |
| **No confirmation on destructive actions** | Report delete (header trash), "Delete permanently", delete category, IP and whitelist removal, bulk page status, child-safety purge, support Close/Resolve, Seller reject/suspend, and one-tap status changes. |

---

## 1. System spec

All tokens live in one new file, `lib/admin/adminTokens.ts`, so every admin screen pulls from one source. It is plain TypeScript, `type` only, no `any`.

### 1.1 Spacing: `space`

| Token | Value | Use |
|---|---|---|
| `xs` | 4 | icon to label, badge padding |
| `sm` | 8 | gaps inside a row, chip gap |
| `md` | 12 | card inner gap, gap between list rows |
| `lg` | 16 | screen gutter, card padding |
| `xl` | 24 | gap between sections |
| `xxl` | 32 | empty-state padding, bottom inset above the safe area |

**Rules**
- Screen content uses `padding: lg` and `paddingBottom: xxl + insets.bottom`. This replaces 15/16/20 and `paddingBottom` 35/50/55.
- Cards use `padding: lg` and `gap: md`. List rows use `paddingVertical: md` and `paddingHorizontal: lg`, with gaps of `sm` between rows.
- Values 5, 7, 9, 11, 13, 15 and 17 are banned in admin. Use NativeWind `gap-*` or the `gap` style instead of `className="space-y-*"`, which is unreliable on RN siblings (Security, Moderation).

### 1.2 Type: `type`

| Token | Size / line height / weight | Replaces |
|---|---|---|
| `display` | 28 / 34 / 700 | stat hero numbers (30/900, 24/900) |
| `title` | 20 / 26 / 700 | screen titles (19/900, 22/700) and dialog titles (18/900) |
| `section` | 16 / 22 / 700 | card and section headings (16/800, 18/900) |
| `body` | 14 / 20 / 500 | row titles and descriptions |
| `bodyStrong` | 14 / 20 / 600 | row primary label, button text |
| `meta` | 12 / 16 / 500 | timestamps, IDs, "N of M" |
| `label` | 11 / 14 / 600, `letterSpacing 0.4`, uppercase | eyebrows, field labels, status pill text |

**Rules**
- 800 and 900 are removed from admin, with one exception: `display` may use 700 with tabular numbers.
- Nothing under 11pt. Today's 10pt status labels become `label`.
- Hand-typed uppercase strings become the `label` token with `textTransform`.

### 1.3 Radius: `radius`

| Token | Value | Use |
|---|---|---|
| `sm` | 8 | inputs inside cards, thumbnails, small badges |
| `md` | 12 | buttons, inputs, list rows, menu items |
| `lg` | 16 | cards, sheets' inner panels, dialogs |
| `pill` | 999 | chips, status pills, count badges |

Bottom sheets keep the 24 top corners from `FilterSheet`, because that is shared app chrome. Dialogs move from 22 to `lg` (16) for admin only. *(Open question 3)*

### 1.4 Tone tokens: `getAdminTone(colors, tone)`

The tones are derived from `useAppTheme().colors`, with no hex at call sites. They are dark-mode aware because `colors` already switches between light and dark.

```ts
export type AdminToneName = 'positive' | 'pending' | 'danger' | 'neutral';
export type AdminTone = {
  soft: string;    // background tint: chips, selected tabs, buttons, banners
  border: string;  // 1px border that matches soft
  text: string;    // base text and icon colour on soft
  solid: string;   // ONLY for tiny status dots, chart marks, image-overlay controls
};
export function getAdminTone(colors: AppThemeColors, tone: AdminToneName): AdminTone;
```

| Tone | soft | border | text | solid |
|---|---|---|---|---|
| positive | `successSurface` | **new** `successBorder` | `accentText` | `accent` |
| pending | `warningSurface` | **new** `warningBorder` | `warningText` | **new** `warning` |
| danger | `destructiveSurface` | **new** `destructiveBorder` | `destructiveText` | `destructive` |
| neutral | `control` | `border` | `secondaryText` | `mutedText` |

**Four new keys** go into `AppThemeColors` in `lib/contexts/ThemeContext.tsx`. This is the only file where hex is allowed.

| Key | Light | Dark |
|---|---|---|
| `successBorder` | `#a7f3d0` | `#065f46` |
| `warningBorder` | `#fde68a` | `#78350f` |
| `destructiveBorder` | `#fecaca` | `#7f1d1d` |
| `warning` | `#d97706` | `#f59e0b` |

**Usage rules** (adapted from the web rule)
- Chips, selected tabs, buttons, banners and status pills use `soft` bg, a 1px `border` and `text`. Pressed state uses `opacity 0.7` or a ripple tinted with `border`, because RN has no hover.
- **No saturated fills with white text** in admin. One narrow exception, *(open question 1)*: the single primary action on a screen may use `positive` soft with the border at 1.5px, still not a solid fill.
- Danger is reserved for destructive actions and failure states. Pending is for review, waiting, beta and incomplete states. Neutral is for everything else. Do not add an info or blue tone: today's `#3b82f6` and `#8b5cf6` metric accents become neutral.
- One semantic tone per card, plus neutral.
- Charts keep named chart constants inside the analytics component, as the web rule allows.
- Danger stays mobile **red** (`destructive*`), not web rose. *(Open question 2)*

### 1.5 Touch targets

- Every pressable is at least **44×44pt**. Icon buttons use a 44×44 box (`AdminIconButton`); never a bare icon with `padding:4–7`.
- Chips use `minHeight: 36`, plus `hitSlop` that brings the target to 44, and an 8pt gap between chips.
- Rows use `minHeight: 56`. Checkboxes sit in a 44pt box.
- Nested touchables are not allowed. Today's offenders are Game content's remove-image control and the page-access row, which has 3 targets.

### 1.6 Actions

- **One primary action per screen.** It goes in the header `primaryAction` slot, or as the sticky footer button on detail and form screens.
- **Secondary actions** go in `AdminOverflowMenu` (the "⋯" header button, or "⋯" on a row or card). This covers export, import, reset defaults, initialize, seed, "open live post" and the like.
- **Per-row actions:** at most **one** inline action (usually the tone-coded decision), plus "⋯". The whole row opens detail.
- **Destructive actions** always go through `AdminDialog` with `tone="danger"`, covering the idle, busy and success stages. Irreversible bulk or purge actions also need a typed confirmation.
- **Decision groups** (approve, reject, suspend) are tone-coded: positive, danger, pending. They are never three identical green buttons.

### 1.7 Filters (one pattern)

The layout is:

```
[ 🔍 Search…                    ] [ ⚙ Filters (2) ]
Active: [Pending ×] [Last 7 days ×]   Clear all
```

- **Search:** one field at `minHeight 44`, debounced at 300ms. It never toggles the screen-level `loading` flag; it uses an inline list spinner.
- **One "Filters" button:** `FilterBar`'s button, with a count badge. It opens `AdminFilterSheet` and holds every status, type, date, role, sort and severity group.
- **Active summary:** a removable chip for each non-default value, plus "Clear all". It is hidden when nothing is active. This replaces every horizontal chip row.
- **Segmented control** is the only exception. It is allowed for **2–3 mutually exclusive views of different content** (for example Learning review: Instructors / Courses; Game content: Locations / Words). It is not used for filters.
- Sort moves into the sheet as a single-choice group. The cycle-on-tap sort button (Collection) goes away.

---

## 2. Shared components to add (`components/admin/`)

All of these use `type` props, take named exports or default export per file, import hooks directly, and read colours only through `useAppTheme()` and `getAdminTone()`.

### 2.1 `AdminScreen`, the evolution of `AdminWorkspaceShell`

```ts
type AdminScreenState =
  | { kind: 'ready' }
  | { kind: 'loading' }                                   // first load only → skeleton
  | { kind: 'error'; message: string }                    // full-body error + Retry
  | { kind: 'empty'; title: string; description?: string; icon?: AdminIconName };

type AdminHeaderAction = {
  key: string;
  label: string;              // also the accessibilityLabel
  icon: AdminIconName;
  tone?: AdminToneName;       // default 'positive' for the primary action
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
};

type AdminScreenProps = {
  title: string;
  subtitle?: string;
  eyebrow?: { label: string; tone: AdminToneName }; // e.g. "Restricted workspace" (child safety)
  state: AdminScreenState;
  onRefresh?: () => Promise<void> | void;  // enables pull-to-refresh plus overflow "Refresh"
  refreshing?: boolean;
  primaryAction?: AdminHeaderAction;        // max one
  overflowActions?: AdminOverflowItem[];    // rendered via AdminOverflowMenu
  toolbar?: ReactNode;                      // AdminToolbar; stays mounted during list reloads
  footer?: ReactNode;                       // sticky footer (detail/form screens)
  scroll?: 'scroll' | 'none';               // 'none' when the child is a FlatList/FlashList
  gate?: 'admin' | 'staff' | 'none';        // default 'admin'; 'staff' for support/child-safety (open question 5)
  backFallback?: Href;                      // default '/admin'; used when !router.canGoBack()
  showHubShortcut?: boolean;                // the grid → /admin icon; default true except on the hub
  keyboardAware?: boolean;                  // wraps the body in KeyboardSafeView, keyboardShouldPersistTaps
  children: ReactNode;
};
```

**Behaviour changes from today's shell**
- The back button always uses the `canGoBack` fallback. Today only the lock screen does; the shell header and the hub call `router.back()` directly.
- The back and hub buttons become 44pt `AdminIconButton`s. The raw `#10b981` grid icon becomes `colors.accent`, and the lock screen's `#c64d53` becomes danger tone.
- **The `toolbar` and segmented views stay mounted** while a list reloads. The skeleton replaces only the list body. This fixes the Activity-logs search unmount and the Couriers tab row disappearing.
- `state.kind === 'empty'` renders `AdminState` inside the scroll view, so pull-to-refresh still works on empty screens.
- Header title uses `type.title` (20/700) and subtitle uses `type.meta`. The header is 56pt high plus the safe area.

`AdminWorkspaceShell` becomes a thin wrapper around `AdminScreen` until all callers have migrated, then it is deleted.

### 2.2 `AdminToolbar`

```ts
type AdminToolbarProps = {
  search?: { value: string; placeholder: string; onChange: (next: string) => void; debounceMs?: number };
  filters?: { groups: AnyFilterGroup[]; values: FilterValues; onApply: (next: FilterValues) => void; title?: string };
  segments?: { value: string; options: { value: string; label: string; count?: number }[]; onChange: (v: string) => void }; // 2–3 only
  resultSummary?: string;        // "24 of 180 records"
  trailing?: ReactNode;          // rare; prefer overflow
};
```

It renders, in order: segments, then search plus the Filters button, then the active-filter summary (removable chips plus "Clear all"), then the result summary.

**`FilterBar` change:** it needs a small generalisation to accept `AnyFilterGroup` (multi-select) and a "Clear all" link. Today it takes `FilterGroup[]` only.

### 2.3 `AdminFilterSheet`, built on `components/ui/FilterSheet`

```ts
type AdminFilterSheetProps = {
  visible: boolean;
  title?: string;                        // default "Filters"
  groups: AnyFilterGroup[];
  dateRange?: { value: AdminDateRange; onChange: (r: AdminDateRange) => void }; // absorbs MobileAdminDateFilter
  onApply: (values: FilterValues) => void;
  onClose: () => void;
};
type AdminDateRange = { preset: 'today' | '7d' | '30d' | '90d' | 'all' } | { preset: 'custom'; from: Date; to: Date };
```

- **Option chips:** soft-tone selected state (`positive.soft` / `border` / `text`), replacing `selectedControl` plus white text, at `minHeight 40`.
- **Apply button:** the sheet's one primary action, `positive` soft with a strong border.
- **Change to `FilterSheet`:** add an optional `variant: 'default' | 'admin'` prop so member-facing screens are not affected.
- **Custom dates:** a custom date range follows the app date-picker rule (web rule `date-picker.md`). *(Open question 7)*

### 2.4 `AdminListRow`

```ts
type AdminListRowProps = {
  title: string;
  subtitle?: string;
  meta?: string;                         // timestamp, ID, counts
  leading?: { kind: 'avatar'; uri?: string; name: string } | { kind: 'thumb'; uri?: string } | { kind: 'icon'; name: AdminIconName; tone?: AdminToneName };
  status?: { label: string; tone: AdminToneName };   // AdminStatusPill
  inlineAction?: AdminHeaderAction;      // max one, tone-coded
  overflowActions?: AdminOverflowItem[]; // "⋯" (44pt)
  selectable?: { selected: boolean; onToggle: () => void }; // 44pt checkbox box (page access bulk)
  onPress?: () => void;                  // whole-row press → detail
  accessibilityHint?: string;
};
```

- `minHeight 56`, `padding md / lg`, `radius.md`, a surface background and a 1px `border`.
- There is no nested touchable. When the row is pressable, the inline action and "⋯" stop propagation using sibling layout, not nesting.

**Also new: `AdminStatusPill`.** It is a `label`-type pill using `getAdminTone`. It replaces 10pt/900 uppercase status text and fixes the Testers screen showing `successText` for every status.

### 2.5 `AdminStatCard`

```ts
type AdminStatCardProps = {
  label: string;
  value: string | number;
  hint?: string;                    // "+12 this week"
  icon?: AdminIconName;
  tone?: AdminToneName;             // default neutral; pending for "needs review" counts
  onPress?: () => void;             // deep-links into the filtered list
  loading?: boolean;                // inline shimmer, not a full skeleton
};
```

- Lay these out in a two-column grid with `gap: md`.
- The value uses `display`, or `title` when space is tight. The label uses `label`.
- No dark hero card. The analytics "total" becomes a full-width `AdminStatCard` in neutral tone.

### 2.6 `AdminOverflowMenu`

```ts
type AdminOverflowItem = {
  key: string;
  label: string;
  icon?: AdminIconName;
  tone?: 'neutral' | 'danger';       // danger items listed last, separated by a divider
  onPress: () => void;
  disabled?: boolean;
  description?: string;              // one meta line, e.g. "Writes to all 40 pages"
};
type AdminOverflowMenuProps = {
  items: AdminOverflowItem[];
  trigger?: 'header' | 'row';        // 44pt "⋯" either way
  title?: string;                    // sheet title
};
```

- It is a bottom sheet built on `ModalBackdrop`, `ModalMotionSurface` and `SwipeDismissSurface`, like `FilterSheet`, not a popover. Rows are 52pt.
- Danger items open `AdminDialog`; they never run directly.

### 2.7 `AdminState` (empty, loading, error)

```ts
type AdminStateProps =
  | { kind: 'loading'; variant?: 'list' | 'cards' | 'detail'; rows?: number }   // wraps AdminSkeletons
  | { kind: 'empty'; title: string; description?: string; icon?: AdminIconName; action?: AdminHeaderAction; filtered?: boolean }
  | { kind: 'error'; title?: string; message: string; onRetry: () => void; retrying?: boolean }
  | { kind: 'inlineError'; message: string; onRetry?: () => void };           // banner above a list
```

- `filtered: true` changes the copy to "No results match these filters", with a "Clear filters" action. This fixes "No activity logs recorded yet" showing when the filters are the cause, and Seller review's wrong "submitted" copy.
- Error is danger tone, soft and bordered, with Retry as a neutral bordered button. This replaces unstyled strips, `null` returns and modal-only errors.
- Transient success feedback moves to `AppToastHost`, not a blocking `CustomModal`. Today Jobs approve, Collection status changes and Game content saves all show a modal.

### 2.8 `AdminSection`

```ts
type AdminSectionProps = {
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };   // text link, 44pt, right-aligned ("See all")
  tone?: AdminToneName;              // only for warning/restricted sections; default neutral
  collapsible?: { initiallyOpen: boolean };          // long detail screens
  children: ReactNode;
};
```

- A card on `surface` with a 1px `border`, `radius.lg` and `padding lg`. The title uses the `section` type token.

### 2.9 `AdminButton` and `AdminIconButton` (small primitives that the others use)

```ts
type AdminButtonProps = {
  label: string;
  onPress: () => void;
  tone?: AdminToneName;              // soft bg + border + text; never solid
  emphasis?: 'primary' | 'secondary' | 'ghost'; // primary = 1.5px border + bodyStrong; ghost = text only
  icon?: AdminIconName;
  busy?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
};
type AdminIconButtonProps = { icon: AdminIconName; label: string; onPress: () => void; tone?: AdminToneName; size?: 44 };
```

- They replace `MarketButton` inside Seller review, the private `SmallAction` and `ActionButton` helpers, the Jobs `ActionChip`, and similar one-offs.
- `AdminIconName` is a union of the Feather and lucide icons in use. *(Open question 8: pick one icon set. Admin currently mixes Feather and lucide.)*

### 2.10 `AdminDialog` restyle (same API plus additions)

| Today | After |
|---|---|
| Confirm is a solid fill: `destructive`, raw `#d97706` or raw `#10b981`, with `#ffffff` text and spinner | Confirm uses `AdminButton emphasis="primary" tone={tone}`, with a soft bg, a 1.5px tone border and tone text. The spinner uses `tone.text`. |
| Radius 22, padding 20, title 18/900 | Radius `lg` (16), padding `xl` (24), title `type.title`, description `type.body` in `secondaryText` |
| No icon | Optional tone icon badge: 48pt `soft` circle with a `border` ring (custom-modals idle stage) |
| Footer scrolls with the body | Fixed footer, with the body scrolling (`flexShrink` ScrollView). This matches the web rule for long modals. |
| No success stage | New optional `stage: 'idle' \| 'busy' \| 'success'` and `successTitle` / `successMessage`. The success stage shows a positive check badge and one "Done" button, which completes the custom-modals three-stage flow. |
| No typed confirmation | New optional `requireText?: string`, for example "DELETE". It is used by bulk delete, purge and reset defaults. |
| Cancel button `paddingVertical 11` (about 42pt) | Both buttons `minHeight 44` and `flex: 1`, Cancel neutral |

`CustomModal` stays as the app-wide modal. Admin stops using it for feedback (toasts) and for confirmations (`AdminDialog`).

---

## 3. Per-screen plan (before → after)

**Key:**
- **P** = primary action
- **O** = overflow
- **Sheet** = moves into `AdminFilterSheet`
- **Row** = the one inline row action

### 3.1 Overview and analytics

#### Admin hub, `app/admin/index.tsx`

**Problems**
- Custom header with a 32pt back button and no `canGoBack` fallback.
- A 6-tab `flex:1` switcher (about 60pt per tab, labels 11/800, about 35pt tall). The selected tab is solid `#10b981` with white text.
- Overview padding is 20 where everything else uses 16.
- About 10 raw hex values in use, including `#3b82f6` and `#8b5cf6` metric accents.
- 16 workspace rows, each with a "LIVE" badge that adds no information.
- No pull-to-refresh on Overview, and none in the embedded sections.
- The skeleton has 13 rows while the real list has 16.

**After**
- `AdminScreen` with title "Admin" and no hub shortcut.
- Drop the 6-tab bar. Overview becomes the hub page. Users, Moderation, Page access, Security and Seller review become their own routes (`/admin/user-management`, `/admin/moderation`, `/admin/page-access`, `/admin/security`, `/admin/seller-review`). Most of those routes already exist and currently just redirect back into the hub, so they become real screens and the `?section=` deep links keep working through a redirect. *(Open question 4)*
- Layout from top to bottom:
  1. A "Needs attention" `AdminSection` with pending-tone `AdminStatCard`s for pending approvals, open reports, child-safety cases and support tickets. Each card deep-links into the filtered list.
  2. Metrics: a two-column grid of neutral `AdminStatCard`s.
  3. Workspaces: `AdminListRow`s grouped into `AdminSection`s (People, Content, Commerce, Safety and support, System) instead of one list of 16. Drop "LIVE" and show a pending-tone badge only for beta or restricted entries.

**Actions**
- **P:** none. The hub is for navigation.
- **O:** Refresh, Activity logs, Seed stickers. Seed stickers is a dev tool and should not be a top-level row.

**States:** skeleton that matches the new sections, full error with Retry, the access gate, and pull-to-refresh.

#### Analytics, `AdminAnalyticsWorkspace.tsx`

**Problems**
- Always-dark hero card with 4 raw hex values.
- A horizontal row of 7 domain chips, about 32pt tall.
- Odd spacing values: 17, 15, 13, 9.
- No empty state for a domain with no metrics.

**After**
- `AdminToolbar` segments are not suitable for 7 options, so the domain becomes a **single-choice group in the sheet**. The active domain shows in the summary.
- A full-width total `AdminStatCard`, then a two-column grid.
- The warning box becomes a pending-tone `AdminSection`.
- Empty state: `AdminState empty` with copy along the lines of "No data for {domain} yet".

**Actions:** P none. O: Refresh, Export (if added later).

#### `components/profile/AdminTab.tsx`

**Problems**
- Ignores the theme and is always dark, with about 10 hex values.
- Missing the Security entry.
- Written as one unformatted line.

**After**
- An `AdminSection` plus 5–6 `AdminListRow`s using theme tokens. Add Security.
- It mirrors the hub's "Needs attention" counts if they are cheap to load. Otherwise it is links only.

### 3.2 Users, testers, security, page access, activity logs

#### Users, `UserManagementSection.tsx`

**Problems**
- Spacing uses 7 through 20.
- 18×900 and 8×800 weights.
- About 12 hex values, including solid Export, Verify email, Approve, Archive and Delete buttons with white text.
- The close X is a bare 24pt icon. Pagination buttons are about 40pt. Detail tab pills are about 31pt.
- No refresh at all, no inline load error and no filtered-empty state.
- The "Manage user" modal has a row of 6 pills.

**Already good:** FilterBar and FilterSheet (status, role, account) and single-action rows.

**After**
- **List:** an `AdminScreen` with the toolbar (search plus Filters). Export and Import move out of the toolbar into **O**. Rows are `AdminListRow` with an avatar, a status pill and no inline action. "Load more" or infinite scroll replaces the chevron pager. *(Open question 6)*
- **Manage user:** becomes a detail screen, `/admin/user-management/[uid]`, or keeps the full-screen modal, with:
  - a header (avatar, name, status pill);
  - `AdminSection`s for Overview, Content, Role, Status, Verification and Lifecycle as collapsible sections, instead of 6 pills;
  - role and status as single-choice lists with a radio and a 44pt row, saved with one footer **P** "Save changes";
  - Archive, Restore and Delete in **O**, using danger or pending `AdminDialog`s.

**States:** pull-to-refresh, `inlineError` with Retry, and a filtered-empty state.

#### Testers, `AdminTestersWorkspace.tsx`

**Problems**
- A 10-chip tab row (about 32pt).
- A 3-way registration-mode segment (about 31pt) that applies immediately with no confirmation.
- A solid accent invite button.
- Status text is always `successText`, even for rejected or revoked testers.
- Dialog close X controls have no padding.
- Radii of 12 through 22.

**After**
- **P:** "Invite tester" in the header.
- An "Registration mode" `AdminSection` at the top. It shows the current mode as a status pill and a "Change" link that opens an `AdminDialog` (pending tone) with a radio list.
- **Toolbar:** search plus Filters. The 10 statuses move into the **sheet**.
- Rows show a tone-correct `AdminStatusPill`.
- The detail dialog's 3 status buttons become tone-coded `AdminButton`s.

**O:** Refresh.

#### Security, `AdminSecurityWorkspace.tsx`

This screen has the most raw hex in the admin area.

**Problems**
- About 44 hex values plus an `isDark` branch.
- `space-y-4` className gaps that may not apply.
- A 6-tab emoji row.
- Undersized controls: 8 to 9 country chips at about 30pt, trash and remove icons of 14–18px with no padding, and a refresh icon with `padding:6`.
- The primary colour switches between `colors.accent` and literal `#10b981`.
- Goes blank on a load error.
- No unsaved-changes cue across tabs.
- IP and whitelist removal has no confirmation.

**After**
- Its own route. An `AdminScreen` with a **segmented control replaced by a list of 6 sub-pages**: Region, IP rules, Whitelist, Rate limits, Simulator, Monitoring. Each is an `AdminListRow` with a status summary (for example "Blocking 3 countries"). They are pushed screens or a stacked accordion. *(Open question 4: sub-routes are preferred.)*
- **Region:** radio rows (44pt), plus the active countries as a removable chip summary and an "Add country" picker sheet. The presets go inside the picker. **P** "Save region" is a sticky footer that is enabled only when the form is dirty, with a pending-tone "Unsaved changes" banner.
- **IP rules and whitelist:** **P** "Add rule" opens a dialog form. Rows have "⋯" for Remove, which goes through a danger dialog.
- **Rate limits:** a form with a sticky **P** Save.
- **Simulator:** an IP field, a country picker and **P** "Evaluate". The result is a tone card.
- **Monitoring:** `AdminStatCard`s and `AdminListRow`s, with pull-to-refresh replacing the 6pt refresh icon.

**States:** full error with Retry, not `null`.

#### Page access, `PageAccessAdminSection.tsx`

**Problems**
- A header card containing 2 tabs, search and an 8-chip status row.
- Initialize Defaults and Reset Defaults, a destructive action, shown prominently at the top.
- A bulk bar with 7 chips.
- Each row has 3 targets: a 28pt checkbox, the body, and a 10pt status text.
- The editor modal puts its X on the left and has a 7-chip status row plus 7 inputs.
- Two different "selected" styles in one card.
- The only refresh is a link at the bottom.

**After**
- **Segments:** Pages / Activity log (2 options, allowed).
- **Toolbar:** search plus Filters, with status moving into the **sheet**.
- **Rows:** `AdminListRow` with `selectable` (a 44pt checkbox box), a status pill, and the row press opening the editor. The separate status tap target goes away.
- **Selection mode:** a sticky footer, "{n} selected · Change status", that opens a sheet with a radio list and then a pending `AdminDialog` showing a confirmation summary.
- **O:** Initialize defaults, Reset defaults (danger, typed "RESET" confirmation), Refresh.
- **Editor:** X on the right, matching Users. Status becomes a radio list. Toggles and inputs sit in `AdminSection`s. **P** Save is a sticky footer.
- Pull-to-refresh.

#### Activity logs, `AdminActivityLogsWorkspace.tsx`, `MobileAdminDateFilter`, `MobileAdminExportModal`

**Problems**
- Native `Alert.alert` at :140, :152 and :155.
- Search reloads the whole body on every keystroke (a bug; see Appendix A).
- 6 date chips at about 25pt plus 7 action chips at about 28pt, so 13 chips above the list.
- 11 hex values, plus hex+alpha string concatenation.
- Restore and Inspect buttons at about 28pt.
- The diff modal close X has no padding.
- Export fails silently or closes without feedback.
- The empty copy ignores the filters.
- Weights (500–700) don't match the rest of admin, though this is the closest to the target spec already.

**After**
- **Toolbar:** a debounced search plus Filters. The **sheet** holds Action type (multi-select) and Date range (presets plus custom). `MobileAdminDateFilter` is retired into `AdminFilterSheet.dateRange`.
- **Rows:** an action-type status pill (tone by action: delete and ban are danger, approve is positive, others neutral), the actor, a meta line, and one **Row** "Inspect" action. "Restore" moves to **"⋯"** behind a pending `AdminDialog`.
- **O:** Export. The export modal is restyled as an `AdminOverflowMenu`-style sheet with 3 rows. It disables options when there are 0 rows (with a message), and reports success with a toast or an error with an `inlineError`.

### 3.3 Content and moderation

#### Products, communities, stickers, `AdminCollectionWorkspace.tsx` and `app/admin/stickers/index.tsx`

**Problems**
- Up to 3 stacked chip rows (price or privacy chips, then 7 status chips), and 4 rows for stickers with the Packs/Stickers tabs.
- Status chips about 30pt.
- A cycle-on-tap sort button with no visible option list.
- The modal close is a bare 24pt icon.
- The modal stacks 6 status buttons plus a solid red "Delete permanently" **with no confirmation**.
- One-tap status changes.
- Success feedback is a blocking modal.

**After**
- **Stickers:** Packs / Stickers become `AdminToolbar` segments (soft tone instead of solid accent).
- **Toolbar:** search plus Filters. The **sheet** holds Status (multi), Price (products), Privacy (communities) and Sort.
- Two neutral `AdminStatCard`s stay for products and communities, and are tappable to filter.
- Rows show a thumbnail, title, subtitle and status pill. The row opens detail.
- **Detail:** a header with a thumbnail and status pill, then a Details `AdminSection`, then an Edit form (stickers), then a Decision `AdminSection` with a radio list of statuses, a reason field (required for reject and disable) and **P** "Apply" in a sticky footer. A pending or danger `AdminDialog` appears when the target status is reject or disable.
- **O:** "Delete permanently" behind a danger dialog with typed "DELETE".
- Feedback through toasts.

#### Categories, `AdminCategoryWorkspace.tsx`

**Problems**
- A 46-wide "+" button with no accessibility label.
- Bare 22pt dialog X.
- Delete **with no confirmation**.
- Off-grid spacing: 9, 15, 17.

**After**
- **P** "New category" in the header.
- Search in the toolbar, no filters.
- Rows with an icon, name and description, plus "⋯" for Edit and Delete.
- The edit form is an `AdminDialog` with Save as primary.
- Delete becomes a separate danger `AdminDialog` that says how many items use the category, if that count is available.

#### Moderation, `ModerationSection.tsx`, `AdminDeletedContentPanel`, `AdminBulkDeletionPanel`

**Problems**
- 4 equal-width segments with counts at 12pt, likely to truncate, about 33pt tall.
- 7 hex values, including a solid `#10b981` "Approve & Restore" button and `isDark` grey ternaries.
- Appeal buttons about 25–28pt at 11pt text.
- Refresh is a bare 17pt icon inside the search field.
- Load errors are swallowed.
- Deleted panel: an 8-chip type row, plus Restore and Ban at about 32pt.
- Bulk panel: 15 chips in one card. Success and error share one neutral box.

**After**
- Its own route. Top-level **segments** for Reports / Appeals / Deleted, with counts shown as small badges and an ellipsis-safe layout.
- "Bulk delete" moves out of the segments into **O**, opening a dedicated screen.
- **Reports:** keeps its FilterBar and FilterSheet (status, severity), which already match the pattern. Rows get a severity pill and the reason, and the row opens `reports/[reportId]`. Refresh moves to pull-to-refresh, and the in-field icon goes away.
- **Appeals:** an `AdminListRow` plus an expandable appeal text. Decisions: **Row** "Approve & restore" (positive), with "Reject" in "⋯" behind a danger dialog. Add a loading state.
- **Deleted:** search plus Filters, with Type moving into the **sheet**. **Row** "Restore" (positive), with "Ban author" in "⋯" behind a danger dialog.
- **Bulk delete screen:**
  - step 1: type (a single-select sheet group);
  - step 2: IDs;
  - step 3: reason (a radio list plus custom);
  - **P** "Delete N items", danger, behind an `AdminDialog` with `requireText="DELETE"`.
  - Errors use danger tone `inlineError`, separate from the success toast.
- `inlineError` replaces the swallowed `.catch(() => [])`, which is a bug-sweep item.

#### Report detail, `app/admin/reports/[reportId]/index.tsx` (1599 lines)

**Problems**
- The header trash deletes the report **immediately, with no confirmation**.
- 22 same-shaped action chips at about 31pt (resolution 3, content 6, account 10, escalation 3), with sanctions styled the same as "Resolve".
- About 30 actions on one scroll.
- "View Profile" buttons about 20pt.
- 26 heavy weights, 9 radii, uppercase 10/900 labels.
- The Apply button has no disabled styling.
- No pull-to-refresh.

**After**
- An `AdminScreen` with title "Report", the status pill in the subtitle, and **O**: Delete report (danger dialog), Copy IDs, Open live post, View comments.
- Body sections:
  - **Reported content:** a collapsible `AdminSection` with the author `AdminListRow` (whose row press goes to the profile, removing the small button), the content, media and stats.
  - **Report:** the reason, severity pill, description, and reporter and reported-user `AdminListRow`s.
  - **Evidence.**
  - **History**, if available.
- **Sticky footer P "Take action"** opens a two-step sheet:
  - Step 1 groups four categories (Resolve, Content, Account, Escalate) as `AdminListRow`s with a count.
  - Step 2 lists the actions in that group as radio rows. Account sanctions are danger-toned.
  - Then the existing action modal (reason and duration) restyled as an `AdminDialog`, with Apply disabled until it is valid.
- A **secondary footer button "Resolve, no action"** (neutral), because it is the most common outcome. *(Open question 9)*
- Pull-to-refresh.

#### User content, `AdminUserContentWorkspace.tsx`

**Problems**
- The heaviest type in this group: 13×900 weights.
- 8 radii, 5 hex values.
- "Try again" and "Retry email" are text-only links.
- Card buttons about 38pt; refresh is 38×38.
- No pull-to-refresh.

**Already good:** the states are the most complete in admin.

**After**
- The 3 filter pills become segments if they are mutually exclusive views; otherwise they go into the **sheet**.
- Cards keep the media strip (a horizontal row of 120pt thumbs with `radius.sm`), a status pill, the title and ID.
- **Row** action: "Restore" (positive) or "Delete" (danger, with a dialog), with View in "⋯" or on card press.
- Retry links become `AdminButton ghost` at 44pt.
- Pull-to-refresh, plus the refresh button removed when it is embedded.

#### Sticker seed, `AdminStickerSeedWorkspace.tsx`

**Problems**
- A solid `#10b981` button with `#ffffff` text.
- Pull-to-refresh only clears the status text.
- Errors shown as neutral "Error:" text.

**After**
- Reachable only from hub **O**.
- An `AdminSection` with a description and **P** "Run seed". The confirmation `AdminDialog` is pending tone, with a success stage.
- The status becomes a positive or danger banner.
- `onRefresh` is removed, so there is no fake pull-to-refresh.

### 3.4 Commerce and review queues

#### Jobs, `AdminJobsWorkspace.tsx`

**Problems**
- A 7-chip status row about 32pt tall.
- **Up to 5 action chips per card** at about 30pt (View, Approve, Reject, Remove, Suspend), which comes to about 100 small buttons per page.
- 13 heavy weights and 6 radii.
- Every approve opens a blocking CustomModal.
- Reject allows an empty reason.
- Pagination chevrons about 34pt.

**After**
- **Toolbar:** search plus Filters, with Status (and sort) in the **sheet**.
- The 2×2 stat grid stays as `AdminStatCard`s and is tappable to filter.
- **Rows:** title, company, status pill. **Row** action "Approve" (positive) appears only when the job is pending. "⋯" holds Reject, Remove and Suspend, each going to its dialog, with the reason required for all three. Row press goes to details.
- Approve shows a toast, not a modal.
- Suspend-day chips become a radio list in the dialog.
- Load more replaces the chevrons.

#### Couriers, `AdminCouriersWorkspace.tsx`, and Pet adoption, `AdminPetsWorkspace.tsx`

**Problems**
- The decline reason input is always visible on every card, which makes cards very long.
- The styles are copy-pasted between the two files.
- Couriers has 5 tabs at 36pt with no counts, and the tab row vanishes on each switch (a bug).
- Pets: the name link is about 24pt, and there are no filters.
- Both have plain-text empty states.

**After**
- Both use the same shared `AdminReviewCard`, an `AdminListRow` variant with a media strip and a details list.
- **Couriers:** status moves into the **sheet**, and the summary shows "Pending · 4". Pets gains the same status filter if the service supports it.
- **Decisions:** **Row** "Approve" (positive), with "Decline" and "Suspend" in "⋯" opening an `AdminDialog` that has a required reason field. That removes the inline input.
- Card press opens detail (the pet profile or the courier details).
- `AdminState empty` with an icon.

#### Seller review, `SellerReviewSection.tsx`

This is the worst screen in the commerce group.

**Problems**
- Every control is an identical solid green `MarketButton`: 5 filter buttons, Refresh, each application, file links, and Approve/Reject/Suspend.
- The selected filter is shown only by a "Selected:" text prefix.
- Raw enum labels.
- No loading state, and the empty copy is wrong.
- No shell and no pull-to-refresh.
- Applicant details are a `\n`-joined text block.
- An unformatted `decidedAt`.

**After**
- Its own route, `/admin/seller-review`, using `AdminScreen`.
- **Queue:** Filters with a Status group (humanised labels) in the **sheet**, the summary showing the active status, and `AdminListRow`s (business name, applicant, submitted date, status pill). Load more.
- **Detail:**
  - An Applicant `AdminSection` as a label/value list.
  - A Documents section, with `AdminListRow`s of the file icon and "Open".
  - A Decision section with tone-coded decisions: **P** "Approve" (positive, sticky footer), with "Request changes" (pending) and Reject and Suspend (danger) in "⋯" or as secondary footer buttons. Every decision goes through an `AdminDialog` with a reason.
  - History as `AdminListRow`s with formatted dates.
- States: skeleton, a filtered-empty state with the correct copy, and pull-to-refresh.

#### Pending approvals, `AdminPendingApprovalsWorkspace.tsx`

**Problems**
- A 7-chip section row at 36pt plus a "Hide empty" switch.
- A `FILLED_BUTTON='#047857'` solid "Review all" button.
- A solid count badge, plus the switch colour `#10b981`.

**Already good:** the empty state and the per-queue errors.

**After**
- The **sheet** holds Section (multi-select) and "Hide empty" as a toggle group.
- Each queue is an `AdminSection` with the title, a pending-tone count pill and the first 3 items as `AdminListRow`s. The section's `action` link is "Review all (n)", which replaces the solid button.
- The summary card becomes an `AdminStatCard` in pending tone.

#### E-Learning review, `AdminLearningReviewWorkspace.tsx`

**Problems**
- Tabs, document buttons and the outline toggle are 40pt.
- The success notice never clears.
- 7×800 weights.

This screen is already fairly close to the target.

**After**
- Instructors / Courses become **segments** with counts, at 44pt.
- Cards:
  - Instructor: an `AdminListRow` header with Documents as rows.
  - Course: the cover plus a collapsible "Modules" `AdminSection`.
- Decision: **Row** "Approve" (positive), with "Decline" behind a danger dialog that has a reason field and counter.
- The notice becomes a toast.

#### Game content, `AdminGameContentWorkspace.tsx`

**Problems**
- A long add form and a 300px map sit **above** the list.
- Trash icons are about 28pt.
- The remove-image control is about 25pt and is nested inside another touchable.
- A redundant refresh button.
- 8 radii.
- Every save or delete shows a blocking CustomModal.
- No keyboard avoidance.

**After**
- Locations / Words become **segments**.
- The list comes first: search, then rows with "⋯" for Edit and Delete (Delete goes through a danger dialog).
- **P** "Add location" or "Add word" in the header opens a **form screen or full sheet** with `keyboardAware`, sections (Details, Image, Map) and a sticky Save.
- The duplicate refresh button goes away, replaced by pull-to-refresh.
- Toast feedback.

### 3.5 Support and child safety

These screens are also used by staff routes (`app/help/tickets/staff/*` and `app/help/child-safety/review/*`). The member ticket view (`app/help/tickets/[ticketId].tsx`) renders the same conversation component without `staffMode`. **Every staff-only change must stay behind `staffMode`, and the member view must be regression-tested.**

#### Support queue, `app/admin/support/index.tsx`

**Problems**
- A hand-built header whose back control is about 26pt.
- A 6-chip status row at about 33pt with a solid selected chip.
- 5×900 weights, a 10pt status label, and odd spacing (7, 9, 15).
- An unstyled error strip.
- No pagination and no search.

**After**
- `AdminScreen` with `gate="staff"`.
- **Toolbar:** search (reference or subject) plus Filters, with Status, Category and Assignee in the **sheet**. This copies the child-safety queue.
- Rows show the reference and subject, the requester · category meta, and status and assignment pills.
- `AdminState` handles empty, error and loading. Load more.

#### Support ticket, `SupportTicketConversationScreen.tsx` (staff mode)

**Problems**
- About 11 staff controls stacked under the chat: a reason input, 6 identical solid accent `SmallAction` buttons at about 33pt, a raw staff UID field plus Transfer, and the composer. They squeeze the message list.
- 5 `Alert.alert` calls.
- Close and Resolve have no confirmation.
- The status shows "undefined" while loading.
- "Load older" is about 32pt.

**After (staff mode only)**
- The header gets a status pill and **O**: Claim or Release, Add internal note, Transfer…, Resolve…, Close…
- An assignment strip ("Assigned to you" / "Unassigned · Claim") with one inline **P** that depends on context: Claim when unassigned, Resolve when it is yours.
- The action panel goes away, leaving the composer, so the chat gets its height back.
- Resolve and Close open `AdminDialog`s (positive or danger) with a reason.
- Transfer opens a **staff picker sheet** instead of a raw UID field. *(Open question 10)*
- "Load older" becomes a 44pt ghost button.
- Alerts become dialogs and toasts.
- **The member view does not change** apart from token and type cleanup.

#### Child-safety queue, `app/admin/child-safety/index.tsx`

**Problems**
- Hand-built header with a back button about 36pt.
- **No empty state**.
- 5×900 weights; card margins of 10 here versus 9 in support.

**Already good:** it already uses FilterBar and FilterSheet.

**After**
- `AdminScreen`, `gate="staff"`, with a danger-tone "Restricted workspace" `eyebrow`.
- Rows show a shield icon, the reference and category, and priority and status pills.
- An empty state: "No cases match these filters", or "No open cases" when no filters are set.

#### Child-safety case, `app/admin/child-safety/[reportId].tsx`

**Problems**
- **About 20 identical solid buttons plus 3 inputs**, including:
  - a 7-option status row and a 4-option priority row, which run immediately on tap and **never show the current value**;
  - Purge **with no confirmation**, in the same red as the top CTA.
- 3 `Alert.alert` calls.
- The skeleton spins forever on a load error.
- 4 different radii.
- The header has no `navigation` background.
- Case history has no empty state.

**After**
- `AdminScreen` with the eyebrow, a legal-hold lock pill in the header, and **O**: Purge (danger, `requireText`, blocked while legal hold is on), Copy reference.
- Sections:
  - **Summary.**
  - **Status & priority:** shows the current values as pills. "Change" opens a radio sheet, and Apply opens an `AdminDialog` with the note.
  - **Authority referral:** the 2 inputs plus Save, collapsible.
  - **History:** with an empty state.
- **Sticky footer P** "Open secure conversation" (danger-tone border, not solid red).
- Remaining actions go into the footer's "⋯" or into the sections they belong to.
- A full error state with Retry.

---

## 4. Build order

**Precondition:** the Agent B bug sweep has merged to `main`. Every step below starts from the post-sweep files, re-reads them, and keeps their fixes. No step re-implements a bug fix differently.

| # | Step | Contents | Why this order |
|---|---|---|---|
| 0 | Tokens | `lib/admin/adminTokens.ts` (space, type, radius, `getAdminTone`), plus the 4 new `AppThemeColors` keys (light and dark) | Everything else depends on these. Zero visual change on its own. |
| 1 | Primitives | `AdminButton`, `AdminIconButton`, `AdminStatusPill`, `AdminState`, `AdminSection`, `AdminListRow`, `AdminStatCard`, `AdminOverflowMenu` | Small, isolated and easy to review |
| 2 | Shell and dialog | `AdminScreen` (with `AdminWorkspaceShell` as a wrapper), the `AdminDialog` restyle and stages, the `AdminToolbar` and `AdminFilterSheet` changes, the `FilterBar` and `FilterSheet` generalisation (admin variant opt-in) | Restyles 13 shell screens and every dialog at once. Member screens are untouched because the variant is opt-in. |
| 3 | **Destructive-action safety** | Report delete, collection delete, category delete, security removals, page-access bulk and reset, child-safety purge, support close and resolve, seller reject and suspend: all go through `AdminDialog` | Highest risk reduction per line changed. Overlaps with the bug sweep, so check what has already landed first. |
| 4 | Hub and routing | New hub, the 6 sections promoted to routes, `?section=` redirects, `AdminTab` themed | Unblocks pull-to-refresh and headers for the embedded sections |
| 5 | Heavy queues | Report detail, child-safety case, support ticket (staff mode), Seller review | Worst action walls; highest daily use |
| 6 | Lists using the filter pattern | Jobs, Users, Collections and Stickers, Moderation tabs, Activity logs, Testers, Page access, Support queue, Child-safety queue | Mechanical once `AdminToolbar` exists |
| 7 | Review cards | Couriers, Pets, Pending approvals, E-Learning review | Shared `AdminReviewCard` |
| 8 | Forms and tools | Security sub-pages, Game content, Categories, Sticker seed, Analytics | Lowest traffic |
| 9 | Cleanup | Delete `AdminWorkspaceShell`, `MobileAdminDateFilter` and the dead hub `StyleSheet` fallbacks; update the `AdminSkeletons` layouts; add an admin lint script or grep check for hex, 800/900 weights and banned spacing values in `components/admin` and `app/admin` | Stops the drift from coming back |

Run `cmd /c "node_modules\.bin\tsc --noEmit"` after each step. Keep one commit per step or screen group on `main`, following the git-workflow rule.

### Per-screen no-regression checklist

Copy this into each screen's commit description and tick every item.

- [ ] **Gate:** a non-admin sees the lock state. On staff routes (`help/tickets/staff/*`, `help/child-safety/review/*`) staff still get in, and members do not.
- [ ] **States:** first-load skeleton; full error with working Retry; empty; filtered-empty with "Clear filters"; inline error for refetch failures. No infinite spinner.
- [ ] **Refresh:** pull-to-refresh refetches and keeps filters and search; the toolbar stays mounted; refetch on focus is kept where it existed (Approvals, Learning review).
- [ ] **Filters:** sheet values round-trip; the active count badge is correct; removing a chip and "Clear all" work; search is debounced and does not drop focus.
- [ ] **Actions:** exactly one primary action. Every destructive item goes through `AdminDialog` (idle → busy → success). Busy disables repeat taps. Toasts fire only after the `await` succeeds (the existing behaviour). No `Alert.alert`.
- [ ] **Touch:** every pressable is at least 44pt (check with the inspector or `onLayout` logging); no nested touchables; every icon button has an `accessibilityLabel`.
- [ ] **Tokens:** no hex, no 800/900 weights, no off-scale spacing or radius in the diff (`rg "#[0-9a-fA-F]{3,8}|'(800|900)'"` on the touched files).
- [ ] **Dark mode:** checked in light, dark and system modes; soft tones are readable in dark mode (text contrast at least 4.5:1).
- [ ] **Navigation:** back works from a cold deep link (`canGoBack` fallback to `/admin`); `?section=` and `?tab=` params still resolve.
- [ ] **Keyboard:** forms and dialogs stay above the keyboard; the header stays outside `KeyboardAvoidingView`.
- [ ] **Shared components:** `FilterSheet`, `FilterBar` and the member ticket view look unchanged on a member screen.
- [ ] **Android and iOS:** both checked, including the bottom sheet sitting on the bottom edge on Android (the existing `FilterSheet` workaround).

---

## 5. Open questions for the user

1. **Primary action style.** Should the single primary action also be soft-tinted (strict web parity), or may it be a solid green fill with white text (stronger affordance on mobile)? This proposal assumes soft with a strong border.
2. **Danger hue.** Keep mobile red (`#dc2626` / `#ef4444`) or move admin danger to web rose (`#e11d48` / `#be123c`)? A switch would touch `ThemeContext` app-wide unless the new tones are admin-only.
3. **Dialog radius.** Should admin dialogs use 16 (this spec), or keep 24 as `custom-modals.md` asks for every modal? A 16 would need a rule exception.
4. **Hub structure.** Promote Users, Moderation, Page access, Security and Seller review to their own routes and drop the 6-tab bar, as proposed? Should Security's 6 tabs become sub-routes?
5. **Gating for support and child safety.** Should `AdminScreen gate="staff"` add a client-side staff check (today there is none and the server decides), or stay server-only and just show the API's 403 as an error state?
6. **Pagination.** Use "Load more" or infinite scroll everywhere (Users and Jobs currently have chevron pagers)?
7. **Activity logs dates.** Add a custom date range (needs the date-picker rule on mobile), or keep presets only?
8. **Icon set.** Standardise admin on lucide (FilterSheet and PageHeader use it) or Feather (most admin files use it)?
9. **Report detail.** Is "Resolve, no action" the most common outcome, and should it get its own footer button next to "Take action"?
10. **Support transfer.** Is there a staff directory to back a picker, or does transfer stay as a UID field for now?
11. **Reports and moderators.** RECON notes that the rules allow moderators on `reports` while the UI requires an admin. Should the redesigned Moderation screen support a moderator gate?

### Decisions (2026-11-24, redesign approved)

The user approved the proposal. These defaults settle the open questions above:

1. **Primary action style:** soft tint with a strong border. This matches the web rule; no solid fills.
2. **Danger hue:** stays mobile red. The tones are admin-only, and `ThemeContext` keeps its app-wide colours.
3. **Dialog radius:** 24, following `custom-modals.md`. No rule exception.
4. **Hub structure:** Users, Moderation, Page access, Security and Seller review become their own routes, and the 6-tab bar goes. `?section=` links redirect. Security's internal tabs stay as tabs.
5. **Gating:** `app/admin/_layout.tsx` (from the bug sweep) stays the admin gate. No separate staff gate.
6. **Pagination:** "Load more" everywhere.
7. **Activity log dates:** presets only.
8. **Icons:** Feather for admin, since most admin files already use it.
9. **Report detail:** "Take action" is the primary button; "Resolve, no action" is a secondary footer button.
10. **Support transfer:** stays a UID field.
11. **Moderator gate:** not added. This stays a decision for the user, listed in the bug report.

The redesign leaves `components/support/SupportTicketConversationScreen.tsx` alone, because the member support flow uses it too. It stays in the bug report's *Needs decision* list.

---

## Appendix A: bugs seen during the audit (hand to the bug sweep)

These are not part of the redesign. Agent B should confirm or fix them first.

| File | Issue |
|---|---|
| `AdminActivityLogsWorkspace.tsx` ~113-137 with shell :126 | Every keystroke calls `load()`, which sets `loading`. The shell then swaps the body for a skeleton, unmounting the search input: focus is lost, the keyboard closes, and there is one fetch per key. |
| `app/admin/child-safety/[reportId].tsx` :44 | When `getCase` fails it shows only an Alert, and the skeleton stays forever. |
| `app/admin/reports/[reportId]/index.tsx` :633-638, :679 | The header trash deletes the report with no confirmation. |
| `AdminCollectionWorkspace.tsx` :274; `AdminCategoryWorkspace.tsx` :134 | Delete with no confirmation. |
| `ModerationSection.tsx` :76-77 | `.catch(() => [])` swallows load errors, so the error popup can never show. |
| `AdminCouriersWorkspace.tsx` :50 | A tab switch sets `loading`, so the shell hides the tab row. |
| `AdminSecurityWorkspace.tsx` :188 | Returns `null` on a load error, leaving a blank area. |
| `MobileAdminExportModal.tsx` :42, :55-59 | Exporting 0 rows does nothing; errors are only logged and the modal closes as if it worked. Tapping inside the card can close it. |
| `SupportTicketConversationScreen.tsx` :220 | Status shows "undefined" while loading; Alerts at 68, 86, 108, 127, 138. |
| `app/admin/index.tsx` :198; `AdminWorkspaceShell.tsx` :66 | Back uses `router.back()` with no `canGoBack` fallback. |
| `AdminStickerSeedWorkspace.tsx` :39 | Pull-to-refresh only clears the status. |
| `AdminJobsWorkspace.tsx` :349-357 | The Reject dialog allows an empty reason. |
| `SellerReviewSection.tsx` :62 | The empty copy shows during loading and always says "submitted". |
| `AdminTestersWorkspace.tsx` :316 | Every status is shown in `successText`. |
| `AdminSkeletons.tsx` :15 | 13 rows versus 16 real hub rows. |
| `AdminSecurityWorkspace.tsx`, `ModerationSection.tsx` :172 | `className="space-y-*"` gaps may not apply in RN. |

---

## Implementation status (2026-11-24)

Built on Ourlime-Mobile `main` on top of the bug-sweep commits, which are all kept. Nothing has been run on a device or emulator: dark-mode contrast, measured touch targets, keyboard behaviour, and iOS/Android sheet and modal hand-offs are still unchecked.

| Steps | Commit | Contents |
|---|---|---|
| 0 | `6667508` | Tokens (`lib/admin/adminTokens.ts`) and 4 theme keys |
| 1 | `e6d0c19` | Primitives |
| 2 | `ca6d96c` | `AdminScreen`, the `AdminDialog` restyle, `AdminToolbar`, `AdminFilterSheet` |
| 3–4 | `8b5738a` | Hub, standalone section routes, `AdminTab`, analytics |
| 3, 5–8 | `c1fb357` | Users, testers, security, page access, activity logs |
| 3, 5–8 | `9c8b130` | Content and moderation, report detail |
| 3, 5–8 | `824c169` | Jobs, couriers, pets, game content, e-learning, approvals, seller review, child safety, support queue |
| 9 | cleanup commit | Removed `AdminWorkspaceShell`, `MobileAdminDateFilter` and the unused skeletons; added `bun run check:admin-tokens` (no raw hex and no 800/900 weights in `components/admin` and `app/admin`) |

**Not changed:** `SupportTicketConversationScreen` (shared with members) and `app/admin/support/[ticketId].tsx`.

**Primitive follow-ups the screen work asked for:**
- `AdminToolbar` segments that scroll or wrap when there are more than 3 options.
- A shared `AdminRadioRow`.
- An `onToggle` callback on `AdminSection`.
- Show a "Refresh"-only overflow menu when a screen has nothing else in it.
- An in-modal toast host (iOS hides toasts behind full-screen modals).
- A positive banner variant for `AdminState`.
- An optional `accessibilityLabel` on `AdminHeaderAction`.
