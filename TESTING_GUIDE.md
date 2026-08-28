# Ourlime Admin Moderation & Security System — Testing Guide

A step-by-step manual and automated testing guide for verifying all Admin Moderation, Account Lifecycle, Access Controls, Whitelisting, Appeals, and Rate Limiting features across **Ourlime Mobile** and **Ourlime Web**.

---

## 1. Content Deletion & Soft-Deletion Workflow

### 👤 User's POV (Content Author / Public Viewer)
- **Viewing Content**:
  - Open the Home feed or user profile. Verify regular posts, comments, products, blogs, and communities display normally.
- **When Content is Deleted by Admin**:
  - The post or item disappears immediately from the public feed and user's profile timeline.
  - The content author receives an in-app and push notification:
    - *"Your post was removed by moderation for: [Reason]"*
    - Notification includes an **"Appeal / View Details"** action button.
- **Viewing Removal Reason**:
  - Tapping the notification opens the **Content Removal Modal** displaying:
    - Content snippet / title
    - Exact policy violation category and custom reason given by the admin
    - Information explaining that an appeal can be submitted

---

### 🛡️ Admin's POV (Administrator / Moderator)
- **Accessing Deletion from Content (3-Dot Menu)**:
  - On any post, comment, product, blog, project, or community, tap the three-dot menu `(...)`.
  - Verify the **"🛡️ Admin Delete Post"** option appears in red with a shield icon (visible exclusively to admins).
- **Submitting Deletion**:
  - Tap **"Admin Delete Post"** -> The `AdminDeletionModal` opens.
  - Choose from the mandatory predefined reasons:
    - *Inappropriate Content*, *Harassment & Bullying*, *Spam & Commercial Fraud*, *Misinformation*, *Copyright Infringement*, *Child Safety*, *Terms of Service*, or *Custom*.
  - If **Custom** is selected, verify the text field appears and requires an explanation.
  - (Optional) Enter internal moderator notes (visible only in audit logs).
  - Tap **"Confirm Admin Deletion"**.
- **Audit Verification**:
  - Verify haptic confirmation plays.
  - Verify document is soft-deleted (`isDeleted: true`, `deletedAt`, `deletedBy`, `deletionReason`, `status: 'deleted'`).
  - Verify an entry is recorded in `moderationAuditLog`.

---

## 2. User Appeals & Content Restoration Workflow

### 👤 User's POV (Author Appealing Removal)
- **Submitting an Appeal**:
  - Open the deletion notification or tap **"Appeal"** on the removal modal.
  - In the `ContentAppealModal`, review the removed item and the admin's deletion reason.
  - In the explanation text box, type the justification (e.g., *"This post complies with community guidelines because it is educational and non-commercial"*).
  - Tap **"Submit Appeal"**.
  - Verify confirmation screen appears: *"Appeal Submitted — Our moderation team has received your restoration request"*.
- **When Appeal is Approved**:
  - Author receives a notification: *"Your appeal was approved and your post has been restored"*.
  - The post immediately reappears in the live timeline and feed.

---

### 🛡️ Admin's POV (Reviewing Appeals in Admin Portal)
- **Accessing Appeals Queue**:
  - Open **Admin Portal** -> Navigate to **Reports / Moderation** -> Switch to the **"Appeals"** sub-tab.
  - Verify pending user appeals appear with:
    - Content Type badge
    - Author username / email
    - Original admin deletion reason
    - User's written appeal explanation
- **Deciding on Appeals**:
  - **Option A: Reject Appeal**:
    - Tap **"Reject Appeal"**.
    - Verify appeal status updates to `rejected` and item remains deleted.
  - **Option B: Approve & Restore**:
    - Tap **"Approve & Restore"**.
    - Verify haptic success plays.
    - The item is automatically restored (`isDeleted: false`, `status: 'active'`), removed from the pending appeals queue, and restored to live feeds.

---

## 3. User Profile Deleted Posts Tab (Admin Recovery)

