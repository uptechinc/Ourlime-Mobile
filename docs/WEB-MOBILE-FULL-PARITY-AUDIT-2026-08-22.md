# Ourlime Web-to-Mobile Full Parity Audit

Audited: 2026-08-23

Web baseline: `C:\Users\aaron\Github\Ourlime-Web` at `a602674`

Mobile baseline: `C:\Users\aaron\Github\Ourlime-Web\Ourlime-Mobile`

This is the current source-of-truth parity audit. It supersedes the 2026-08-12 re-audit and does not claim blanket parity where a web workflow is missing, mocked, hidden, or only represented by a parent mobile screen.

The exhaustive machine-readable inventory is `docs/WEB-MOBILE-COMPLETE-INVENTORY.json`. Regenerate it with:

```powershell
node scripts/generate-web-mobile-parity-inventory.cjs
```

## Inventory boundary

| Source surface | Current count |
| --- | ---: |
| Web route/loading/error files | 113 |
| Web user-facing `page.tsx` routes | 110 |
| Web API routes | 181 |
| Web component/source files | 437 |
| Web domain type files | 41 |
| Mobile route screens | 58 |
| Mobile component/source files | 143 |
| Mobile singleton service files | 68 |
| Mobile domain type files | 22 |

The JSON inventory records every file above. For each web page it also resolves transitive local component, type, service/helper, and literal `/api/...` dependencies. That makes future checks deterministic instead of relying on route names or an outdated manual checklist.

## Status vocabulary

- **Done**: service-backed behavior materially covers the current web product contract with a native interaction model.
- **Adapted**: the capability exists but is intentionally placed or presented differently for mobile.
- **Partial**: a meaningful implementation exists, but reachable behavior or subworkspaces are missing.
- **Prototype**: mock, static, simulated-success, or local-only behavior remains.
- **Missing**: no functional native equivalent exists.
- **Gated**: a route is intentionally protected by Page Access while incomplete; this is truthful product behavior, not parity.
- **Matched**: mobile has the same completed behavior and rollout state as web; it must not remain in a work plan.
- **Excluded (web-incomplete)**: web uses mock/static data, simulated success, an inert control, a missing API action, an unfinished implementation block, or a canonical Coming Soon shell without a complete contract. It is not a mobile parity task yet.

## Web-completion gate

Parity work is now gated by behavior, not route or component counts. A web feature is eligible to port only when its reachable UI calls a real persisted/API contract and the full interaction succeeds in source. A route file, a large component tree, a type definition, or an API that no working UI consumes is not proof of completion.

The following reviewed families are explicitly excluded from mobile implementation and from the remaining-work plan until web is completed:

| Web family or subfeature | Evidence from the current web source | Decision |
| --- | --- | --- |
| Ads marketplace | Mock creator content/analytics/wallet data, simulated launch, and referenced wallet endpoints that do not exist | Excluded |
| E-Wallet | Hard-coded `$350` balance, static transaction cards, and inert forms | Excluded |
| eLearning | Extensive sample/mock course, schedule, and learning data | Excluded |
| Generic Games directory | Links to dynamic game routes that are absent | Excluded |
| Trinidad GeoGuesser family | Landing route returns `null`; the game route alone does not complete the family | Excluded |
| Events review/preferences/ticketing add-ons | Review/preferences handlers only log; ticketing is explicitly Coming Soon; relationship state has a TODO | Excluded; existing native live event core is the matched scope |
| Blog authoring | Creation/edit depth contains mock or simulated behavior | Excluded; existing native live reads are the matched scope |
| Project workspace expansion | Canonical web route is Coming Soon and Invite Cancel/Resend UI sends actions rejected by the API allow-list | Excluded; existing native invite/create core is retained behind the matching gate |
| Profile product-management suite | Create/list/delete persist, but web update explicitly leaves variant/color/size reconciliation unfinished | Excluded as a suite; do not invent a more complete native editor |
| Market wishlist and standalone permalink | Wishlist only logs to the console and `/market/[id]` renders sample products | Excluded; live catalog/detail behavior remains eligible and is now matched |
| Saved and Help | No equivalent completed web product surface exists | Excluded |

## Route-family parity matrix

