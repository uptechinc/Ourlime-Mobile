# Native Chat Acceptance Matrix

| Scenario | Required result |
|---|---|
| Cached open | Latest cached message is visible immediately |
| Network reconciliation | New records merge without an initial-position jump |
| Image/sticker height resolves | Reader remains anchored correctly |
| Older-page prepend | Existing visible message stays in place |
| Incoming while at bottom | List follows the new message |
| Incoming while reading history | Position stays fixed and “New messages” appears |
| Light theme | Incoming surfaces are light with readable dark text |
| Dark/System-dark | UI text is white/light; incoming surfaces are dark elevated |
| System theme changes | Chat updates without remount-only styling |
| Keyboard opens | Header remains fixed and composer remains above navigation controls |
| Blocked/error refresh | Cached history remains visible with a non-blocking notice |
| Logout/account switch | Previous account history never appears |
