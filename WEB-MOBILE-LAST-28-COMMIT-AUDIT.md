# Ourlime Web to Mobile - Recent Commit Audit

Audit date: 2026-08-23

Web source: `C:\Users\aaron\Github\Ourlime-Web` at `a602674`

Mobile source: `C:\Users\aaron\Github\Ourlime-Web\Ourlime-Mobile`

Legend: **Implemented** is present in native mobile or is backend-only and already consumed by mobile. **Partial** means the usable core is present but some web-only controls remain. **N/A** is documentation, rules, formatting, or a merge with no independent product behavior.

## Newly pulled delta after the previous audit

The seven commits from the previous `793d29c` baseline through current web HEAD `a602674` were reviewed individually against their changed pages, APIs, components, types, rollout defaults, and current native implementation.

| Commit | Web change | Mobile result | Status |
|---|---|---|---|
| `a602674` | Stricter job submission validation, applicant application history/withdrawal, and employer authorization/status transitions | Job submission now uses the validating web API instead of direct Firestore writes; added a themed native My Applications screen with status history, resume access, refresh, and permitted withdrawal; employer mutations include `employerId` and expose only server-valid transitions. My Applications falls back to ownership-checked Firestore reads/withdrawal only when the new API route returns 404 from an older server deployment. | **Implemented** |
| `6dad724` | Mobile-web navigation/media fixes, categorized GIF browsing, Lime validation/modal sizing, and project owner attribution | Browser scroll/fullscreen/menu mechanics are not applicable to native. Added the completed portable behavior: themed GIF categories and larger previews, 30-second/type/100 MB Lime validation, and resolved project-owner names on native project cards. | **Implemented / Adapted** |
| `d31639a` | Enforce user `searchVisibility` in search results | The shared API already supplies the fix; the native Firestore fallback now independently reads `users/{uid}/userPrivacySettings/privacy` so an API failure cannot bypass the setting. | **Implemented** |
| `0fd83be` | Blog fixes and authoring expansion | Audited, but the web Blogs parent remains `coming_soon` and authoring still contains mock/simulated behavior. Existing native live reads remain; no unfinished web behavior was added or planned. | **Matched / Excluded** |
| `15100c1` | eLearning changes | Audited, but the web eLearning parent remains `coming_soon` and course/learning surfaces still contain sample data, placeholder alerts, and unfinished persistence. Mobile remains at the matching gated state. | **Matched / Excluded** |
| `1618ae3` | Cursor editor rule formatting | No runtime product behavior. | **N/A** |
| `957d776` | Child-safety policy/navigation wording and moderation label | Native legal screens consume the canonical web documents and settings already links directly to Child Safety Standards. The native moderation label now matches “Child Safety / Sexual Exploitation.” | **Implemented** |

Delta total: 4 runtime commits implemented/adapted, 2 web-incomplete families confirmed matched and excluded, and 1 editor-only commit requiring no product work.

## Previous 28-commit baseline (through `793d29c`)

## Most recent eight commits

| Commit | Web change | Mobile result | Status |
|---|---|---|---|
| `793d29c` | Child-safety reporting, standards page, registration acknowledgment, feed/poll reporting | Added child-safety report category and critical escalation for posts, users, communities, and Limes; evidence is intentionally disabled for suspected CSAM; added native policy screen and required registration acknowledgment. | **Implemented** |
| `6f12e5b` | Jobs overhaul | Removed all dummy job/freelancer data and completed the web-backed native workflow: live discovery, create/apply, resume upload, enriched applicant detail, search/filter/sort, single and bulk status actions, interview scheduling, private notes, bounded audit history, resume/portfolio access, lifecycle/delete, and disclaimer-protected editing. | **Implemented** |
| `4435938` | Cursor rules | No runtime product behavior. Mobile follows its own checked-in agent rules. | **N/A** |
| `fe72fe3` | Lime engagement, policies, project invites, comment/reply updates | Lime like/comment/share/repost/remove-repost/report flows already exist; added policy routes, GIPHY-backed post comment/reply attachments, plus native E-Projects membership loading, email-invite claim, inviter attribution, accept/decline, creation, and notification routing. | **Implemented** |
| `6943853` | Cursor rules | No runtime product behavior. | **N/A** |
| `d521640` | Communities, feeds, terms, deletion controls | Mobile already has private-community requests/cancellation, owner/admin request review, dashboards, feed scopes, video controls, terms, and policy screens. Added authenticated permanent account deletion and the public deletion-information route. | **Implemented** |
| `c7fe510` | Web custom-modal agent rule | No runtime product behavior. Native uses `CustomModal` and purpose-built sheet modals. | **N/A** |
| `8741b7e` | Social interactions and community management | Native includes post/Lime reposts, nested comments, GIF attachments, likes, friend cancellation, community likes/membership management, member actions, editing, and moderation. | **Implemented** |