| Ordered web family | Web pages | Mobile state | Status | Exact remaining work |
| --- | ---: | --- | --- | --- |
| Root/Home | 1 | Cached live Home/Friends/Communities feeds, composer, media, polls, events, engagement, comments, moderation, suggestions, and native side-rail adaptations | Partial | Sound filter is still gated; Feeling metadata, comment mention/report depth, full-screen media, inline YouTube, and remaining navigation targets need completion. |
| Login | 1 | Native validation, account lifecycle enforcement, email verification handling/resend, recovery link, safe-area and keyboard UX | Done in source | Device-test every Firebase/account-state branch. |
| Register | 1 | Native multi-step account type, identity, demographics, location, avatar, interests, beta invite validation, three required policy acknowledgements, guardian option, and server-authorized registration start | Partial | Secure in-flow ID capture/upload and interrupted-registration resume remain. Selected ID methods are recorded as `documents_required`, never falsely marked verified. |
| Forgot/reset password | 2 | Native request, provider-aware email opening, reset-code validation, password update, invalid/success states | Done in source | Verify universal/app links on release builds. |
| Verify email and legacy verify route | 5 | Branded success/failure screen and Firebase verification email delivery | Partial | Canonical handling of every legacy web token URL and verification polling remains. |
| Terms/privacy/policies/child safety/delete account | 5 | Native legal routes, policy hub, child-safety standards/reporting, required registration acknowledgment, reauthentication and permanent deletion | Done/Adapted | Package canonical policy content locally instead of relying only on remote WebViews for Terms/Privacy. |
| 404/loading/error | 3 | Branded native 404 with Home and Back recovery; invalid/unsupported Ourlime deep links route to it; root crash/error boundary and skeletons exist | Done in source | Device-test cold-start malformed links. |
| Discover/Search | 2 | Live users, suggestions, communities, events and jobs through typed services; both the API path and bounded Firestore fallback enforce `searchVisibility` | Partial | Global multi-entity result tabs, recent history, deeper filters, and bounded continuation are still smaller than web. |
| Notifications | 1 | In-app notification center, request actions, read state, push routing, and deep-link registry | Adapted/Partial | Add dedicated full-screen history and bounded pagination if the web archive depth is required. |
| Limes and Lime permalinks | 3 | Live vertical feed, creation/upload with the web's 30-second/type/size validation, Following/For You, comments, likes, share, repost/remove, report and child-safety actions | Adapted/Partial | A native permalink route is represented by a tab query destination; remaining detail controls and runtime deep-link QA remain. |
| Posts and post permalink | 1 | Native permalink card, shared post/poll components, comments/replies, categorized GIPHY browsing with larger previews, reaction/share/repost/report/delete | Partial | Finish comment/reply author navigation, mention suggestions/reporting, hashtag navigation and selected-media comment context. |
| Communities | 2 | Live directory, scopes, filtering, create/edit/delete, join/request/cancel/leave, feed, events, polls, members, owner/admin dashboard and moderation | Substantially done | Friend invite selection/delivery, unban/delete-member-content edge actions, media cleanup and role-matrix device QA remain. |
| Chat/messaging/calls | Web API-driven | Live conversations, realtime messages, archive/mute/pin/delete/clear, replies/reactions/forward, attachments, voice URLs, stickers, presence, Agora and push calling | Partial | Finish native recording/playback controls, business/discovery chat tabs and physical-device call QA. |
| Own/public profile | 4 | Live cached own/public profiles, timeline, friends, communities, about, gallery, relationship/block/report/message/share, avatar/cover updates | Partial | Reposts, customization, follower/following workspaces, albums, structured About editing and full privacy-field enforcement remain. |
| Profile settings | 1 | Theme, account/profile/privacy/notifications/blocking, account deletion and sign-out | Partial | 2FA, password/session management, connected accounts, export, activity log and proof every privacy flag is consumed remain. |
| Profile product routes | 4 | No complete native seller/product-management workspace | Excluded (web-incomplete) | No action or plan: the web update service explicitly does not reconcile variants, sizes, or colors. |
| Business account | 1 | Partial service classes only | Prototype/Gated | Complete validation, profile, metrics, persistence and business UX. |
| Jobs and profile job routes | 6 | Live discovery/create/apply through the stricter server validation, native My Applications status/withdrawal, plus cached employer management, enriched applicants, search/filter/sort, server-valid status transitions, bulk status, interviews, private notes, bounded audit history, resume/portfolio access, lifecycle/delete, and disclaimer-protected editing | Done/Adapted in source / Gated | No eligible source implementation gap remains in the completed web Jobs workflows. Email notifications continue to be dispatched by the web APIs; availability matches the web Coming Soon default. |
| Events | 3 | Live discovery, creation, attendance/RSVP, likes, detail sheet and community integration | Matched core / Excluded add-ons | No action or plan for simulated review/preferences, TODO relationship state, or Coming Soon ticketing. |
| Projects | 2 | Live membership, email invite claim, inviter and owner attribution, accept/decline and creation exist as an early native core | Excluded (web-incomplete) / Gated | No task-workspace plan until the canonical web route and unsupported invite actions are completed. |
| Market | 2 | Live bounded catalog/search/category pagination, gallery, stock-aware color/size variants, dynamic price, seller context, contact actions, and real chat inquiry through `MarketService`; no fake fallback products | Matched completed web scope / Gated | No action or plan for the web's console-only wishlist or sample-data permalink. |
| Blogs | 2 | Live reads exist | Matched reads / Excluded authoring | No authoring plan until web authoring is fully persistent. |
| Ads marketplace | 19 | Basic native route shells remain gated | Excluded (web-incomplete) | No action or plan while the web workflow uses mocks, simulation, and missing wallet APIs. |
| eLearning | 23 | One native hub and legacy static/mock components remain gated | Excluded (web-incomplete) | No action or plan while web learning workflows depend on sample/mock data. |
| E-Hub | 1 | Coming Soon route | Excluded (web-incomplete) | No action or plan until a completed web contract exists. |
| E-Wallet | 1 | Coming Soon route | Excluded (web-incomplete) | No action or plan while the web wallet is a hard-coded prototype. |
| Games | 1 | Coming Soon route | Excluded (web-incomplete) | No generic directory plan while web links to missing routes. |
| Trinidad GeoGuesser | 3 | Coming Soon route | Excluded (web-incomplete) | No action or plan while the web family landing route returns `null`. |
| Wordle | 1 | Native Trini Wordle now matches the playable web source: six-row state, duplicate-letter scoring, full web dictionary validation, keyboard state, help, result and reset; dictionary is lazy-loaded for native memory safety | Done/Adapted / Gated | No statistics or persistence work: those features are not implemented by the current web game. Availability remains gated to match rollout state. |
| Saved | Mobile-only destination | Excluded (no web counterpart) | No action or plan. |
| Help | Mobile-only destination | Excluded (no completed web counterpart) | No action or plan. |
| Admin | 15 web/admin pages | Native analytics, dashboard, testers, users/lifecycle, moderation/reports, page access, products, communities, categories and stickers routes | Substantially done | Verify every privileged mutation server-side, add remaining jobs/seed-sticker conveniences and complete bulk/audit depth. |

