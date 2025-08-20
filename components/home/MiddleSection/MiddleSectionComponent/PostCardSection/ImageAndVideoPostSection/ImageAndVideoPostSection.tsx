import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Video from 'react-native-video';

interface ImageAndVideoPostSectionProps {
    media: {
        type: 'image' | 'video';
        typeUrl: string;
        fileName?: string;
        feedsPostId?: string;
        id?: string;
    }[];
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const ImageAndVideoPostSection = ({ media }: ImageAndVideoPostSectionProps) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [showUpArrow, setShowUpArrow] = useState(false);
    const [showDownArrow, setShowDownArrow] = useState(true);
    const thumbnailsRef = useRef<ScrollView>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isMuted, setIsMuted] = useState(true);

    // Single Media Render
    if (media.length === 1) {
        return (
            <View style={{ width: '100%', aspectRatio: 16 / 9, position: 'relative' }}>
                <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8 }}>
                    {media[0].type === 'image' ? (
                        <Image
                            source={{ uri: media[0].typeUrl }}
                            style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                        />
                    ) : (
                        <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                            <Video
                                source={{ uri: media[0].typeUrl }}
                                style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
                                resizeMode="cover"
                                paused={!isPlaying}
                                muted={isMuted}
                                repeat
                                controls
                            />
                            <TouchableOpacity
                                style={{ position: 'absolute', top: '45%', left: '45%', zIndex: 10 }}
                                onPress={() => setIsPlaying(!isPlaying)}
                                activeOpacity={0.7}
                            >
                                <Icon name={isPlaying ? 'pause-circle' : 'play-circle'} size={48} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
                                onPress={() => setIsMuted(!isMuted)}
                                activeOpacity={0.7}
                            >
                                <Icon name={isMuted ? 'volume-x' : 'volume-2'} size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>
        );
    }

    // Multiple Media Render
    return (
        <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ width: '85%', aspectRatio: 16 / 9, position: 'relative' }}>
                <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f3f4f6', shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8 }}>
                    {media[activeIndex].type === 'image' ? (
                        <Image
                            source={{ uri: media[activeIndex].typeUrl }}
                            style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                        />
                    ) : (
                        <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                            <Video
                                source={{ uri: media[activeIndex].typeUrl }}
                                style={{ width: '100%', height: '100%', backgroundColor: '#000' }}
                                resizeMode="cover"
                                paused={!isPlaying}
                                muted={isMuted}
                                repeat
                                controls
                            />
                            <TouchableOpacity
                                style={{ position: 'absolute', top: '45%', left: '45%', zIndex: 10 }}
                                onPress={() => setIsPlaying(!isPlaying)}
                                activeOpacity={0.7}
                            >
                                <Icon name={isPlaying ? 'pause-circle' : 'play-circle'} size={48} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
                                onPress={() => setIsMuted(!isMuted)}
                                activeOpacity={0.7}
                            >
                                <Icon name={isMuted ? 'volume-x' : 'volume-2'} size={28} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}
                    <View style={{ position: 'absolute', top: 16, left: '50%', transform: [{ translateX: -50 }], flexDirection: 'row', gap: 8, zIndex: 10 }}>
                        {media.map((_, index) => (
                            <TouchableOpacity
                                key={index}
                                onPress={() => setActiveIndex(index)}
                                style={{
                                    width: activeIndex === index ? 24 : 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: activeIndex === index ? '#10b981' : 'rgba(255,255,255,0.7)',
                                    marginHorizontal: 2,
                                }}
                            />
                        ))}
                    </View>
                </View>
            </View>
            <View style={{ width: '15%', aspectRatio: 16 / 9, position: 'relative' }}>
                <ScrollView
                    ref={thumbnailsRef}
                    style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
                    contentContainerStyle={{ flexDirection: 'column', gap: 8, paddingVertical: 8 }}
                    showsVerticalScrollIndicator={false}
                >
                    {media.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            onPress={() => setActiveIndex(index)}
                            style={{
                                height: 60,
                                width: '100%',
                                borderRadius: 10,
                                overflow: 'hidden',
                                borderWidth: activeIndex === index ? 2 : 0,
                                borderColor: activeIndex === index ? '#10b981' : 'transparent',
                                opacity: activeIndex === index ? 1 : 0.7,
                                marginBottom: 8,
                                backgroundColor: '#e5e7eb',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            {item.type === 'image' ? (
                                <Image
                                    source={{ uri: item.typeUrl }}
                                    style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                                />
                            ) : (
                                <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }}>
                                    <Icon name="play" size={24} color="#fff" />
                                </View>
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
};

export default ImageAndVideoPostSection;
