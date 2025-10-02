import React from 'react';
import { View, ScrollView } from 'react-native';
import { SearchUser } from '@/types/userTypes';
import { ProfileSection } from './LeftSectionComponents/ProfileSection/ProfileSection';
import { UserListSection } from './LeftSectionComponents/UserListSection/UserListSection';

interface LeftSectionProps {
    onUserSelect: (user: SearchUser) => void;
}

export const LeftSection = ({ onUserSelect }: LeftSectionProps) => {
    return (
        <View
            style={{
                backgroundColor: '#fff',
                borderRadius: 16,
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
                padding: 12,
                flex: 1,
                minHeight: 0,
                maxHeight: '100%',
                width: '100%',
                overflow: 'hidden',
            }}
        >
            <View style={{ flex: 1, flexDirection: 'column', height: '100%' }}>
                {/* Static Profile Section */}
                <View style={{ flexShrink: 0 }}>
                    <ProfileSection />
                </View>
                {/* Scrollable User List Section */}
                <View style={{ flex: 1, minHeight: 0 }}>
                    <UserListSection
                        handleUserClick={onUserSelect}
                        setIsUserModalVisible={() => {}}
                    />
                </View>
            </View>
        </View>
    );
};

export default LeftSection;