## API inventory by domain

All 180 route files are listed in the JSON inventory. The largest groups are:

| API family | Routes | Mobile consumption state |
| --- | ---: | --- |
| Communities | 22 | Broad typed service coverage |
| Profile | 22 | Core profile coverage; product suite excluded because web update is unfinished |
| Jobs | 14 | Completed web applicant and employer APIs are consumed by the native application and management flows |
| Posts | 12 | Broad typed service coverage |
| Home | 10 | Broad feed coverage; rail modules adapted/partial |
| Admin | 9 | Broad native admin coverage |
| Beta | 9 | Registration and tester workflows covered |
| Ads | 8 | Excluded because the consuming web workflow is incomplete |
| Relationships | 5 | Broad profile/feed coverage |
| Limes | 4 | Broad native coverage |
| Moderation | 4 | Broad native coverage |
| GeoGuesser | 4 | Excluded because the web family is incomplete |

The remaining 33 API families and every exact file are preserved in the generated JSON. An API route does not require a one-to-one native screen: it must be owned by a typed domain service and consumed only where the native product flow needs it.

## Component and type comparison

- Web has 435 component/source files. Its largest groups are Home (77), Profile (63), Communities (22), Register (21), Chat (21), Jobs (19), E-Hub (19), Wordle (17), eLearning (17), Projects (15), Events (14), Admin (13), and Ads (8).
- Mobile has 138 component/source files and 66 singleton domain services. The lower component count is not itself a defect because native screens intentionally consolidate desktop panels.
- Every exact component/type filename and every transitive dependency reached from each web page is in `WEB-MOBILE-COMPLETE-INVENTORY.json`.

## Native UX rules for parity work

- Do not reproduce the web three-column layout. Side rails belong in the drawer, Discover/Search, horizontal modules, or interleaved cards.
- Use full-screen routes for complex workspaces, page sheets for creation/editing, bottom sheets for short action menus, and native sharing/directions/media pickers.
- Never add mock arrays, random fixture generation, silent empty fallbacks, or simulated success.
- Screens own only ephemeral presentation state. Singleton services own APIs, Firebase, caching, normalization, validation and mutation reconciliation.
- Keep network work bounded, cursor-paginated, cancellable, page-access-aware, and limited to two background requests.

## Current completion conclusion

The core social product is broad and service-backed. Login, Register, recovery, policies, 404, completed Jobs management, live Market detail behavior, and playable Wordle now have native implementations. This audit does **not** treat unfinished web families as mobile debt. Excluded rows are neither implementation tasks nor roadmap items; they must be re-audited only after the web contracts become complete. Remaining `Partial` rows represent genuine mobile deltas against completed web behavior.
