import type { PolicyDocument } from '@/lib/policies/childSafetyPolicyDocument';

export const privacyPolicyDocument: PolicyDocument = {
    id: 'privacy-policy',
    title: 'Privacy Policy',
    effectiveDate: 'August 17, 2026',
    lastUpdated: 'August 17, 2026',
    sections: [
        { number: '1.', title: 'About this policy', items: [{ kind: 'paragraph', text: 'This policy explains how Ourlime Communities Network ("Ourlime," "we," "us," or "our") collects, uses, shares, protects, and retains information when you use our website, mobile application, and related services.' }] },
        { number: '2.', title: 'Information we collect', items: [
            { kind: 'list-item', text: 'Account and profile information: name, username, email address, phone number, date of birth, profile details, and account preferences.' },
            { kind: 'list-item', text: 'Verification information: photos, government-issued identification, or other documents you choose or are required to submit for identity, age, or account verification.' },
            { kind: 'list-item', text: 'Content and communications: posts, photos, videos, comments, messages, reports, advertisements, and other content you create or share.' },
            { kind: 'list-item', text: 'Activity and connections: follows, friendships, communities, reactions, saved items, searches, and interactions with content and other users.' },
            { kind: 'list-item', text: 'Device and usage information: IP address, browser and device type, operating system, app version, identifiers, log data, crash information, and approximate location derived from IP.' },
            { kind: 'list-item', text: 'Information from third parties: information received when you use a connected sign-in provider, payment provider, analytics service, or another integrated service.' },
        ] },
        { number: '3.', title: 'How we use your information', items: [
            { kind: 'list-item', text: 'Provide, operate, personalize, and improve Ourlime.' },
            { kind: 'list-item', text: 'Create and manage accounts, authenticate users, and process verification.' },
            { kind: 'list-item', text: 'Enable social, community, marketplace, learning, advertising, and communication features.' },
            { kind: 'list-item', text: 'Send service messages, security alerts, support responses, and communications you request.' },
            { kind: 'list-item', text: 'Measure performance, understand feature usage, troubleshoot errors, and develop new features.' },
            { kind: 'list-item', text: 'Detect fraud, abuse, security threats, and violations of our terms or community rules.' },
            { kind: 'list-item', text: 'Comply with law and protect the rights, safety, and integrity of Ourlime, our users, and others.' },
        ] },
        { number: '4.', title: 'How we share information', items: [
            { kind: 'paragraph', text: 'We do not sell your personal information. We may share information with other users according to your settings, with service providers, for legal and safety reasons, during business transactions, or with your direction and consent.' },
        ] },
        { number: '5.', title: 'Security', items: [{ kind: 'paragraph', text: 'We use technical, administrative, and organizational safeguards designed to protect information against unauthorized access, loss, misuse, or alteration. No internet service can guarantee absolute security.' }] },
        { number: '6.', title: 'Data retention and deletion', items: [{ kind: 'paragraph', text: 'We retain information for as long as needed to provide Ourlime, maintain security and business records, resolve disputes, enforce agreements, and meet legal obligations. To request deletion, use the account controls in Ourlime or email ourlimeadmin@gmail.com.' }] },
        { number: '7.', title: 'Your choices and rights', items: [{ kind: 'paragraph', text: 'Depending on where you live, you may have rights to access, correct, delete, restrict, or obtain a copy of your information, or object to certain processing.' }] },
        { number: '8.', title: "Children's privacy", items: [{ kind: 'paragraph', text: 'Ourlime is not intended for children under 13. Users between 13 and the age of legal majority where they live must have permission from a parent or legal guardian when required.' }] },
        { number: '9.', title: 'International processing', items: [{ kind: 'paragraph', text: 'Information may be processed and stored in countries other than the one where you live. Where required, we use appropriate safeguards for international transfers.' }] },
        { number: '10.', title: 'Changes to this policy', items: [{ kind: 'paragraph', text: 'We may update this policy as Ourlime changes or as required by law. We will post the revised policy here and update the date above.' }] },
        { number: '11.', title: 'Contact us', items: [{ kind: 'paragraph', text: 'For privacy questions or requests, contact Ourlime Communities Network at ourlimeadmin@gmail.com.' }] },
    ],
};