### 👤 User's POV
- **Normal Profile View**:
  - Visiting any profile (own or other users) displays standard tabs: *Posts*, *Friends*, *Communities*, *About*, *Gallery*.
  - No deleted posts or admin tools are visible.

---

### 🛡️ Admin's POV
- **Inspecting Deleted Content on User Profiles**:
  - As an admin, navigate to any user's profile page (`/profile/[username]`).
  - Notice the extra administrative tab: **"🛡️ Deleted (Admin)"**.
  - Tap the **"🛡️ Deleted (Admin)"** tab.
  - Verify all soft-deleted posts for that specific user are listed with:
    - Post caption and image preview
    - Date of removal
    - Deletion reason badge
    - Name/ID of the admin who removed it
- **1-Tap Post Recovery**:
  - Tap the green **"Restore Post"** button on any deleted item.
  - Verify success confirmation: *"Post Restored — The post has been restored to the public feed"*.
  - The post moves from Deleted back to the active **Posts** tab immediately.

---

## 4. Account Suspension, Banning & Restoration

### 👤 User's POV
- **Suspended Account**:
  - If an account is suspended:
    - Attempting to log in or access protected tabs displays: *"Account Suspended until [Date] — Reason: [Reason]"*.
    - Write actions (posting, commenting, messaging) are blocked until suspension expiration.
- **Banned Account**:
  - If an account is banned:
    - Attempting to log in displays: *"Account Banned — Reason: [Reason]. Contact support to appeal."*
    - Token authentication is rejected with `ACCOUNT_BANNED`.
- **Restored Account**:
  - Once unbanned/restored, logging in grants immediate normal access.

---

### 🛡️ Admin's POV
- **Managing Account Status**:
  - Open **Admin Portal** -> Navigate to **Users** workspace.
  - Filter users by: `Active`, `Suspended`, `Banned`, `Archived`, or `All`.
  - Tap on any user to open the User Management inspector -> Select **Status** tab.
- **Applying Actions**:
  - **Suspend**:
    - Select **"Suspend"**.
    - Enter mandatory suspension reason (e.g. *"Inappropriate conduct in comments"*).
    - Choose duration (e.g. 7 days, 14 days, 30 days).
    - Tap Save -> User's `accountStatus` updates to `suspended` with `suspendedUntil` timestamp.
  - **Ban**:
    - Select **"Ban"**.
    - Enter mandatory ban reason (e.g. *"Bot spam / commercial fraud"*).
    - Tap Save -> User is permanently banned (`isBanned: true`, `accountStatus: 'banned'`).
  - **Restore / Unban**:
    - Select **"Active"**.
    - Tap Save -> Clears ban and suspension flags, restoring account to good standing.
  - Verify all changes are logged in `moderationAuditLog` and `securityAuditLog`.

---

## 5. Geographic Region / Country Access Controls (e.g. Trinidad & Tobago)

### 👤 User's POV
- **Accessing from Allowed Region (e.g., Trinidad & Tobago 🇹🇹)**:
  - Open app / web page -> App connects normally and all feeds load.
- **Accessing from Restricted Region**:
  - If the platform is set to *Allow Selected Only (Trinidad & Tobago)* and user connects from another country without a bypass:
    - Gateway blocks access: *"Access is currently restricted in your geographic region."*
- **Whitelisted Account Exception**:
  - If the user's account is on the **Account Whitelist Bypass**, they can log in and use the app freely from anywhere in the world, completely bypassing the country restriction.

---

### 🛡️ Admin's POV
- **Configuring Regional Enforcement**:
  - Open **Admin Portal** -> Select **Security** tab -> Select **🌍 Region Blocking**.
  - Choose one of the 3 policy modes:
    1. **Global Access (Allow All)**: Open to all countries worldwide.
    2. **Allow Selected Only**: Restricts access strictly to selected countries (e.g. select `Trinidad & Tobago 🇹🇹`).
    3. **Block Selected Countries**: Allows worldwide except specific blocked countries.
  - Tap country chips to toggle them on or off (e.g., `Trinidad & Tobago 🇹🇹`, `Jamaica 🇯🇲`, `Barbados 🇧🇧`, `Guyana 🇬🇾`, `United States 🇺🇸`, `United Kingdom 🇬🇧`).
  - Tap **"Save Region Settings"** to persist to `siteConfig/securityAccessControls`.
