export type MediaItem = {
    type: 'image' | 'video';
    url: string;
};

export type EventPermissionSet = {
    canEdit: boolean;
    canDelete: boolean;
};

export type Event = {
    id?: string; // Optional ID for the event, useful for Firestore documents
    title: string; // Title of the event
    summary: string; // Description of the event
    startDate: string; // Start date of the event
    endDate: string; // End date of the event
    time?: string; // Optional time of the event
    image?: string;
    location: string;
    userId: string;
    likeCount: number;
    recurrence: string;
    category?: string; // Category of the event
    communityVariantId?: string; // ID of the community if this is a community event
    media?: MediaItem[]; // Media items for the event
    userRSVP?: boolean; // Whether the current user has RSVP'd
    attendeeCount?: number;
    permissions?: EventPermissionSet;
    description?: string; // Detailed description of the event
    tags?: string[];
    createdAt?: string;
    status?: EventStatus;
    publishAt?: string | null;
    isVirtual?: boolean;
    virtualLink?: string;
    isFree?: boolean;
    ticketPrice?: number | null;
    accessibility?: string[];
    address?: string;
    lat?: number | null;
    lng?: number | null;
    capacity?: number | null;
    ageRestriction?: number | null;
    coOrganizers?: CoOrganizer[];
    registrationQuestions?: RegistrationQuestion[];
    isFeatured?: boolean;
    /** Organiser display details (name, photo, identity verified), filled in for listings like the website's fetchEvents. */
    organizer?: { name: string; userName: string | null; image: string | null; verified: boolean };
};

/** Same statuses as the website's types/eventTypes EventStatus. */
export type EventStatus = 'draft' | 'scheduled' | 'published' | 'sold_out' | 'cancelled' | 'completed' | 'archived' | 'removed';

export type RegistrationQuestionType = 'text' | 'radio' | 'checkbox' | 'select';

export type RegistrationQuestion = {
    id: string;
    question: string;
    type: RegistrationQuestionType;
    required: boolean;
    options?: string[];
};

export type RegistrationAnswerValue = string | string[] | boolean;
export type RegistrationAnswers = { [questionId: string]: RegistrationAnswerValue };

export type CoOrganizerPermission = 'manage_discussions' | 'manage_reviews' | 'manage_attendance';

export type CoOrganizer = {
    userId: string;
    name?: string;
    userName?: string;
    image?: string;
    permissions: CoOrganizerPermission[];
};
