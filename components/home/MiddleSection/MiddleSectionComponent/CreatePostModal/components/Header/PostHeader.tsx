import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Icon from 'react-native-vector-icons/Feather';

type PostHeaderProps = {
    profilePicture: string;
    visibility: string;
    postType: 'regular' | 'poll' | 'reel';
    onVisibilityChange: (value: string) => void;
    onPostTypeChange: (type: 'regular' | 'poll' | 'reel') => void;
    onClose: () => void;
};

export const PostHeader = ({
    profilePicture,
    visibility,
    postType,
    onVisibilityChange,
    onPostTypeChange,
    onClose
}: PostHeaderProps) => {
    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 24,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: '#e5e7eb',
            }}
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={{ position: 'relative', marginRight: 12 }}>
                    <View
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(16,185,129,0.08)',
                            borderRadius: 9999,
                        }}
                    />
                    <Image
                        source={{ uri: profilePicture }}
                        style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#fff' }}
                    />
                </View>
                <View>
                    <Text style={{ fontWeight: '600', fontSize: 18 }}>
                        {postType === 'reel' ? 'Create Reel' : 'Create Post'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 }}>
                        <Picker
                            selectedValue={visibility}
                            style={{ height: 32, width: 160, fontSize: 13, color: '#4b5563', backgroundColor: '#f9fafb', borderRadius: 8 }}
                            onValueChange={onVisibilityChange}
                            mode="dropdown"
                        >
                            <Picker.Item label="🌎 Public" value="public" />
                            <Picker.Item label="👥 Friends Only" value="friends" />
                            <Picker.Item label="👥🔄 Friends & Followers" value="friends_followers" />
                            <Picker.Item label="🔒 Private" value="private" />
                        </Picker>
                        <View style={{ width: 1, height: 16, backgroundColor: '#e5e7eb', marginHorizontal: 8 }} />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => onPostTypeChange('regular')}
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                    backgroundColor: postType === 'regular' ? '#10b981' : '#f9fafb',
                                }}
                            >
                                <Text style={{ color: postType === 'regular' ? '#fff' : '#4b5563', fontSize: 13, fontWeight: '500' }}>
                                    Regular Post
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => onPostTypeChange('poll')}
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                    backgroundColor: postType === 'poll' ? '#10b981' : '#f9fafb',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                }}
                            >
                                <Icon name="pie-chart" size={14} color={postType === 'poll' ? '#fff' : '#4b5563'} style={{ marginRight: 4 }} />
                                <Text style={{ color: postType === 'poll' ? '#fff' : '#4b5563', fontSize: 13, fontWeight: '500' }}>
                                    Poll
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => onPostTypeChange('reel')}
                                style={{
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 8,
                                    backgroundColor: postType === 'reel' ? '#10b981' : '#f9fafb',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                }}
                            >
                                <Icon name="film" size={14} color={postType === 'reel' ? '#fff' : '#4b5563'} style={{ marginRight: 4 }} />
                                <Text style={{ color: postType === 'reel' ? '#fff' : '#4b5563', fontSize: 13, fontWeight: '500' }}>
                                    Reel
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
            <TouchableOpacity
                onPress={onClose}
                style={{
                    padding: 8,
                    borderRadius: 9999,
                    backgroundColor: '#f3f4f6',
                }}
            >
                <Icon name="x" size={20} color="#6b7280" />
            </TouchableOpacity>
        </View>
    );
};