- **Testing API Gateway**:
  - Test via endpoint: `GET /api/security/check-access` to verify GeoIP evaluation.

---

## 6. IP Rules (Whitelisting & Blocklisting)

### 👤 User's POV
- **Normal Connection**: Operates normally.
- **From Blocklisted IP**:
  - Any request originating from a blocked IP is rejected: *"Your IP address has been administratively blocked."*
- **From Whitelisted IP**:
  - Even if connecting from a blocked country, requests from a whitelisted IP are granted instant bypass access.

---

### 🛡️ Admin's POV
- **Adding IP Rules**:
  - Open **Admin Portal** -> **Security** -> **🔒 IP Rules** tab.
  - In the form:
    - Enter IP address (e.g., `190.58.12.44` or `8.8.8.8`).
    - Select **Whitelist (Allow)** or **Blocklist (Deny)**.
    - Enter an optional label (e.g., *"HQ Office Network"* or *"Known Bot Scraper"*).
    - Tap **"Add IP Rule"**.
- **Managing Rules**:
  - View all active IP rules in the list with their badge (`[WHITELIST]` or `[BLOCKLIST]`).
  - Tap the red trash icon to delete/remove an IP rule anytime.

---

## 7. Account Whitelist Bypass Management

### 👤 User's POV (Whitelisted Developer / Remote QA / Executive)
- Experiences zero geo-fencing or IP barriers.
- Can travel internationally or use any VPN/network without being locked out.

---

### 🛡️ Admin's POV
- **Adding Account Bypass**:
  - Open **Admin Portal** -> **Security** -> **⭐ Whitelist Bypass** tab.
  - Enter:
    - User ID (UID)
    - User Email (e.g., `lead@ourlime.com`)
    - Reason (e.g., *"Lead Remote Developer / QA"*)
  - Tap **"Add Whitelist Bypass"**.
- **Managing Whitelist**:
  - View all accounts granted global exemption.
  - Tap the trash icon to revoke a bypass exception.

---

## 8. Rate Limiting & Anti-Abuse Engine

### 👤 User's POV
- **Regular Usage**: No delay or hindrance.
- **Excessive Requests / Spam Bot Behavior**:
  - If a user/IP fires requests faster than the configured threshold (e.g. >30 post creations per minute):
    - Receives HTTP 429 Too Many Requests: *"Too many requests. Please slow down and try again in X seconds."*

---

### 🛡️ Admin's POV
- **Configuring Rate Limits**:
  - Open **Admin Portal** -> **Security** -> **⚡ Rate Limits** tab.
  - Toggle **"Enable Rate Limiting"** switch ON/OFF.
  - Configure thresholds:
    - *Auth Requests (per min / IP)*: e.g. `15`
    - *Post Creation (per min / User)*: e.g. `30`
    - *Comment Creation (per min / User)*: e.g. `45`
    - *General API Requests (per min / IP)*: e.g. `120`
  - Tap **"Save Rate Limit Configuration"**.

---

## 9. Automated E2E Test Suite Execution

You can run the entire automated verification test suite covering all 19 test scenarios with one command:

```bash
# In Ourlime-Mobile directory:
node scripts/test-moderation-and-security.cjs
```

### Test Coverage Summary:
- **Test 1–4**: Content deletion validation (mandatory reason check, custom reason check, timestamp stamps, post restoration).
- **Test 5–8**: Account lifecycle transitions (mandatory reason, suspension calculation, permanent banning, active restoration).
- **Test 9–13**: Region & IP Access Controls (Trinidad & Tobago allowlisting, foreign country blocking, IP whitelist bypass, Account whitelist bypass, IP blocklist rejection).
- **Test 14–17**: Content Appeals lifecycle (justification required, pending status, approval & restoration, rejection).
- **Test 18–19**: Rate limiting engine (within threshold vs. exceeding threshold calculation).
