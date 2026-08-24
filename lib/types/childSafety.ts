export const CHILD_SAFETY_CATEGORIES = [
  'child_sexual_abuse_or_exploitation',
  'suspected_child_sexual_abuse_material',
  'grooming_or_predatory_behaviour',
  'sexualisation_of_a_minor',
  'sextortion_involving_a_minor',
  'solicitation_of_sexual_content_from_a_minor',
  'inappropriate_adult_to_minor_communication',
  'suspected_trafficking_or_exploitation',
  'threats_or_harm_against_a_child',
  'bullying_or_harassment_of_a_minor',
  'sharing_a_childs_private_or_sensitive_information',
  'suspicious_account_behaviour_involving_minors',
  'other_child_safety_concern',
] as const;

export type ChildSafetyCategory = typeof CHILD_SAFETY_CATEGORIES[number];
export type ChildSafetyDangerAnswer = 'yes' | 'no' | 'unsure';
export type ChildSafetyStatus = 'submitted' | 'under_review' | 'escalated' | 'action_required' | 'resolved' | 'reported_to_authority' | 'closed';
export type ChildSafetyPriority = 'critical' | 'high' | 'medium' | 'standard';
export type ChildSafetyTargetType = 'profile' | 'post' | 'media' | 'comment' | 'reply' | 'message' | 'conversation' | 'lime' | 'community' | 'event' | 'marketplace_listing' | 'course' | 'blog' | 'other';
export type ChildSafetyAction = 'assign' | 'claim' | 'transfer' | 'release' | 'note' | 'set_priority' | 'set_status' | 'set_contact' | 'escalate' | 'moderation_action' | 'authority_referral' | 'resolve' | 'preserve' | 'release_legal_hold' | 'purge';

export type ReportedAccountReference = {
  userId: string;
  userName: string;
  displayName: string;
  profileImage: string | null;
  primary: boolean;
};

export type ChildSafetyIncidentDetails = {
  occurredAt: string;
  ongoing: boolean;
  communicationChannel: 'ourlime' | 'in_person' | 'phone_text' | 'external_platform' | 'unknown' | 'other';
  approximateChildAgeRange: 'under_5' | '5_8' | '9_12' | '13_15' | '16_17' | 'unknown';
  reporterRelationship: 'self' | 'parent_guardian' | 'family_friend' | 'educator_professional' | 'bystander' | 'unknown' | 'other';
  continuedContactRisk: 'yes' | 'no' | 'unsure';
};

export type ChildSafetyAttachment = {
  id: string;
  fileName: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
  privateOriginalObjectKey: string;
  previewObjectKey: string;
  uploaderId: string;
  reviewState: 'available' | 'blocked' | 'preserved' | 'removed';
  createdAt: string;
};

export type ChildSafetyMessage = {
  id: string;
  caseKind: 'child_safety';
  caseId: string;
  authorId: string;
  authorDisplayName: string;
  authorRole: 'requester' | 'child_safety_reviewer';
  text: string;
  attachments: ChildSafetyAttachment[];
  createdAt: string;
  deliveryState: 'sending' | 'sent' | 'failed';
};

export type ChildSafetyReportTarget = {
  type: ChildSafetyTargetType;
  id: string;
  ownerUserId?: string;
  routePath?: string;
  parentId?: string;
};

export type ChildSafetyReportInput = {
  category: ChildSafetyCategory;
  description: string;
  immediateDanger: ChildSafetyDangerAnswer;
  goodFaithAcknowledged: boolean;
  allowContact: boolean;
  target: ChildSafetyReportTarget;
  additionalTargets?: ChildSafetyReportTarget[];
  reportedAccounts?: ReportedAccountReference[];
  incidentDetails?: ChildSafetyIncidentDetails;
  attachmentIds?: string[];
  evidenceContainsNoSuspectedCsam?: boolean;
};

export type ChildSafetyIntakeValues = {
  immediateDanger: ChildSafetyDangerAnswer;
  goodFaithAcknowledged: boolean;
  allowContact: boolean;
};

export type ChildSafetyAuditEntry = {
  id: string;
  action: ChildSafetyAction | 'submitted' | 'migrated';
  actorUserId: string;
  note: string;
  createdAt: string;
  previousStatus?: ChildSafetyStatus;
  nextStatus?: ChildSafetyStatus;
  previousPriority?: ChildSafetyPriority;
  nextPriority?: ChildSafetyPriority;
};

export type ChildSafetyReportRecord = {
  id: string;
  reference: string;
  reporterUserId: string;
  category: ChildSafetyCategory;
  description: string;
  immediateDanger: ChildSafetyDangerAnswer;
  allowContact: boolean;
  target: ChildSafetyReportTarget;
  additionalTargets: ChildSafetyReportTarget[];
  reportedAccounts: ReportedAccountReference[];
  incidentDetails: ChildSafetyIncidentDetails | null;
  attachments: ChildSafetyAttachment[];
  status: ChildSafetyStatus;
  priority: ChildSafetyPriority;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  threadId: string;
  unreadByReporter: number;
  unreadByReviewer: number;
  attachmentByteTotal: number;
  legalHold: boolean;
  sourceReportId: string | null;
  createdAt: string;
  updatedAt: string;
  audit?: ChildSafetyAuditEntry[];
};

export type ChildSafetyMessagePage = {
  items: ChildSafetyMessage[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type ChildSafetyCaseActionInput = {
  action: ChildSafetyAction;
  note: string;
  status?: ChildSafetyStatus;
  priority?: ChildSafetyPriority;
  assignedReviewerId?: string | null;
  authorityName?: string;
  authorityReference?: string;
  allowContact?: boolean;
};

export const CHILD_SAFETY_CATEGORY_LABELS: Readonly<Record<ChildSafetyCategory, string>> = {
  child_sexual_abuse_or_exploitation: 'Child Sexual Abuse or Exploitation (CSAE)',
  suspected_child_sexual_abuse_material: 'Suspected Child Sexual Abuse Material (CSAM)',
  grooming_or_predatory_behaviour: 'Grooming or Predatory Behaviour',
  sexualisation_of_a_minor: 'Sexualisation of a Minor',
  sextortion_involving_a_minor: 'Sextortion involving a Minor',
  solicitation_of_sexual_content_from_a_minor: 'Solicitation of Sexual Content from a Minor',
  inappropriate_adult_to_minor_communication: 'Inappropriate Adult-to-Minor Communication',
  suspected_trafficking_or_exploitation: 'Suspected Trafficking or Exploitation',
  threats_or_harm_against_a_child: 'Threats or Harm Against a Child',
  bullying_or_harassment_of_a_minor: 'Bullying or Harassment of a Minor',
  sharing_a_childs_private_or_sensitive_information: "Sharing a Child's Private or Sensitive Information",
  suspicious_account_behaviour_involving_minors: 'Suspicious Account Behaviour involving Minors',
  other_child_safety_concern: 'Other Child Safety Concern',
};
