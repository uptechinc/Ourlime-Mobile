import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet } from 'react-native';
import { ImageIcon, Video, X, Plus } from 'lucide-react-native';

type MediaUploadProps = {
    selectedFiles: any[];
    previews: string[];
    onFilesSelect: () => void;
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
    return (
        <View style={styles.container}>
            {previews.length === 0 ? (
                <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={onFilesSelect}
                    activeOpacity={0.8}
                >
                    <View style={styles.uploadContent}>
                        {isReel ? (
                            <Video size={48} color="#10B981" />
                        ) : (
                            <ImageIcon size={48} color="#10B981" />
                        )}
                        <Text style={styles.uploadTitle}>
                            {isReel ? 'Tap to upload your reel' : 'Tap to add photos or videos'}
                        </Text>
                        <Text style={styles.uploadSubtitle}>
                            {isReel ? 'Maximum duration: 60 seconds' : 'You can select multiple files'}
                        </Text>
                    </View>
                </TouchableOpacity>
            ) : (
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.previewContainer}
                >
                    {previews.map((preview, index) => (
                        <View key={index} style={styles.previewWrapper}>
                            <Image
                                source={{ uri: preview }}
                                style={styles.previewImage}
                                resizeMode="cover"
                            />
                            <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => onFileRemove(index)}
                            >
                                <X size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                            {selectedFiles[index]?.type === 'video' && (
                                <View style={styles.videoBadge}>
                                    <Video size={12} color="#FFFFFF" />
                                </View>
                            )}
                        </View>
                    ))}
                    {previews.length < 10 && !isReel && (
                        <TouchableOpacity
                            style={styles.addMoreButton}
                            onPress={onFilesSelect}
                        >
                            <Plus size={24} color="#10B981" />
                        </TouchableOpacity>
                    )}
                </ScrollView>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
    },
    uploadButton: {
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#D1D5DB',
        borderRadius: 16,
        backgroundColor: '#F9FAFB',
        minHeight: 200,
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadContent: {
        alignItems: 'center',
    },
    uploadTitle: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    uploadSubtitle: {
        marginTop: 4,
        fontSize: 13,
        color: '#9CA3AF',
    },
    previewContainer: {
        flexDirection: 'row',
        gap: 12,
    },
    previewWrapper: {
        position: 'relative',
        width: 120,
        height: 120,
        borderRadius: 12,
        overflow: 'hidden',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    removeButton: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    videoBadge: {
        position: 'absolute',
        bottom: 6,
        left: 6,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
    },
    addMoreButton: {
        width: 120,
        height: 120,
        borderRadius: 12,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: '#10B981',
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
    },
});