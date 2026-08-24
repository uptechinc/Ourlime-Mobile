# Child Safety reporting and operations

Last updated: 2026-08-23

This document describes the software controls implemented from the Child Safety Report System requirements. It is not legal advice and it does not automate reports to law enforcement or child-protection authorities.

## Intake and confidentiality

The dedicated intake supports profiles, posts/media, comments/replies, messages/conversations, Limes, communities, events, Marketplace listings, E-Learning courses, blogs, and an `other` target. It requires one of 13 categories, immediate-danger `yes | no | unsure`, at least 20 characters of context, good-faith acknowledgement, and a contact-permission choice.

Do not request or permit evidence uploads for child-safety reports. Users and reviewers must not download, copy, forward, email, upload, or redistribute suspected CSAM. The API preserves the existing Ourlime target ID, parent ID, route, owner ID, and server-resolved collection/existence context.

References use `CSR-YYYY-NNNNNN`. A Firestore transaction increments the yearly counter and creates the case/audit atomically, preventing duplicate sequences during concurrent submissions.

## Restricted data and access

The server-only collections are:

- `childSafetyReports/{caseId}` with append-only `audit` and `authorityReferrals` subcollections
- `childSafetyReviewers/{userId}` for explicit grants
- `childSafetyPreservations/{caseId}` for legal holds and retained target context
- `childSafetyReportCounters/{year}`
- `childSafetyPurgeAudit/{auditId}`

Firestore rules deny every client read and write. Administrators always have API access. A non-admin needs an active explicit reviewer grant; ordinary moderator status does not grant access. Reviewer grants/revocations require an administrator and a reason.

## Triage and actions

Immediate danger, CSAE, suspected CSAM, grooming, sextortion, and suspected trafficking are critical. Other dedicated categories start high. Authorized reviewers can filter the queue, assign a case, add notes, change status/priority, escalate, hide and preserve the target, create/release legal hold, record an authority and its reference, resolve, and inspect the full audit history.

Authority referral is a human-recorded action. The software does not decide whether, when, or where to report externally. Hiding is separate from deletion: public visibility is removed while restricted identifiers and context remain preserved. There is no automatic retention deletion. Admin purge requires a reason, creates a separate purge audit, and fails while legal hold is active.

Reviewer lock-screen alerts are redacted to the case reference and urgency. They contain no category, description, child identity, target text, or suspected evidence.

## Legacy migration

From the web repository:

```powershell
bun run migrate:child-safety
bun run migrate:child-safety:execute
```

The first command is dry-run only. Execute creates dedicated cases and migration audit entries using deterministic source IDs, while retaining the original reports and source links. Review logs and record counts before and after execution. Do not delete the legacy source documents as part of migration.

## Operational work outside this codebase

- Deploy and verify Firestore rules and required indexes before enabling reviewer access.
- Publish and maintain the public Child Safety Standards URL, Community Guidelines, designated contact `ourlimechildsafety@gmail.com`, and in-product reporting path.
- Complete current Google Play child-safety/CSAE declarations, Data safety disclosures, contact verification, and any required policy attestations in Play Console.
- Have qualified counsel define jurisdiction-specific mandatory-reporting, evidence-preservation, legal-hold, retention, subpoena, authority-contact, appeal, and audited-purge procedures.
- Train and vet reviewers, enforce least privilege and periodic grant review, establish critical-case on-call coverage, and document breach/incident response.
- Validate redacted pushes and restricted-case access on real Android/iOS devices. Configure APNs VoIP/CallKit entitlements and production credentials separately.

These tasks require organizational authority and cannot be completed by an application build or source-code change alone.
