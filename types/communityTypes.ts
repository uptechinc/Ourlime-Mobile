import { BasePost } from "./userTypes";

export type CommunityVariantDetailsSummary = {
    id: string; // Document ID
    type: string; // Type of the media (e.g., 'image', 'video')
    typeUrl: string; // URL of the media
    communityVariantDetailsId: string; // Reference to the associated post
};

export type Community = {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    isPrivate: boolean;
    userId: string;
    categoryId: string;
    bannerImageUrl: string;
    topMembers: string[];
    creatorProfileImage?: string | null;
    creatorName: string;
    isMember: boolean;
    requestStatus: string;
    createdAt: Date;
    // createdAt: string;
    membershipCount: number;
    membershipLikes: number;
    members: string[];
    posts: BasePost[];
    isBanned: boolean;
}

export type CommunityMember = {
    userId: string;
    communityVariantId: string;
    status: 'active' | 'pending' | 'blocked';
    role: 'admin' | 'moderator' | 'member';
    joinedAt: string;
    profileImage: string;
    firstName: string;
    lastName: string;
    userName: string;
};

export type CommunityCategory = {
    id: string;
    name: string;
    description: string;
    icon: string;
};

export type CommunityPost = {
    id: string;
    communityVariantId: string;
    userId: string;
    content: string;
    media?: string[];
    createdAt: string;
    updatedAt: string;
};
