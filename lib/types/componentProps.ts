export type ChatButtonState = {
    isMobile: boolean;
};

// Menu-related types
export type MenuItem = {
    id: string;
    title: string;
    icon: string;
    route?: string;
    onPress?: () => void;
    badge?: string | number;
    isDivider?: boolean;
};

export type UserProfile = {
    name: string;
    email: string;
    avatar?: string;
};

export type SlideOutMenuProps = {
    isVisible: boolean;
    onClose: () => void;
    menuItems: MenuItem[];
    userProfile?: UserProfile;
};

// Message-related types
export * from './message';