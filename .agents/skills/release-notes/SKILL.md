---
name: release-notes
description: Write and check the release notes members see for every Ourlime app update (OTA or Play), and keep the screens that show them working. Use before any OTA or Play release, when writing or reviewing lib/releaseHistory.json, or when someone says the update showed no notes ("You're up to date" with nothing listed).
---

# Release Notes: Every Update Says What Changed

Members must always see what an update changed. "Fixes and improvements" alone, or a bare "You're up to date", is a bug.

## 1. Where the notes appear (all from `lib/releaseHistory.json`)

| Screen | When | Source |
|---|---|---|
| **An update is ready** (OTA, before download) | An announced quick update | `siteConfig/mobileApp.latestOta.notes`, written by `scripts/publish-ota.cjs` from the top entry |
| **Update available** (Play, before update) | A new versionCode is live | `siteConfig/mobileApp.releaseNotes`, written by `bun notify` |
| **What's new** (once, after updating) | First launch on a new build or OTA | Newest entry for the running version, bundled in the app |
| **You're up to date** | Manual check, or the update push tapped after updating | "In this version": the same newest entry, plus "See all release notes" |
| **Settings → App → Release notes** | Any time | Every entry |

Code: `lib/services/AppUpdateService.ts` (`handleWhatsNew`, `showWhatsNew`), `components/ui/AppUpdatePanel.tsx`, `components/ui/AppUpdateSheet.tsx`, `lib/services/ReleaseHistoryService.ts`, `lib/services/AppVersionService.ts` (`readOtaNotes`).

**"What's new" is never dropped.**
- If only "You're up to date" is on screen, it replaces it.
- If a real update offer or download is on screen, it waits and shows when that sheet closes.

Keep both behaviours when changing the update flow.

## 2. Writing the entry

1. **Find what members haven't been told yet.**
   - Start from the last commit that changed `lib/releaseHistory.json`, then read the changes since: `git log --format="%h %s" <thatCommit>..HEAD`. Include web or server changes members notice in the app, such as a fixed notification link.
   - If members reported that an update showed no notes, the next entry recaps what they missed. Say so in the first note ("In case you missed it: …"), and leave past entries untouched.
2. **Add one new entry at the top.** Kind `"ota"` or `"app"`. The id is `<version>-ota-<date>[-n]`. Version and versionCode must equal `app.json`.
3. **Write the notes.**
   - Up to 12 notes, each under 240 characters, in plain member language: what they can do now, where to find it.
   - Biggest features first; one "Fixes: …" bullet last.
   - No file names, no internal terms ("parity", "OTA", "refactor").
4. **Run `npm run release:check`** and stop if it fails. Never chain the check into `git commit` with a pipe that hides its exit code: `npm run release:check | tail` lets a failed check commit anyway.
5. **Commit the entry with the change, then publish.** OTA: `bun run ota:publish -- --message "…"`. Play: see `app-release`.

## 3. Check it after publishing

- `scripts/publish-ota.cjs` prints the notes it announced. They must match the top entry.
- On the emulator or a phone:
  - Accept the update: "What's new" lists the new notes.
  - Then open Settings → App → Check for updates: "You're up to date" shows "In this version" with the same notes.
- If a member says they saw no notes:
  - Check that the running bundle has the entry (Settings → Release notes).
  - Check whether something opened the update sheet before "What's new" ran (the update push, or an automatic check).
  - Fix the flow, then recap the missed changes in the next entry.
