// types/userTypes.ts
//import { Timestamp } from "firebase/firestore";
import { CommunityVariantDetailsSummary } from "./communityTypes";

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
    //last_loggedIn: Timestamp;
    userTier: number;
    //createdAt: Timestamp;
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
    hashtags: Array<string>;
    media: string;
    type: string;
    userReferences: Array<string>;
    user: {
        firstName: string;
        lastName: string;
        userName: string;
        profileImage?: string;
    };
};

type BasePost = {
    id: string;
    title: string; // Add title
    caption: string; // Add caption
    content: string; // Add content
    visibility: string; // Add visibility
    createdAt: Date; // Add createdAt
    userId: string; // Add userId
    hashtags: Array<string>; // Add hashtags
    media: string; // Add media
    author: { // Add author object
        id: string;
        firstName: string;
		lastName: string;
        avatar: string;
        role: string;
		profileImage?: string;
    };
    timestamp: Date; // Add timestamp
	mediaDetails : CommunityVariantDetailsSummary[];
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
    media: {
        type: 'video';
        typeUrl: string;
        fileName: string;
        duration: number;
    };
    visibility: string;
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
    settings: Array<{
        id: string;
        contactId: string;
        setAs: string;
    }>;
}

type ContactSectionProps = {
    userData: UserData;
}

type AddressSectionProps = {
    userData: UserData;
}

type AboutItem = {
    id: string;
    type: 'interests' | 'skills';
    value: string;
    //createdAt: Timestamp;
}

export type {
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
    Reel
}
