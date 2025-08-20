import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Modal, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { ProfileSection } from '../LeftSection/LeftSectionComponents/ProfileSection/ProfileSection';
import { UserListSection } from '../LeftSection/LeftSectionComponents/UserListSection/UserListSection';
import { SearchUser } from '@/types/userTypes';

interface MobileProps {
    onUserSelect: (user: SearchUser) => void;
}

const communitiesStub = [
    { id: '1', imageUrl: 'https://picsum.photos/200/200?random=1', title: 'React Devs', membershipCount: 1200 },
    { id: '2', imageUrl: 'https://picsum.photos/200/200?random=2', title: 'Designers', membershipCount: 800 },
];
const eventsStub = [
    { title: 'Tech Conference 2024', date: 'Mar 15', image: 'https://picsum.photos/200/200?random=5' },
    { title: 'Design Workshop', date: 'Mar 20', image: 'https://picsum.photos/200/200?random=6' },
    { title: 'Startup Meetup', date: 'Mar 25', image: 'https://picsum.photos/200/200?random=7' },
];
const jobsStub = [
    { role: 'Senior Developer', company: 'TechCorp', location: 'Remote', image: 'https://picsum.photos/200/200?random=8' },
    { role: 'UX Designer', company: 'DesignLabs', location: 'New York', image: 'https://picsum.photos/200/200?random=9' },
    { role: 'Product Manager', company: 'StartupX', location: 'San Francisco', image: 'https://picsum.photos/200/200?random=10' },
];

export const Mobile = ({ onUserSelect }: MobileProps) => {
    const [activeTab, setActiveTab] = useState<'feed' | 'profile' | 'discover' | 'chat'>('feed');
    const [isUserModalVisible, setIsUserModalVisible] = useState(false);
    const [windowSize, setWindowSize] = useState<'closed' | 'compact'>('closed');
    const [isMobile] = useState(true); // Always true for RN
    // Placeholder for displayUsers
    const handleUserClick = (user: SearchUser) => {
        onUserSelect(user);
    };
    const screenWidth = Dimensions.get('window').width;

    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            {/* Bottom Navigation */}
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', height: 64, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', zIndex: 50 }}>
                <TouchableOpacity
                    onPress={() => setActiveTab('feed')}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
                >
                    <Icon name="grid" size={24} color={activeTab === 'feed' ? '#10b981' : '#6b7280'} />
                    <Text style={{ fontSize: 12, marginTop: 2, color: activeTab === 'feed' ? '#10b981' : '#6b7280' }}>Feed</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('profile')}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
                >
                    <Icon name="user" size={24} color={activeTab === 'profile' ? '#10b981' : '#6b7280'} />
                    <Text style={{ fontSize: 12, marginTop: 2, color: activeTab === 'profile' ? '#10b981' : '#6b7280' }}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setActiveTab('discover')}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
                >
                    <Icon name="compass" size={24} color={activeTab === 'discover' ? '#10b981' : '#6b7280'} />
                    <Text style={{ fontSize: 12, marginTop: 2, color: activeTab === 'discover' ? '#10b981' : '#6b7280' }}>Discover</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setWindowSize(windowSize === 'closed' ? 'compact' : 'closed')}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
                >
                    <Icon name="message-square" size={24} color={windowSize !== 'closed' ? '#10b981' : '#6b7280'} />
                    <Text style={{ fontSize: 12, marginTop: 2, color: windowSize !== 'closed' ? '#10b981' : '#6b7280' }}>Chat</Text>
                </TouchableOpacity>
            </View>

            {/* Chat Window as full-screen modal on mobile */}
            <Modal visible={isMobile && windowSize !== 'closed'} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: '#fff' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#374151' }}>Messages</Text>
                        <TouchableOpacity
                            onPress={() => setWindowSize('closed')}
                            style={{ padding: 8, borderRadius: 20, backgroundColor: '#f3f4f6' }}
                        >
                            <Icon name="x" size={28} color="#6b7280" />
                        </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        {/* Placeholder for ChatWindow */}
                        <Text style={{ color: '#6b7280' }}>[ChatWindow Placeholder]</Text>
                    </View>
                </View>
            </Modal>

            {/* Content Panels */}
            {activeTab === 'profile' && (
                <ScrollView style={{ flex: 1, paddingTop: 40, paddingBottom: 80, paddingHorizontal: 16 }}>
                    <ProfileSection />
                    <UserListSection
                        handleUserClick={handleUserClick}
                        setIsUserModalVisible={setIsUserModalVisible}
                    />
                </ScrollView>
            )}
            {activeTab === 'discover' && (
                <ScrollView style={{ flex: 1, paddingTop: 40, paddingBottom: 80, paddingHorizontal: 16 }}>
                    {/* Communities Section */}
                    <View style={{ marginBottom: 32 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Communities</Text>
                            <TouchableOpacity>
                                <Text style={{ color: '#10b981', fontWeight: 'bold' }}>See All</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                            {communitiesStub.map((community) => (
                                <View key={community.id} style={{ width: (screenWidth - 64) / 2, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 12, backgroundColor: '#e5e7eb' }}>
                                    <Image
                                        source={{ uri: community.imageUrl }}
                                        style={{ width: '100%', height: '100%', position: 'absolute', borderRadius: 12 }}
                                        resizeMode="cover"
                                    />
                                    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
                                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>{community.title}</Text>
                                        <Text style={{ color: '#d1d5db', fontSize: 13 }}>{community.membershipCount.toLocaleString()} members</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                    {/* Events Section */}
                    <View style={{ marginBottom: 32 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Upcoming Events</Text>
                            <TouchableOpacity>
                                <Text style={{ color: '#10b981', fontWeight: 'bold' }}>View All</Text>
                            </TouchableOpacity>
                        </View>
                        <View>
                            {eventsStub.map((event, index) => (
                                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                                    <Image
                                        source={{ uri: event.image }}
                                        style={{ width: 60, height: 60, borderRadius: 12, marginRight: 12 }}
                                        resizeMode="cover"
                                    />
                                    <View>
                                        <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{event.title}</Text>
                                        <Text style={{ color: '#6b7280', fontSize: 13 }}>{event.date}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                    {/* Jobs Section */}
                    <View style={{ marginBottom: 32 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Featured Jobs</Text>
                            <TouchableOpacity>
                                <Text style={{ color: '#10b981', fontWeight: 'bold' }}>Browse All</Text>
                            </TouchableOpacity>
                        </View>
                        <View>
                            {jobsStub.map((job, index) => (
                                <View key={index} style={{ borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginBottom: 12, backgroundColor: '#fff' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Image
                                            source={{ uri: job.image }}
                                            style={{ width: 48, height: 48, borderRadius: 12, marginRight: 12 }}
                                            resizeMode="cover"
                                        />
                                        <View>
                                            <Text style={{ fontWeight: 'bold', fontSize: 15 }}>{job.role}</Text>
                                            <Text style={{ color: '#374151', fontSize: 14 }}>{job.company}</Text>
                                            <Text style={{ color: '#6b7280', fontSize: 13 }}>{job.location}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            )}
            {/* Feed and other tabs can be implemented as needed */}
            {/* Close button for content panels */}
            {activeTab !== 'feed' && (
                <TouchableOpacity
                    onPress={() => setActiveTab('feed')}
                    style={{ position: 'absolute', top: 24, right: 24, padding: 8, borderRadius: 20, backgroundColor: '#f3f4f6', zIndex: 100 }}
                >
                    <Icon name="x" size={24} color="#6b7280" />
                </TouchableOpacity>
            )}
        </View>
    );
};
