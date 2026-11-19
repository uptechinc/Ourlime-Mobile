# Apple Developer Enrollment and Account Setup

Use this guide for the Ourlime publishing account. The recommended ownership model is an **organization membership owned by Ourlime's legal entity**, not a developer's personal membership. Apple lists the organization as the App Store seller and lets the Account Holder invite developers without sharing credentials.

Apple's current official enrollment information is at <https://developer.apple.com/help/account/membership/program-enrollment/>. As of November 18, 2026, Apple states that the Apple Developer Program costs USD 99 per membership year, or local currency where available; confirm the price shown during enrollment.

## 1. Prepare the organization

Before starting, collect:

- the exact registered legal entity name and business address
- the organization's D-U-N-S Number (government organizations are handled differently)
- a public, functional organization website on its own domain
- a work email address on that domain
- an Apple Account with two-factor authentication enabled
- a person with authority to bind the organization to Apple's agreements
- a reference who can confirm that authority if Apple requests one

Do not enroll an organization using a DBA, trade name, branch, or informal name. If an individual account is used, the individual's legal name is normally shown as the seller.

## 2. Enroll

1. Sign in at <https://developer.apple.com/programs/enroll/> using the future Account Holder's Apple Account.
2. Choose **Organization** and enter the legal entity details exactly as registered.
3. Supply the D-U-N-S Number, website, work email, and authority information.
4. Complete any identity, business-document, phone, or authority verification Apple requests.
5. After approval, accept the Apple Developer Program License Agreement and purchase the membership.
6. Record the legal seller name and the Apple Team ID in the organization's password manager or operations record.

The Account Holder should retain control of renewals, agreements, and sensitive account changes. Never share Apple Account passwords or two-factor codes.

## 3. Invite the Mac developer

After activation:

1. In App Store Connect, open **Users and Access**.
2. Invite the developer with their own Apple Account.
3. Grant the least role needed. **Developer** is normally enough for certificates/build work; **App Manager** is appropriate when they must manage the app record and submissions. Use **Admin** only when genuinely required.
4. Limit access to Ourlime when the role supports per-app access.
5. Confirm the developer can select the organization team in Xcode.

Apple role reference: <https://developer.apple.com/help/account/access/roles/>.

## 4. Register Ourlime's Apple identity

In **Certificates, Identifiers & Profiles**:

1. Register an explicit App ID with bundle ID `com.ourlime.app`.
2. Enable **Associated Domains** and **Push Notifications**.
3. Configure App Attest/DeviceCheck as required by Firebase App Check.
4. Confirm the real-time calling design qualifies before relying on PushKit/VoIP capabilities.
5. Let Xcode automatically manage development and distribution signing unless the organization has a deliberate manual-signing policy.

Apple's capability guide is at <https://developer.apple.com/help/account/identifiers/enable-app-capabilities/>.

## 5. Configure notifications and Firebase

1. Create an APNs authentication key only if the organization does not already have a suitable key.
2. Save the `.p8` file immediately in the organization's secure credential vault; Apple normally provides it only once.
3. Record the Key ID and Team ID separately.
4. Upload the APNs key to the existing Ourlime Firebase project under Cloud Messaging for the `com.ourlime.app` iOS app.
5. Never commit `.p8`, `.p12`, provisioning profiles, passwords, or two-factor codes.
6. Register the Simulator App Check debug token, test physical-device App Attest, review App Check metrics, and leave enforcement disabled until all active clients are valid.

## 6. Create the App Store Connect record

1. Ensure the Account Holder has accepted current agreements.
2. In App Store Connect, choose **Apps > + > New App**.
3. Choose iOS, the Ourlime name, primary language, the `com.ourlime.app` bundle ID, and a unique internal SKU.
4. Choose full or limited user access deliberately.
5. Complete privacy, age-rating, content, support, review-access, screenshot, and export-compliance information.

Apple's current app-record instructions are at <https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/>.

## 7. Finish website association

Replace `APPLE_TEAM_ID` in `docs/ios/apple-app-site-association`, then publish it without a file extension at:

```text
https://ourlime.com/.well-known/apple-app-site-association
```

Serve it over HTTPS as JSON without a redirect. Test universal links on a physical iPhone. Apple's associated-domain guide is at <https://developer.apple.com/documentation/xcode/supporting-associated-domains>.

## 8. Membership completion checklist

- [ ] Organization enrollment approved and active
- [ ] Agreements accepted and annual renewal ownership assigned
- [ ] Team ID recorded securely
- [ ] Developer invited with an appropriate role
- [ ] App ID `com.ourlime.app` registered
- [ ] Associated Domains and Push Notifications enabled
- [ ] Signing works on a physical iPhone
- [ ] APNs key stored securely and configured in Firebase
- [ ] App Store Connect app record created
- [ ] Universal-link association file published with the real Team ID
- [ ] TestFlight build passes the repository release checklist
