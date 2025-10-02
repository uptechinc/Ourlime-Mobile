import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

interface SearchUser {
    id: string;
    firstName: string;
    lastName: string;
    userName: string;
    profileImage?: string;
}

interface UserListSectionProps {
    handleUserClick: (user: SearchUser) => void;
    setIsUserModalVisible: (value: boolean) => void;
}

const TabButton = ({ active, onPress, children }: { active: boolean; onPress: () => void; children: React.ReactNode }) => (
    <TouchableOpacity
        onPress={onPress}
        style={{ flex: 1, paddingVertical: 10, borderBottomWidth: active ? 2 : 0, borderBottomColor: active ? '#10b981' : 'transparent' }}
    >
        <Text style={{ color: active ? '#10b981' : '#6b7280', fontWeight: 'bold', textAlign: 'center', fontSize: 15 }}>{children}</Text>
    </TouchableOpacity>
);

export const UserListSection = ({ handleUserClick, setIsUserModalVisible }: UserListSectionProps) => {
    // Placeholder data for demonstration
    const currentUserId = 'TODO_USER_ID';
    const [activeTab, setActiveTab] = useState<'friends' | 'followers' | 'discover'>('discover');
    const [displayUsers, setDisplayUsers] = useState<SearchUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchInput, setSearchInput] = useState('');
    const [unfriendingUserId, setUnfriendingUserId] = useState<string | null>(null);
    const [countdown, setCountdown] = useState(5);
    const [unfriendTimer, setUnfriendTimer] = useState<NodeJS.Timeout | null>(null);
    const [followingUserId, setFollowingUserId] = useState<string | null>(null);
    const [allUsers, setAllUsers] = useState<SearchUser[]>([]);

    // Simulate fetching users
    useEffect(() => {
        setIsLoading(true);
        setTimeout(() => {
            const users: SearchUser[] = [
                { id: '1', firstName: 'Alice', lastName: 'Smith', userName: 'alicesmith', profileImage: undefined },
                { id: '2', firstName: 'Bob', lastName: 'Brown', userName: 'bobbrown', profileImage: undefined },
                { id: '3', firstName: 'Charlie', lastName: 'Johnson', userName: 'charliej', profileImage: undefined },
            ];
            setDisplayUsers(users);
            setAllUsers(users);
            setIsLoading(false);
        }, 500);
    }, [activeTab]);

    const handleSearch = useCallback(() => {
        if (!searchInput.trim()) {
            setDisplayUsers(allUsers);
            return;
        }
        const filtered = allUsers.filter(user =>
            user.userName?.toLowerCase().includes(searchInput.toLowerCase()) ||
            user.firstName?.toLowerCase().includes(searchInput.toLowerCase()) ||
            user.lastName?.toLowerCase().includes(searchInput.toLowerCase())
        );
        setDisplayUsers(filtered);
    }, [searchInput, allUsers]);

    useEffect(() => {
        handleSearch();
    }, [handleSearch]);

    // handle user click and start a countdown timer of 5 seconds
    const startUnfriendCountdown = (userId: string) => {
        setUnfriendingUserId(userId);
        setCountdown(5);
        if (unfriendTimer) {
            clearInterval(unfriendTimer);
        }
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setUnfriendingUserId(null);
                    return 5;
                }
                return prev - 1;
            });
        }, 1000);
        setUnfriendTimer(timer as any);
    };

    const cancelUnfriend = () => {
        if (unfriendTimer) {
            clearInterval(unfriendTimer);
            setUnfriendTimer(null);
        }
        setUnfriendingUserId(null);
        setCountdown(5);
    };

    // handle follow back
    const handleFollowBack = (userId: string) => {
        setFollowingUserId(userId);
        setTimeout(() => {
            setDisplayUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
            setAllUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
            setFollowingUserId(null);
        }, 1000);
    };

    useEffect(() => {
        return () => {
            if (unfriendTimer) {
                clearInterval(unfriendTimer);
            }
        };
    }, [unfriendTimer]);

    return (
        <View style={{ flex: 1, flexDirection: 'column', height: '100%' }}>
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginBottom: 12, backgroundColor: '#fff' }}>
                <TabButton active={activeTab === 'friends'} onPress={() => setActiveTab('friends')}>Friends</TabButton>
                <TabButton active={activeTab === 'followers'} onPress={() => setActiveTab('followers')}>Followers</TabButton>
                <TabButton active={activeTab === 'discover'} onPress={() => setActiveTab('discover')}>Discover</TabButton>
            </View>
            <View style={{ position: 'relative', marginBottom: 8, backgroundColor: '#fff', paddingHorizontal: 8 }}>
                <TextInput
                    placeholder={`Search ${activeTab}...`}
                    style={{ width: '100%', paddingLeft: 32, paddingRight: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 15, backgroundColor: '#fff' }}
                    value={searchInput}
                    onChangeText={setSearchInput}
                />
                <Icon name="search" size={16} color="#9ca3af" style={{ position: 'absolute', left: 16, top: 14 }} />
            </View>
            <ScrollView style={{ flex: 1, paddingHorizontal: 8 }} contentContainerStyle={{ paddingBottom: 24 }}>
                {isLoading ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', height: 200 }}>
                        <ActivityIndicator size="large" color="#10b981" />
                    </View>
                ) : displayUsers.length === 0 ? (
                    <View style={{ alignItems: 'center', justifyContent: 'center', height: 200 }}>
                        <Text style={{ color: '#6b7280', fontSize: 15 }}>No {activeTab} found</Text>
                    </View>
                ) : (
                    displayUsers.map((user) => (
                        <View
                            key={user.id}
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, backgroundColor: '#fff', borderRadius: 12, marginBottom: 6, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 2 }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: '#e5e7eb', backgroundColor: '#e5e7eb', marginRight: 8, alignItems: 'center', justifyContent: 'center' }}>
                                    {user.profileImage ? (
                                        <Image
                                            source={{ uri: user.profileImage }}
                                            style={{ width: 40, height: 40, borderRadius: 20 }}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <Text style={{ fontSize: 16, color: '#6b7280', fontWeight: 'bold' }}>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</Text>
                                    )}
                                </View>
                                <View style={{ flexDirection: 'column' }}>
                                    <Text style={{ fontWeight: 'bold', fontSize: 15, color: '#111827' }}>{user.firstName} {user.lastName}</Text>
                                    <Text style={{ fontSize: 12, color: '#6b7280' }}>@{user.userName}</Text>
                                </View>
                            </View>
                            {activeTab === 'friends' && (
                                <TouchableOpacity
                                    onPress={() => {
                                        if (unfriendingUserId === user.id) {
                                            cancelUnfriend();
                                        } else {
                                            startUnfriendCountdown(user.id);
                                        }
                                    }}
                                    style={{ padding: 8, borderRadius: 12, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' }}
                                    activeOpacity={0.8}
                                >
                                    {unfriendingUserId === user.id ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <ActivityIndicator size="small" color="#ef4444" />
                                            <Text style={{ color: '#ef4444', fontWeight: 'bold', marginLeft: 6 }}>{countdown}</Text>
                                        </View>
                                    ) : (
                                        <Icon name="user-minus" size={18} color="#ef4444" />
                                    )}
                                </TouchableOpacity>
                            )}
                            {activeTab === 'followers' && (
                                <TouchableOpacity
                                    onPress={() => handleFollowBack(user.id)}
                                    style={{ padding: 8, borderRadius: 12, backgroundColor: '#bbf7d0', alignItems: 'center', justifyContent: 'center' }}
                                    activeOpacity={0.8}
                                    disabled={followingUserId === user.id}
                                >
                                    {followingUserId === user.id ? (
                                        <ActivityIndicator size="small" color="#10b981" />
                                    ) : (
                                        <Icon name="user-plus" size={18} color="#10b981" />
                                    )}
                                </TouchableOpacity>
                            )}
                            {activeTab === 'discover' && (
                                <TouchableOpacity
                                    onPress={() => {
                                        handleUserClick(user);
                                        setIsUserModalVisible(true);
                                    }}
                                    style={{ padding: 8, borderRadius: 12, backgroundColor: '#bbf7d0', alignItems: 'center', justifyContent: 'center' }}
                                    activeOpacity={0.8}
                                >
                                    <Icon name="plus" size={18} color="#10b981" />
                                </TouchableOpacity>
                            )}
                        </View>
                    ))
                )}
            </ScrollView>
        </View>
    );
};
