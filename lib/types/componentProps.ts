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

export type MenuUserProfile = {
    name: string;
    email: string;
    avatar?: string;
    firstName?: string;
    lastName?: string;
    userName?: string;
    profilePicture?: string | null;
};

export type SlideOutMenuProps = {
    isVisible: boolean;
    onClose: () => void;
    menuItems: MenuItem[];
    userProfile?: MenuUserProfile;
};

export type PageHeaderProps = {
    title: string;
    showBackButton?: boolean;
    onBackPress?: () => void;
    backgroundColor?: string;
    borderBottomColor?: string;
    rightComponent?: React.ReactNode;
}

// Message-related types
export * from './message';