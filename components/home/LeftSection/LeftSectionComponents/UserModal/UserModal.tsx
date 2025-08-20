import React from 'react';
import { View, Text, TouchableOpacity, Image, Modal, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { UserData } from '@/types/userTypes';
import { relationshipHelpers } from '@/helpers/relationshipHelpers';

interface UserModalProps {
    selectedUser: UserData;
    setShowUserModal: (value: boolean) => void;
    onAddFriend: () => Promise<void>;
    onFollow: () => Promise<void>;
    isFollowing: boolean;
    friendshipStatus: 'none' | 'pending' | 'accepted' | 'declined';
    isFollowLoading: boolean;
    isFriendLoading: boolean;
    isLoadingStats?: boolean;
    networkStats?: {
        posts: number;
        followers: number;
        following: number;
    };
    visible: boolean;
}

export const UserModal = ({
    selectedUser,
    setShowUserModal,
    onAddFriend,
    onFollow,
    isFollowing,
    friendshipStatus,
    isFollowLoading,
    isFriendLoading,
    isLoadingStats = false,
    networkStats = { posts: 0, followers: 0, following: 0 },
    visible,
}: UserModalProps) => {
    // Use relationshipHelpers for button text/variant
    const { text: followText, variant: followVariant } = relationshipHelpers.formatFollowButton(isFollowing);
    const { text: friendText, variant: friendVariant } = relationshipHelpers.formatRelationshipButton({
        isFriend: friendshipStatus === 'accepted',
        isFollowing,
        friendshipStatus,
        mutualFriends: 0,
        mutualFollowers: 0,
    });

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => setShowUserModal(false)}
        >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                <View style={{ width: '100%', maxWidth: 400, borderRadius: 20, backgroundColor: '#fff', padding: 16, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 10, position: 'relative' }}>
                    {/* Close Button */}
                    <TouchableOpacity
                        onPress={() => setShowUserModal(false)}
                        style={{ position: 'absolute', right: 8, top: 8, zIndex: 10, padding: 6, borderRadius: 20, backgroundColor: '#f3f4f6' }}
                    >
                        <Icon name="x" size={20} color="#9ca3af" />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center', marginTop: 16 }}>
                        {/* Profile Image */}
                        <View style={{ width: 80, height: 80, borderRadius: 40, overflow: 'hidden', borderWidth: 4, borderColor: '#bbf7d0', marginBottom: 12, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' }}>
                            {selectedUser?.profileImage ? (
                                <Image
                                    source={{ uri: selectedUser.profileImage }}
                                    style={{ width: 80, height: 80, borderRadius: 40 }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#10b981' }}>
                                    {selectedUser?.firstName?.charAt(0)}{selectedUser?.lastName?.charAt(0)}
                                </Text>
                            )}
                        </View>
                        {/* User Info */}
                        <Text style={{ fontWeight: 'bold', fontSize: 22, color: '#111827', marginBottom: 2 }}>{selectedUser?.firstName} {selectedUser?.lastName}</Text>
                        <Text style={{ color: '#10b981', fontWeight: '500', marginBottom: 12 }}>@{selectedUser?.userName}</Text>
                        {/* Stats */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', backgroundColor: '#f3f4f6', borderRadius: 16, padding: 12, marginBottom: 20 }}>
                            {isLoadingStats ? (
                                <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-around' }}>
                                    {[0, 1, 2].map((i) => (
                                        <View key={i} style={{ alignItems: 'center' }}>
                                            <View style={{ width: 48, height: 16, backgroundColor: '#e5e7eb', borderRadius: 6, marginBottom: 4 }} />
                                            <View style={{ width: 32, height: 12, backgroundColor: '#e5e7eb', borderRadius: 6 }} />
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <>
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#111827' }}>{networkStats.posts.toLocaleString()}</Text>
                                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Posts</Text>
                                    </View>
                                    <View style={{ width: 1, backgroundColor: '#e5e7eb', marginHorizontal: 8 }} />
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#111827' }}>{networkStats.followers.toLocaleString()}</Text>
                                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Followers</Text>
                                    </View>
                                    <View style={{ width: 1, backgroundColor: '#e5e7eb', marginHorizontal: 8 }} />
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <Text style={{ fontWeight: 'bold', fontSize: 18, color: '#111827' }}>{networkStats.following.toLocaleString()}</Text>
                                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Following</Text>
                                    </View>
                                </>
                            )}
                        </View>
                        {/* Action Buttons */}
                        <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                            <TouchableOpacity
                                onPress={onFollow}
                                disabled={isFollowLoading}
                                style={{ flex: 1, paddingVertical: 10, borderRadius: 14, backgroundColor: followVariant === 'primary' ? '#10b981' : '#f3f4f6', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
                                activeOpacity={0.8}
                            >
                                {isFollowLoading ? (
                                    <ActivityIndicator size="small" color={followVariant === 'primary' ? '#fff' : '#10b981'} />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                        {isFollowing && <Icon name="check-circle" size={18} color="#fff" style={{ marginRight: 6 }} />}
                                        <Text style={{ color: followVariant === 'primary' ? '#fff' : '#10b981', fontWeight: 'bold', fontSize: 15 }}>{followText}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={onAddFriend}
                                disabled={friendshipStatus === 'pending' || isFriendLoading}
                                style={{ flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 2, borderColor: friendVariant === 'primary' ? '#10b981' : friendVariant === 'secondary' ? '#e5e7eb' : '#f59e42', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', position: 'relative' }}
                                activeOpacity={0.8}
                            >
                                {isFriendLoading ? (
                                    <ActivityIndicator size="small" color="#10b981" />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                        {friendshipStatus === 'pending' && <Icon name="check-circle" size={18} color="#f59e42" style={{ marginRight: 6 }} />}
                                        {friendshipStatus === 'accepted' && <Icon name="users" size={18} color="#10b981" style={{ marginRight: 6 }} />}
                                        {friendshipStatus === 'none' && <Icon name="user-plus" size={18} color="#10b981" style={{ marginRight: 6 }} />}
                                        <Text style={{ color: friendVariant === 'primary' ? '#10b981' : friendVariant === 'secondary' ? '#111827' : '#f59e42', fontWeight: 'bold', fontSize: 15 }}>{friendText}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
