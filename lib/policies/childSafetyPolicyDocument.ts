export type PolicyItem = {
    kind: 'paragraph' | 'list-item';
    text: string;
};

export type PolicySection = {
    number: string;
    title: string;
    items: PolicyItem[];
};

export type PolicyDocument = {
    id: string;
    title: string;
    effectiveDate: string;
    lastUpdated: string;
    sections: PolicySection[];
};

const paragraph = (text: string): PolicyItem => ({ kind: 'paragraph', text });
const listItem = (text: string): PolicyItem => ({ kind: 'list-item', text });

export const childSafetyPolicyDocument: PolicyDocument = {
    id: 'child-safety-standards-policy',
    title: 'Ourlime Communities Network Child Safety Standards Policy',
    effectiveDate: '20th August 2026',
    lastUpdated: '21st August 2026',
    sections: [
        {
            number: '1.',
            title: 'Zero Tolerance for Child Sexual Abuse and Exploitation',
            items: [
                paragraph('Ourlime Communities Network strictly prohibits Child Sexual Abuse and Exploitation (CSAE) and Child Sexual Abuse Material (CSAM).'),
                paragraph('Ourlime, displayed on Google Play as “Ourlime,” is the Ourlime Communities Network application operated by Uptech Incorporated Ltd. Ourlime does not permit users to create, upload, store, distribute, transmit, request, solicit, advertise, promote, facilitate, encourage, or otherwise engage in content or behaviour that sexually exploits, abuses, or endangers children.'),
                paragraph('These standards apply throughout Ourlime, including profiles, posts, comments, Communities, private and group messaging, voice and video communication, Limes, Events, Jobs, Marketplace, E-Learning, E-Projects, E-Hub, E-Library, and all other current or future Ourlime services.'),
            ],
        },
        {
            number: '2.',
            title: 'Child Sexual Abuse and Exploitation (CSAE)',
            items: [
                paragraph('For this Policy, CSAE includes content or behaviour that sexually exploits, abuses, or endangers a person under 18.'),
                ...['Child sexual abuse and Child Sexual Abuse Material (CSAM);', 'Grooming a child for sexual purposes;', 'Sexualization or sextortion of a child;', 'Soliciting sexual or intimate material from a child;', 'Child trafficking for sexual exploitation;', 'Predatory sexual behaviour directed toward children;', 'Offering money, gifts, employment, opportunities, or benefits in exchange for sexual activity or sexual content involving a child;', 'Facilitating online or offline sexual contact with a child.'].map(listItem),
                paragraph('All such conduct is prohibited on Ourlime.'),
            ],
        },
        {
            number: '3.',
            title: 'Child Sexual Abuse Material (CSAM)',
            items: [
                paragraph('Ourlime strictly prohibits CSAM. Users must not create, upload, post, send, store, request, obtain, advertise, sell, trade, distribute, link to, or otherwise make CSAM available through Ourlime.'),
                paragraph('This prohibition includes photographs, videos, illustrations, manipulated images, synthetic content, computer-generated imagery, AI-generated material, and other prohibited visual depictions involving the sexual exploitation or abuse of children.'),
                paragraph('Users must not download, copy, forward, upload, email, or otherwise redistribute suspected CSAM in order to report it. Ourlime reporting tools retain the relevant content or account identifier so moderators can locate the original material.'),
            ],
        },
        {
            number: '4.',
            title: 'Grooming and Predatory Behaviour',
            items: [
                paragraph('Users must not use Ourlime to establish or develop a relationship with a child for sexual abuse or exploitation.'),
                ...['Directing sexual conversations toward children;', 'Requesting intimate or sexual images from children;', 'Encouraging sexual behaviour;', 'Attempting to arrange sexual contact with a child;', 'Moving conversations to another service for sexual exploitation;', 'Offering gifts, money, employment, rewards, or opportunities in exchange for sexual content or activity.'].map(listItem),
            ],
        },
        {
            number: '5.',
            title: 'Sextortion',
            items: [paragraph('Ourlime prohibits threatening, blackmailing, manipulating, or coercing a child using real, alleged, fabricated, or manipulated intimate material, including demands for money, additional imagery, sexual activity, communication, or any other action.')],
        },
        {
            number: '6.',
            title: 'Child Trafficking and Commercial Sexual Exploitation',
            items: [paragraph('Ourlime must not be used to advertise, recruit, solicit, transport, promote, facilitate, arrange, or participate in the trafficking or commercial sexual exploitation of children. This applies to Jobs, Marketplace, Communities, Events, messaging, profiles, posts, advertisements, and all other user-generated content.')],
        },
        {
            number: '7.',
            title: 'In-App Reporting',
            items: [
                paragraph('Ourlime provides an in-app mechanism for reporting safety concerns and prohibited content without requiring users to leave the app. Users can report relevant content, accounts, messages, Communities, Marketplace listings, Jobs, Events, and other activity.'),
                ...['Child Sexual Abuse and Exploitation (CSAE);', 'Child Sexual Abuse Material (CSAM);', 'Grooming or inappropriate contact with a minor;', 'Sextortion;', 'Child trafficking or exploitation;', 'Sexualization of a minor;', 'Other threats to the safety of a child.'].map(listItem),
                paragraph('Child-safety reports are marked for priority review and retain the reported item identifier. Users may also contact the Ourlime Child Safety Unit using the details in this Policy.'),
            ],
        },
        {
            number: '8.',
            title: 'Action Taken by Ourlime',
            items: [
                paragraph('When Ourlime obtains actual knowledge of CSAM or prohibited CSAE activity, Ourlime will act according to these standards and applicable law. Ourlime will not knowingly allow confirmed CSAM to remain available where removal is legally and technically possible.'),
                ...['Remove or disable access to prohibited content;', 'Restrict, suspend, or permanently terminate accounts;', 'Restrict messaging, Communities, Marketplace, Jobs, Events, or other functionality;', 'Review related activity for additional safety risks;', 'Preserve relevant records where required or permitted by law;', 'Cooperate with lawful investigations;', 'Report qualifying child-safety incidents to appropriate authorities where required by law.'].map(listItem),
            ],
        },
        {
            number: '9.',
            title: 'Reporting Confirmed CSAM and Child Exploitation',
            items: [
                paragraph('Uptech Incorporated Ltd. maintains procedures intended to comply with applicable child-safety laws and reporting obligations. Confirmed CSAM or other qualifying child exploitation will be reported to the appropriate authority where required by applicable law.'),
                ...['The National Center for Missing & Exploited Children (NCMEC), where applicable;', "The Children's Authority of Trinidad and Tobago;", 'The Trinidad and Tobago Police Service or its relevant investigative unit;', 'Other competent law-enforcement, child-protection, or applicable regional authorities.'].map(listItem),
            ],
        },
        {
            number: '10.',
            title: 'Trinidad and Tobago Child Protection',
            items: [
                paragraph("Concerns relating to child abuse in Trinidad and Tobago may be reported to the Children's Authority of Trinidad and Tobago, which receives and investigates reports concerning children's safety and welfare."),
                listItem('24-hour hotline: 996 or 800-2014;'),
                listItem('Reporting email: Registry@ttchildren.org;'),
                listItem('Online reporting: https://ttchildren.org/report-child-abuse/'),
                paragraph('Where criminal or online activity is involved, matters may also be referred to the appropriate law-enforcement authority. Ourlime is not an emergency service and its reporting process does not replace emergency, police, or child-protection services.'),
            ],
        },
        {
            number: '11.',
            title: 'Child Safety Point of Contact',
            items: [
                paragraph('Organization: Uptech Incorporated Ltd.'),
                paragraph('Application: Ourlime Communities Network'),
                paragraph('Child Safety Contact: Ourlime Child Safety Unit'),
                paragraph('Email: ourlimechildsafety@gmail.com'),
                paragraph('Country: Trinidad and Tobago'),
                paragraph("This designated contact receives notifications from Google Play and competent authorities concerning CSAE or CSAM and is positioned to address Ourlime's prevention, enforcement, and review procedures and take action when required."),
            ],
        },
        {
            number: '12.',
            title: 'Reporting a Child Safety Concern to Ourlime',
            items: [
                paragraph("Use Ourlime's in-app reporting functionality whenever possible. Child-safety concerns may also be submitted to the Ourlime Child Safety Unit at ourlimechildsafety@gmail.com."),
                paragraph('Include enough information to locate the relevant content or account, such as a username, content identifier, Community name, post identifier, or incident description. Do not download, copy, forward, email, upload, or redistribute suspected CSAM to report it.'),
            ],
        },
        {
            number: '13.',
            title: 'Immediate Danger',
            items: [paragraph('If a child appears to be in immediate danger, contact the appropriate emergency service, police service, or child-protection authority in your jurisdiction.')],
        },
        {
            number: '14.',
            title: 'Enforcement',
            items: [paragraph('Violations may result in content removal, feature restrictions, account suspension, permanent termination, preservation of relevant records, referral to competent authorities, and other appropriate safety or legal action. Serious violations involving CSAM, grooming, sextortion, trafficking, or sexual exploitation may result in immediate permanent termination without warning.')],
        },
        {
            number: '15.',
            title: 'Related Ourlime Policies',
            items: [paragraph("This Policy should be read with Ourlime's Community Guidelines, Safety Policy, Terms and Conditions, Privacy Policy, Marketplace Policy, and other applicable policies. No other Ourlime policy authorizes conduct prohibited here.")],
        },
        {
            number: '16.',
            title: 'Policy Updates and Contact Information',
            items: [
                paragraph('Uptech Incorporated Ltd. may update these standards to reflect changes to Ourlime, applicable laws, regulatory requirements, safety practices, or platform requirements. The Last Updated date identifies the current version.'),
                paragraph('Uptech Incorporated Ltd. | Ourlime Communities Network | Trinidad and Tobago'),
                paragraph('Child Safety Contact: Ourlime Child Safety Unit'),
                paragraph('Child Safety Email: ourlimechildsafety@gmail.com'),
                paragraph('Website: https://www.ourlime.com'),
            ],
        },
    ],
};