## Remaining twenty commits

| Commit | Web change | Mobile parity | Status |
|---|---|---|---|
| `e0b40bb` | Push-token route diagnostics | Mobile registers native FCM tokens and now records client diagnostics and native crashes. Server change is consumed without a duplicate client feature. | **Implemented** |
| `00bd747` | FCM dispatcher logging | Backend-only dispatch observability; existing native receiver is compatible. | **Implemented** |
| `544e183` | Firebase Admin multicast | Backend-only delivery transport; existing native FCM registration is compatible. | **Implemented** |
| `4d68830` | README formatting | Documentation only. | **N/A** |
| `6253eb0` | Chat archive/unarchive | `MessagingService`, chat settings, bulk selection, and the Archived filter support archive/unarchive. | **Implemented** |
| `f4405c4` | README update | Documentation only. | **N/A** |
| `6dc4f94` | API duration and community-feed query | Backend-only compatibility/query change used by native API clients. | **Implemented** |
| `1c7b922` | README formatting | Documentation only. | **N/A** |
| `b6f4f91` | Merge/conflict resolution | No independent feature to port. | **N/A** |
| `1446202` | Chat/calls, Lime repost, friend-request cancellation, deep links | Native has Agora calling, chat media/actions, Lime repost/remove-repost, friend cancellation across Search/Discover/Profile, and matching deep-link routes. | **Implemented** |
| `4958647` | Event date formatting | Native feed/community event cards normalize dates through the event model and native locale formatting. | **Implemented** |
| `85e7872` | Privacy policy/navigation | Native Privacy Policy route and settings link are present. | **Implemented** |
| `32ccc7e` | Admin lifecycle deletion, media playback, community editing | Native admin lifecycle workspace supports archive/restore/permanent deletion; native media playback and community editing are present. | **Implemented** |
| `30d5f87` | Admin color rules | Rules only. | **N/A** |
| `98b126b` | Registration and course-creation feedback | Registration validation/feedback is present. The eLearning portion is excluded because the corresponding web workflow still depends on sample/mock course data. | **Implemented / Excluded** |
| `a7d8619` | Admin color rules | Rules only. | **N/A** |
| `67204a7` | Events, media, and learning workflows | Completed Event and media behavior is present. Learning messages/materials are excluded because their web workflow is not fully persistent. | **Implemented / Excluded** |
| `44e672e` | Admin color rules | Rules only. | **N/A** |
| `1989add` | Events, media, and learning workflows | Completed Event/community/media behavior is present. Course creation/tutor/message/material work is excluded until web is complete. | **Implemented / Excluded** |
| `51eb5b1` | Cursor rule formatting | No runtime product behavior. | **N/A** |

## Totals and open work

- 14 commits are implemented or backend-compatible.
- 3 commits contain web-incomplete eLearning portions that are explicitly excluded from mobile implementation and planning.
- 11 commits are documentation/rules/merge-only and require no mobile feature.
- No remaining-work item is created merely because web contains a route, component, or incomplete prototype.

Advanced employer Jobs tooling is now implemented. eLearning is not mobile debt while the web source still relies on sample/mock data. The full completion-gate evidence and all other family decisions are recorded in `docs/WEB-MOBILE-FULL-PARITY-AUDIT-2026-08-22.md`.
