export const SUPPORT_TICKET_CATEGORIES = ['account_access', 'technical_issue', 'privacy_security', 'billing_payments', 'content_community', 'jobs_marketplace', 'feature_feedback', 'other'] as const;
export type SupportTicketCategory = typeof SUPPORT_TICKET_CATEGORIES[number];
export type SupportTicketStatus = 'submitted' | 'assigned' | 'waiting_for_user' | 'waiting_for_staff' | 'resolved' | 'closed';
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type SupportTicketAction = 'claim' | 'transfer' | 'release' | 'internal_note' | 'set_priority' | 'resolve' | 'close' | 'reopen';
export type SupportTicketFilter = 'unassigned' | 'mine' | 'waiting' | 'urgent' | 'resolved' | 'all';

export type SupportStaffIdentity = { userId: string; displayName: string; roleLabel: 'Ourlime Support' };
export type SupportTicketAttachment = { id: string; fileName: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic'; byteSize: number; width: number; height: number; sha256: string; privateObjectKey: string; previewObjectKey: string; uploaderId: string; reviewState: 'available' | 'blocked' | 'removed'; createdAt: string };
export type CaseConversationMessage = { id: string; caseKind: 'support' | 'child_safety'; caseId: string; authorId: string; authorDisplayName: string; authorRole: 'requester' | 'guest' | 'support' | 'child_safety_reviewer'; text: string; attachments: SupportTicketAttachment[]; createdAt: string; deliveryState: 'sending' | 'sent' | 'failed' };
export type SupportTicketMessage = CaseConversationMessage & { caseKind: 'support' };
export type SupportTicket = { id: string; reference: string; category: SupportTicketCategory; subject: string; description: string; status: SupportTicketStatus; priority: SupportTicketPriority; requesterUserId: string | null; requesterEmail: string; requesterDisplayName: string; guestVerified: boolean; assignedStaffId: string | null; assignedStaff: SupportStaffIdentity | null; unreadByRequester: number; unreadByStaff: number; attachmentByteTotal: number; resolvedAt: string | null; reopenUntil: string | null; closedAt: string | null; createdAt: string; updatedAt: string };
export type SupportTicketCreateInput = { category: SupportTicketCategory; subject: string; description: string; requesterEmail?: string; requesterDisplayName?: string };
export type SupportTicketActionInput = { action: SupportTicketAction; reason: string; assignedStaffId?: string | null; priority?: SupportTicketPriority };
export type SupportTicketPage = { items: SupportTicket[]; nextCursor: string | null; hasMore: boolean };
export type SupportMessagePage = { items: SupportTicketMessage[]; nextCursor: string | null; hasMore: boolean };

export const SUPPORT_TICKET_CATEGORY_LABELS: Readonly<Record<SupportTicketCategory, string>> = {
  account_access: 'Account access', technical_issue: 'Technical issue', privacy_security: 'Privacy or security', billing_payments: 'Billing or payments', content_community: 'Content or community', jobs_marketplace: 'Jobs or Marketplace', feature_feedback: 'Feature feedback', other: 'Other',
};
