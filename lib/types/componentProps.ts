export type ChatButtonState = {
    isMobile: boolean;
};

// Menu-related types
export type MenuItem = {
    id: string;
    title: string;
    icon: string;
    route?: Href;
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

export type AppDrawerState = 'closed' | 'opening' | 'open' | 'closing';

export type SlideOutMenuProps = {
    state: AppDrawerState;
    onClose: () => void;
    onOpened: () => void;
    onClosed: () => void;
    menuItems: MenuItem[];
    userProfile?: MenuUserProfile;
};

export type PageHeaderProps = {
    title: string;
    showBackButton?: boolean;
    onBackPress?: () => void;
    backgroundColor?: string;
    borderBottomColor?: string;
    rightComponent?: ReactNode;
}

// Message-related types
export * from './message';
import type { Href } from 'expo-router';
import type { ReactNode } from 'react';
