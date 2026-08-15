# Ourlime Mobile Page Preload Matrix

| Route/domain | Policy | Resource owner | Startup payload | Stale / retention | Invalidation |
|---|---|---|---|---|---|
| Home feed | Startup critical | `FeedResourceService` | Home/All first page | 60s / 48h | Posts, reactions, comments, relationships |
| Friends feed | Startup navigation | `FeedResourceService` | Friends/All, then derived filters | 60s / 48h | Friendship, block, posts |
| Communities feed | Startup navigation | `FeedResourceService` | Communities/All with community identity | 60s / 48h | Membership, community posts |
| Discover | Startup navigation | `DiscoverResourceService` | Suggestions, communities, events, jobs | 5m / 24h | Friend and membership actions |
| Communities directory | Startup navigation | `CommunitiesResourceService` | Directory and categories | 5m / 48h | Create, join, leave, approval |
| Chat list | Startup critical | `ConversationResourceService` | Latest 50 summaries | Realtime / bounded disk | Messages, friendship, block |
| Chat detail | Parent-driven | `MessageResourceService` | Latest cached 30 | Realtime / 7d | Send, edit, delete, read, clear |
| Own profile | Startup critical | `ProfileResourceService` | Profile and counts | 5m / 7d | Profile, posts, relationships |
| Public profile | Parent-driven | `ProfileResourceService` | Visible linked profiles | 10m / 7d | Profile, block, relationship |
| Admin | Authorized startup | Existing admin services | Overview only | Service-specific | Admin mutations |
| Search | Interaction-only | `SearchService` | Recent bounded queries only | Short-lived | Query/user changes |
| Dynamic post/community/profile IDs | Parent-driven | Domain service | First visible destinations only | Domain-specific | Domain mutation |
| Coming Soon/static/auth | None | None | No backend request | N/A | Page-access change |

For every new route, add one explicit policy. Never interpret “every page” as downloading every database record.
