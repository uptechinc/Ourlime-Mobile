export type MediaItem = {
    type: 'image' | 'video';
    url: string;
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
    description?: string; // Detailed description of the event
    tags?: string[];
}
