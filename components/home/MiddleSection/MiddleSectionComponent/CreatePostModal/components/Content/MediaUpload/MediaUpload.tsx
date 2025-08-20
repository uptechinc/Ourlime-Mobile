import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView } from 'react-native';
import Video from 'react-native-video';

// NOTE: You must install 'react-native-video' for this to work
// npm install react-native-video

type MediaUploadProps = {
    selectedFiles: { uri: string; type: string }[];
    previews: string[];
    onFilesSelect: (files: { uri: string; type: string }[]) => void;
    onFileRemove: (index: number) => void;
    isReel?: boolean;
};

export const MediaUpload = ({
    selectedFiles,
    previews,
    onFilesSelect,
    onFileRemove,
    isReel = false
}: MediaUploadProps) => {
    const [isDragging, setIsDragging] = useState(false);
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const videoRef = useRef<any>(null);

    // File picking logic for React Native would use expo-image-picker or react-native-image-picker
    // Here, we just show a placeholder for the upload button

    return (
        <View style={{ backgroundColor: '#f9fafb', borderRadius: 16, padding: 16 }}>
            <TouchableOpacity
                style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderRadius: 16,
                    borderColor: isDragging ? '#10b981' : '#d1d5db',
                    backgroundColor: isDragging ? '#ecfdf5' : 'transparent',
                    marginBottom: 12,
                }}
                // onPress should open image/video picker
                onPress={() => {}}
            >
                <Text style={{ fontSize: 32, color: '#9ca3af', marginBottom: 8 }}>{isReel ? '🎬' : '⬆️'}</Text>
                <Text style={{ color: '#4b5563', fontWeight: '500', marginBottom: 2 }}>
                    {isReel ? 'Tap to upload your reel' : 'Tap to upload files'}
                </Text>
                <Text style={{ fontSize: 13, color: '#9ca3af' }}>
                    {isReel ? 'Maximum duration: 60 seconds' : 'Supports images and videos (max 10 files)'}
                </Text>
            </TouchableOpacity>
            {previews.length > 0 && (
                <View style={{ marginTop: 16 }}>
                    {isReel ? (
                        <View style={{ position: 'relative', aspectRatio: 9 / 16, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' }}>
                            <Video
                                ref={videoRef}
                                source={{ uri: previews[0] }}
                                style={{ width: '100%', height: '100%' }}
                                controls
                                resizeMode="contain"
                                onLoad={meta => setVideoDuration(meta.duration)}
                            />
                            <TouchableOpacity
                                onPress={() => onFileRemove(0)}
                                style={{ position: 'absolute', top: 8, right: 8, padding: 8, backgroundColor: '#ef4444', borderRadius: 999 }}
                            >
                                <Text style={{ color: '#fff', fontSize: 16 }}>×</Text>
                            </TouchableOpacity>
                            {videoDuration > 0 && (
                                <View style={{ position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                    <Text style={{ color: '#fff', fontSize: 13 }}>{Math.round(videoDuration)}s</Text>
                                </View>
                            )}
                        </View>
                    ) : (
                        <ScrollView
                            contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}
                            horizontal={false}
                        >
                            {previews.map((preview, index) => (
                                <View
                                    key={index}
                                    style={{
                                        position: 'relative',
                                        aspectRatio: 1,
                                        borderRadius: 16,
                                        overflow: 'hidden',
                                        backgroundColor: '#000',
                                        width: 120,
                                        height: 120,
                                        marginRight: 12,
                                        marginBottom: 12,
                                    }}
                                >
                                    {selectedFiles[index]?.type.startsWith('video/') ? (
                                        <Video
                                            source={{ uri: preview }}
                                            style={{ width: '100%', height: '100%' }}
                                            controls
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <Image
                                            source={{ uri: preview }}
                                            style={{ width: '100%', height: '100%', borderRadius: 12 }}
                                        />
                                    )}
                                    <TouchableOpacity
                                        onPress={() => onFileRemove(index)}
                                        style={{ position: 'absolute', top: 8, right: 8, padding: 8, backgroundColor: '#ef4444', borderRadius: 999 }}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 16 }}>×</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                    )}
                </View>
            )}
        </View>
    );
};
