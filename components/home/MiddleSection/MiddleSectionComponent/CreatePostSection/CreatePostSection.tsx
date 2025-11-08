import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';

interface CreatePostSectionProps {
    onCreatePost: () => void;
    profileImageUrl?: string;
}

export const CreatePostSection = ({ onCreatePost, profileImageUrl }: CreatePostSectionProps) => {
    return (
        <TouchableOpacity
            onPress={onCreatePost}
            activeOpacity={0.85}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, overflow: 'hidden', backgroundColor: '#e5e7eb', flexShrink: 0, marginRight: 16 }}>
                    {profileImageUrl ? (
                        <Image
                            source={{ uri: profileImageUrl }}
                            style={{ width: '100%', height: '100%', borderRadius: 32 }}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={{ width: '100%', height: '100%', backgroundColor: '#e5e7eb' }} />
                    )}
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff' }}>
                        <Text style={{ color: '#6b7280', fontSize: 15 }}>
                            Tell us what's on your mind
                        </Text>
                    </View>
                </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 }}>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="image" size={20} color="#4b5563" />
                    <Text style={{ color: '#4b5563', fontSize: 15 }}>Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="smile" size={20} color="#4b5563" />
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};
