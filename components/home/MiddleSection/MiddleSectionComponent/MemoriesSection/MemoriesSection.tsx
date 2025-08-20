import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal, Dimensions } from 'react-native';
// import { auth } from '@/lib/firebaseConfig';
// import { toast } from 'react-hot-toast';
// import { Moment } from '@/types/momentTypes';
// import { ProfileImage } from '@/types/userTypes';
import Icon from 'react-native-vector-icons/Feather';
// import Video from 'react-native-video'; // Uncomment if using react-native-video

const SCREEN_WIDTH = Dimensions.get('window').width;

interface MomentUser {
    userName: string;
    profileImage?: string;
}

interface Moment {
    id: string;
    videoUrl: string;
    user: MomentUser;
    timeRemaining: string;
}

interface MomentsSectionProps {
    profileImage: { imageURL?: string } | null;
}

const MomentsSection: React.FC<MomentsSectionProps> = ({ profileImage }) => {
    const [videoFile, setVideoFile] = useState<any>(null); // TODO: Use react-native-image-picker
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [moments, setMoments] = useState<Moment[]>([]);
    const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null);
    const [isMuted, setIsMuted] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const scrollRef = useRef<ScrollView>(null);

    // TODO: Implement video validation for React Native if needed
    const validateVideo = async (file: any): Promise<boolean> => {
        // For now, always return true
        return true;
    };

    const handleVideoSelect = async () => {
        // TODO: Use react-native-image-picker to select video
        // Example: const result = await launchImageLibrary({ mediaType: 'video' });
        // if (result.assets && result.assets.length > 0) { ... }
    };

    const handleUploadMoment = async () => {
        // if (!videoFile || !auth.currentUser) return;
        setIsUploading(true);
        try {
            // TODO: Implement upload logic for React Native
            // Use fetch or axios to upload videoFile
            // Show success/failure feedback
            setVideoFile(null);
            setPreviewUrl(null);
            fetchMoments();
        } catch (error) {
            // TODO: Show error feedback
            console.error(error);
        } finally {
            setIsUploading(false);
        }
    };

    const fetchMoments = async () => {
        setIsLoading(true);
        try {
            // TODO: Fetch moments from API or local store for React Native
            // setMoments([]);
        } catch (error) {
            // TODO: Show error feedback
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleScroll = (direction: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const scrollAmount = direction === 'left' ? -320 : 320;
        // TODO: Use scrollTo for ScrollView in React Native
        // scrollRef.current.scrollTo({ x: ... })
    };

    const toggleMute = () => {
        setIsMuted((prev) => !prev);
    };

    useEffect(() => {
        fetchMoments();
        // const interval = setInterval(fetchMoments, 60000);
        // return () => clearInterval(interval);
    }, []);

    return (
        <View style={{ marginBottom: 32, position: 'relative', zIndex: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, zIndex: 0 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Moments</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                        onPress={() => handleScroll('left')}
                        style={{ padding: 8, borderRadius: 9999, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, marginRight: 4 }}
                    >
                        <Icon name="chevron-left" size={20} color="#4b5563" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleScroll('right')}
                        style={{ padding: 8, borderRadius: 9999, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 }}
                    >
                        <Icon name="chevron-right" size={20} color="#4b5563" />
                    </TouchableOpacity>
                </View>
            </View>
            <View style={{ position: 'relative', zIndex: 0 }}>
                <ScrollView
                    ref={scrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 24 }}
                    style={{ zIndex: 0 }}
                >
                    {/* Upload Moment Card */}
                    <View style={{ width: 96, aspectRatio: 9 / 16, backgroundColor: '#f3f4f6', borderRadius: 16, overflow: 'hidden', marginRight: 16, flexShrink: 0, zIndex: 0 }}>
                        {!videoFile ? (
                            <TouchableOpacity
                                onPress={handleVideoSelect}
                                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
                                activeOpacity={0.8}
                            >
                                <Icon name="plus" size={32} color="#6b7280" />
                                <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>Add Moment</Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={{ flex: 1, width: '100%', height: '100%', position: 'relative' }}>
                                {/* TODO: Use <Video> from 'react-native-video' for preview */}
                                {previewUrl ? (
                                    <Image source={{ uri: previewUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                ) : null}
                                <TouchableOpacity
                                    onPress={handleUploadMoment}
                                    disabled={isUploading}
                                    style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}
                                    activeOpacity={0.8}
                                >
                                    {isUploading ? (
                                        <ActivityIndicator size="large" color="#fff" />
                                    ) : (
                                        <>
                                            <Icon name="upload" size={32} color="#fff" />
                                            <Text style={{ fontSize: 13, color: '#fff', marginTop: 8 }}>Upload Moment</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                    {/* Moments List */}
                    {isLoading ? (
                        <View style={{ width: 96, aspectRatio: 9 / 16, backgroundColor: '#f3f4f6', borderRadius: 16, marginRight: 16, flexShrink: 0 }} />
                    ) : (
                        moments.map((moment) => (
                            <TouchableOpacity
                                key={moment.id}
                                style={{ width: 96, marginRight: 16, position: 'relative', flexShrink: 0 }}
                                activeOpacity={0.9}
                                onPress={() => setSelectedMoment(moment)}
                            >
                                <View style={{ aspectRatio: 9 / 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
                                    {/* TODO: Use <Video> from 'react-native-video' for preview */}
                                    <Image source={{ uri: moment.videoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                </View>
                                <View style={{ position: 'absolute', left: (96 - 48) / 2, bottom: -24, width: 48, height: 48, borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6 }}>
                                    {moment.user.profileImage ? (
                                        <Image source={{ uri: moment.user.profileImage }} style={{ width: 48, height: 48, borderRadius: 24 }} resizeMode="cover" />
                                    ) : (
                                        <View style={{ width: 48, height: 48, backgroundColor: '#e5e7eb', borderRadius: 24 }} />
                                    )}
                                </View>
                                <View style={{ position: 'absolute', left: 0, right: 0, bottom: -48, alignItems: 'center' }}>
                                    <Text style={{ fontSize: 13, fontWeight: '500', color: '#1f2937' }}>@{moment.user.userName}</Text>
                                    <Text style={{ fontSize: 11, color: '#6b7280' }}>{moment.timeRemaining}</Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            </View>
            {/* Full-screen Moment Viewer */}
            <Modal
                visible={!!selectedMoment}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedMoment(null)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: SCREEN_WIDTH - 32, maxWidth: 400, position: 'relative' }}>
                        <TouchableOpacity
                            onPress={() => setSelectedMoment(null)}
                            style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
                        >
                            <Icon name="x" size={28} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={toggleMute}
                            style={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}
                        >
                            <Icon name={isMuted ? 'volume-x' : 'volume-2'} size={28} color="#fff" />
                        </TouchableOpacity>
                        {/* TODO: Use <Video> from 'react-native-video' for full-screen playback */}
                        {selectedMoment && (
                            <Image source={{ uri: selectedMoment.videoUrl }} style={{ width: '100%', height: 400, borderRadius: 16, backgroundColor: '#000' }} resizeMode="cover" />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default MomentsSection;
