import React from 'react';
import { View, Text, TouchableOpacity, Image, Modal, ScrollView, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

interface User {
    id: string;
    firstName: string;
    lastName: string;
    userName: string;
    profileImage?: string;
}

interface LikesModalProps {
    isOpen: boolean;
    onClose: () => void;
    likedUsers: User[];
    onFollowClick: (userId: string) => void;
    onFriendRequestClick: (userId: string) => void;
    followingStatus: { [key: string]: boolean };
    friendshipStatus: { [key: string]: 'none' | 'pending' | 'accepted' | 'declined' };
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const LikesModal: React.FC<LikesModalProps> = ({
    isOpen,
    onClose,
    likedUsers,
    onFollowClick,
    onFriendRequestClick,
    followingStatus,
    friendshipStatus
}) => {
    return (
        <Modal
            visible={isOpen}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                <View style={{ width: SCREEN_WIDTH > 400 ? 400 : '100%', backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12 }}>
                    {/* Header */}
                    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#f0fdf4' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827' }}>Likes</Text>
                            <TouchableOpacity onPress={onClose} style={{ padding: 8, borderRadius: 9999 }}>
                                <Icon name="x" size={22} color="#6b7280" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {/* Users List */}
                    <ScrollView style={{ maxHeight: 400 }}>
                        {likedUsers.map((user) => (
                            <View key={user.id} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#bbf7d0', backgroundColor: '#e5e7eb', marginRight: 8 }}>
                                            <Image
                                                source={{ uri: user.profileImage || 'https://ui-avatars.com/api/?name=User' }}
                                                style={{ width: 40, height: 40, borderRadius: 20 }}
                                                resizeMode="cover"
                                            />
                                        </View>
                                        <View>
                                            <Text style={{ fontWeight: 'bold', color: '#111827', fontSize: 15 }}>{user.firstName} {user.lastName}</Text>
                                            <Text style={{ color: '#6b7280', fontSize: 13 }}>@{user.userName}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity
                                            onPress={() => onFollowClick(user.id)}
                                            style={{
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 9999,
                                                backgroundColor: followingStatus[user.id] ? '#f3f4f6' : '#10b981',
                                                marginRight: 4,
                                            }}
                                        >
                                            <Text style={{ color: followingStatus[user.id] ? '#374151' : '#fff', fontSize: 13 }}>
                                                {followingStatus[user.id] ? 'Following' : 'Follow'}
                                            </Text>
                                        </TouchableOpacity>
                                        {friendshipStatus[user.id] === 'none' && (
                                            <TouchableOpacity
                                                onPress={() => onFriendRequestClick(user.id)}
                                                style={{
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 6,
                                                    borderRadius: 9999,
                                                    backgroundColor: '#f3f4f6',
                                                }}
                                            >
                                                <Text style={{ color: '#374151', fontSize: 13 }}>Add Friend</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

export default LikesModal; 