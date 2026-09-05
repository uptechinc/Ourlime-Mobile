// types/userTypes.ts
import { Timestamp } from "firebase/firestore";
import { CommunityVariantDetailsSummary } from "./communityTypes";


type Users = {
    id: string;
    firstName: string;
    lastName: string;
    userName: string;
    email: string;
    emailVerified: boolean;
    bio?: string;
    birthday?: string;
    country?: string;
    gender?: string;
    isAdmin: boolean;
    userTier: number;
    onlineStatus: string;
    createdAt: unknown;
    last_loggedIn: unknown;
    profileImage?: string;
    profileImageId?: string;
    isAuthenticated?: boolean;
    accountStatus?: 'active' | 'pending' | 'suspended' | 'banned';
    role?: 'user' | 'premium' | 'moderator' | 'tester' | 'admin' | 'developer';
    _aboutData?: {
        interests: string[];
        skills: string[];
        education: unknown[];
        work: unknown[];
        [key: string]: unknown;
    };
    _authData?: {
        faceID: boolean;
        frontID: boolean;
        backID: boolean;
        allVerified: boolean;
        faceIDURL?: string;
        frontIDURL?: string;
        backIDURL?: string;
        faceIDVerified?: boolean;
        frontIDVerified?: boolean;
        backIDVerified?: boolean;
    };
};

type UserData = {
    id: string;
    firstName: string;
    lastName: string;
    userName: string;
    email: string;
    gender: string;
    birthday: string;
    country: string;
    isAdmin: boolean;
    last_loggedIn: Timestamp;
    userTier: number;
    createdAt: Timestamp;
    bio?: string;
    profileImage?: string;
    profileImages?: {
        [key: string]: string;
    };
    friendsCount?: number;
    postsCount?: number;
    followingCount?: number;    

    onlineStatus?: string;
    accountSettings?: {
        activityStatus?: boolean;
        emailNotifications?: boolean;
        profileVisibility?: string;
        // Add other account settings in the future
    };
};

type ProfileImage = {
    id: string;
    imageURL: string;
    userId: string;
    typeOfImage: string;
    createdAt: Date;
    updatedAt: Date;
};

type ProfileImageSetAs = {
    id: string;
    userId: string;
    profileImageId: string;
    setAs: 'profile' | 'coverProfile' | 'postProfile' | 'jobProfile';
};

type SearchUser = {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
};

type Post = {
    id: string;
    caption: string;
    description: string;
    visibility: string;
    createdAt: Date;
    userId: string;
    hashtags: string[];
    media: {
        type: 'image' | 'video';
        typeUrl: string;
        fileName?: string;
        feedsPostId?: string;
        id?: string;
    }[];
    type: string;
    userReferences: string[];
    user: {
        firstName: string;
        lastName: string;
        userName: string;
        profileImage?: string;
        emailVerified?: boolean;
        isAdmin?: boolean;
    };
    stats?: {
        likes: number;
        comments: number;
        shares: number;
    };
    likedUsers?: {
        id: string;
        firstName: string;
        lastName: string;
        profileImage?: string;
    }[];
    mentions?: string[];
    friendReferences?: string[];
};

type BasePost = {
    id: string;
    title: string;
    caption: string;
    content: string;
    visibility: string;
    createdAt: Date;
    userId: string;
    hashtags: string[];
    media: string;
    author: {
        id: string;
        firstName: string;
        lastName: string;
        avatar: string;
        role: string;
        profileImage?: string;
    };
    timestamp: Date;
    mediaDetails: CommunityVariantDetailsSummary[];
    commentCount?: number;
};

type PostData = {
    userId: string;
    caption: string;
    description: string;
    createdAt: Date;
    visibility: string;
};

type Reel = {
    id: string;
    userId: string;
    thumbnailUrl?: string;
    media: {
        type: 'video' | 'image';
        typeUrl: string;
        fileName: string;
        duration: number;
        thumbnailUrl?: string;
    };
    visibility: string;
    category?: string;
    caption?: string;
    createdAt: Date;
    user: {
        firstName: string;
        lastName: string;
        userName: string;
        profileImage?: string;
    };
    stats?: {
        likes: number;
        comments: number;
        shares: number;
        reposts?: number;
    };
    likes?: string[];
    comments?: Comment[];
    repostedFrom?: {
        reelId?: string;
        postId?: string;
        userId: string;
        userName: string;
        firstName: string;
        lastName: string;
        profileImage?: string;
    };
    isRepost?: boolean;
    repostedBy?: {
        userId: string;
        userName: string;
        firstName: string;
        lastName: string;
        profileImage?: string;
    }[];
    repostedByViewer?: boolean;
    reposts?: string[];
    status?: string;
    isDeleted?: boolean;
};

type Comment = {
    id: string;
    userId: string;
    reelId: string;
    content: string;
    createdAt: Date;
    user?: {
        id: string;
        userName: string;
        profileImage?: string;
    };
};

type AppUser = {
    id: string;
    firstName: string;
    lastName: string;
    userName: string;
    profileImage?: string;
};

type Contact = {
    id: string;
    contactNumber: string;
    createdAt: Date;
    isVerified: boolean;
    updatedAt: Date;
    userId: string;
    settings: {
        id: string;
        contactId: string;
        setAs: string;
    }[];
};

type ContactSectionProps = {
    userData: UserData;
};

type AddressSectionProps = {
    userData: UserData;
};

type AboutItem = {
    id: string;
    type: 'interests' | 'skills';
    value: string;
    createdAt: Timestamp;
};

type UserMinimal = {
    id: string;
    userName?: string | null;
    displayName?: string | null;
    profileImage?: string | null;
};

export type {
    Users,
    UserData,
    ProfileImage,
    ProfileImageSetAs,
    SearchUser,
    Post,
    BasePost,
    PostData,
    AppUser,
    Contact,
    ContactSectionProps,
    AddressSectionProps,
    AboutItem,
    Reel,
    UserMinimal,
    Comment
};
