import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Video from 'react-native-video';

interface ReelUser {
    userName: string;
    profileImage?: string;
}

interface Reel {
    id: string;
    media: { typeUrl: string };
    user: ReelUser;
    likes?: string[] | { [key: string]: boolean };
    stats?: { comments?: number; shares?: number };
}

interface ReelCardProps {
    reels: Reel[];
    onCommentClick: (postId: string) => void;
    setSelectedReel: (reel: Reel | null) => void;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const ReelCardSection = ({ reels, onCommentClick, setSelectedReel }: ReelCardProps) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const [likingReels, setLikingReels] = useState<Set<string>>(new Set());
    // const currentUser = ... // Omit Firebase setup for now

    // Check if current user has liked a reel (stubbed for now)
    const isReelLiked = (reel: Reel) => false;
    // Get like count safely
    const getLikeCount = (reel: Reel) => {
        if (Array.isArray(reel.likes)) {
            return reel.likes.length;
        }
        if (reel.likes && typeof reel.likes === 'object') {
            return Object.keys(reel.likes).length;
        }
        return 0;
    };

    if (!reels || reels.length === 0) return null;

    return (
        <View style={{ width: '100%', gap: 24 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="film" size={20} color="#10b981" />
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827' }}>Limes</Text>
                </View>
                <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#10b981', borderRadius: 9999 }}
                    activeOpacity={0.85}
                >
                    <Icon name="plus" size={18} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 15, marginLeft: 4 }}>Create Lime</Text>
                </TouchableOpacity>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexDirection: 'row', gap: 16, paddingBottom: 16 }}
            >
                {/* Create Lime Card */}
                <TouchableOpacity
                    style={{
                        width: SCREEN_WIDTH * 0.45,
                        aspectRatio: 9 / 16,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderStyle: 'dashed',
                        borderColor: '#d1d5db',
                        backgroundColor: '#f3f4f6',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 8,
                    }}
                    activeOpacity={0.85}
                >
                    <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#bbf7d0', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                        <Icon name="plus" size={28} color="#10b981" />
                    </View>
                    <Text style={{ color: '#6b7280', fontSize: 14, textAlign: 'center' }}>Create a new lime</Text>
                </TouchableOpacity>
                {/* Reel Cards */}
                {reels.map((reel, idx) => (
                    <TouchableOpacity
                        key={reel.id}
                        style={{
                            width: SCREEN_WIDTH * 0.45,
                            aspectRatio: 9 / 16,
                            borderRadius: 16,
                            overflow: 'hidden',
                            backgroundColor: '#000',
                            marginRight: 8,
                            position: 'relative',
                        }}
                        activeOpacity={0.9}
                        onPress={() => setSelectedReel(reel)}
                        onPressIn={() => setActiveIndex(idx)}
                        onPressOut={() => setActiveIndex(null)}
                    >
                        <Video
                            source={{ uri: reel.media.typeUrl }}
                            style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
                            resizeMode="cover"
                                muted
                            repeat
                            paused={activeIndex !== idx}
                        />
                        {/* Overlay */}
                        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', marginRight: 8, backgroundColor: '#e5e7eb' }}>
                                        <Image
                                        source={{ uri: reel.user.profileImage || 'https://ui-avatars.com/api/?name=User' }}
                                        style={{ width: 32, height: 32, borderRadius: 16 }}
                                        resizeMode="cover"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{reel.user.userName}</Text>
                                    <Text style={{ color: '#fff', fontSize: 12 }}>{getLikeCount(reel)} likes</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 }}>
                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Icon name="heart" size={18} color={isReelLiked(reel) ? '#ef4444' : '#fff'} />
                                    <Text style={{ color: '#fff', fontSize: 13 }}>{getLikeCount(reel)}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => onCommentClick(reel.id)}>
                                    <Icon name="message-circle" size={18} color="#fff" />
                                    <Text style={{ color: '#fff', fontSize: 13 }}>{reel.stats?.comments || 0}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Icon name="share" size={18} color="#fff" />
                                    <Text style={{ color: '#fff', fontSize: 13 }}>{reel.stats?.shares || 0}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

export default ReelCardSection;
